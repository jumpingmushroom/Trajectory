import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	gym,
	equipment,
	exercise,
	set as setTable,
	workoutSession,
	type Equipment,
	type Gym
} from '$lib/server/db/schema';
import { isNull, eq, and, desc, asc, gte, lt } from 'drizzle-orm';
import { resolveActiveGym } from '$lib/server/active-gym';
import { parseAsOfTs, startOfUtcDay, endOfUtcDay } from '$lib/dateMode';

const SAFETY_MS = 6 * 60 * 60 * 1000;

export interface EquipmentTileMeta {
	equipment: Equipment;
	lastWeight: number | null;
	lastReps: number | null;
	lastDurationMin: number | null;
	lastDistance: number | null;
	lastBwLoadKg: number | null;
	lastTs: number | null;
	daysSince: number | null;
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const asOfTs = parseAsOfTs(url.searchParams);
	// "Now" for the page is the user-perceived day: if backdating, it's the
	// chosen ts; if live, it's actually now. Tile prefill / days-since are
	// computed against this so the home screen shows what the gym looked
	// like on the chosen day.
	const referenceTs = asOfTs ?? Date.now();

	const gyms = await db
		.select()
		.from(gym)
		.where(and(eq(gym.userId, locals.user.id), isNull(gym.deletedAt)))
		.orderBy(desc(gym.isPrimary), asc(gym.createdAt));

	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const activeGym = (await resolveActiveGym(cookies, locals.user.id)) ?? gyms[0];

	// Gyms this user has ever trained at (plus the active gym). Hides
	// smoke-seeded test gyms from other users, while still letting users
	// pick a fresh travel gym they're newly active in.
	const userGymIds = new Set(
		(
			await db
				.selectDistinct({ gymId: workoutSession.gymId })
				.from(workoutSession)
				.where(eq(workoutSession.userId, locals.user.id))
		).map((row) => row.gymId)
	);
	const switcherGyms = gyms.filter((g) => userGymIds.has(g.id) || g.id === activeGym.id);

	const equipments = await db
		.select()
		.from(equipment)
		.where(and(isNull(equipment.deletedAt), eq(equipment.gymId, activeGym.id)))
		.orderBy(asc(equipment.sortOrder), asc(equipment.createdAt));

	// Last-set-per-equipment for the current user, scoped to ts ≤ referenceTs
	// when in date-mode. Without that filter, backdating would prefill a
	// past entry with newer data — silently rewriting the past.
	const setFilters = [
		eq(setTable.userId, locals.user.id),
		isNull(setTable.deletedAt),
		isNull(exercise.deletedAt)
	];
	if (asOfTs != null) {
		setFilters.push(lt(setTable.ts, new Date(endOfUtcDay(asOfTs))));
	}

	const lastSetsRaw = equipments.length
		? ((await db
				.select({
					equipmentId: exercise.equipmentId,
					weight: setTable.weight,
					reps: setTable.reps,
					durationMin: setTable.durationMin,
					extras: setTable.extras,
					ts: setTable.ts
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(and(...setFilters))
				.orderBy(desc(setTable.ts))) as {
				equipmentId: string;
				weight: number | null;
				reps: number | null;
				durationMin: number | null;
				extras: Record<string, number> | null;
				ts: Date;
			}[])
		: [];

	const lastByEquipment = new Map<string, (typeof lastSetsRaw)[number]>();
	for (const row of lastSetsRaw) {
		if (!lastByEquipment.has(row.equipmentId)) {
			lastByEquipment.set(row.equipmentId, row);
		}
	}

	const dayMs = 24 * 60 * 60 * 1000;
	const tiles: EquipmentTileMeta[] = equipments.map((eq) => {
		const last = lastByEquipment.get(eq.id);
		const ts = last ? last.ts.getTime() : null;
		const lastBwRaw = last?.extras?.bwLoadKg;
		const lastBwLoadKg =
			typeof lastBwRaw === 'number' && Number.isFinite(lastBwRaw) ? lastBwRaw : null;
		const lastDistanceRaw = last?.extras?.distance;
		const lastDistance =
			typeof lastDistanceRaw === 'number' && Number.isFinite(lastDistanceRaw)
				? lastDistanceRaw
				: null;
		return {
			equipment: eq,
			lastWeight: last?.weight ?? null,
			lastReps: last?.reps ?? null,
			lastDurationMin: last?.durationMin ?? null,
			lastDistance,
			lastBwLoadKg,
			lastTs: ts,
			daysSince: ts == null ? null : Math.max(0, Math.floor((referenceTs - ts) / dayMs))
		};
	});

	let activeSession: {
		id: string;
		startedAt: number;
		setCount: number;
		lastSetTs: number | null;
		lastEquipmentName: string | null;
		lastEquipmentId: string | null;
	} | null = null;

	let backdatedSession: {
		id: string;
		setCount: number;
		lastEquipmentName: string | null;
		lastEquipmentId: string | null;
	} | null = null;

	if (asOfTs == null) {
		// Live mode: most-recent open session for this user.
		const open = (
			await db
				.select()
				.from(workoutSession)
				.where(and(eq(workoutSession.userId, locals.user.id), isNull(workoutSession.endedAt)))
				.orderBy(desc(workoutSession.startedAt))
				.limit(1)
		)[0];

		if (open) {
			const sessionSets = (await db
				.select({
					ts: setTable.ts,
					equipmentId: exercise.equipmentId
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(and(eq(setTable.workoutSessionId, open.id), isNull(setTable.deletedAt)))
				.orderBy(desc(setTable.ts))) as { ts: Date; equipmentId: string }[];

			const lastSetTs = sessionSets[0]?.ts.getTime() ?? null;
			const startedAtMs = open.startedAt.getTime();
			// Auto-close stale sessions on read. Non-empty: pin endedAt to last
			// set's ts (gap is downtime, not workout time). Empty (manual start
			// with no sets): pin to startedAt as a 0-duration row. Past this
			// window the session is no longer "active" — the user walked away.
			const isStaleNonEmpty = lastSetTs != null && Date.now() - lastSetTs > SAFETY_MS;
			const isStaleEmpty = lastSetTs == null && Date.now() - startedAtMs > SAFETY_MS;

			if (isStaleNonEmpty) {
				await db
					.update(workoutSession)
					.set({ endedAt: new Date(lastSetTs!), updatedAt: new Date() })
					.where(eq(workoutSession.id, open.id));
			} else if (isStaleEmpty) {
				await db
					.update(workoutSession)
					.set({ endedAt: open.startedAt, updatedAt: new Date() })
					.where(eq(workoutSession.id, open.id));
			} else {
				const lastEquipmentId = sessionSets[0]?.equipmentId ?? null;
				const lastEquipment = lastEquipmentId
					? equipments.find((e) => e.id === lastEquipmentId)
					: undefined;
				activeSession = {
					id: open.id,
					startedAt: startedAtMs,
					setCount: sessionSets.length,
					lastSetTs,
					lastEquipmentName: lastEquipment?.name ?? null,
					lastEquipmentId
				};
			}
		}
	} else {
		// Date-mode: look up *any* session (open or closed) for this user +
		// active gym whose startedAt falls on the chosen calendar day.
		const dayStart = startOfUtcDay(asOfTs);
		const dayEnd = dayStart + 86_400_000;
		const past = (
			await db
				.select()
				.from(workoutSession)
				.where(
					and(
						eq(workoutSession.userId, locals.user.id),
						eq(workoutSession.gymId, activeGym.id),
						gte(workoutSession.startedAt, new Date(dayStart)),
						lt(workoutSession.startedAt, new Date(dayEnd))
					)
				)
				.orderBy(asc(workoutSession.startedAt))
				.limit(1)
		)[0];

		if (past) {
			const sessionSets = (await db
				.select({ equipmentId: exercise.equipmentId })
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(and(eq(setTable.workoutSessionId, past.id), isNull(setTable.deletedAt)))
				.orderBy(desc(setTable.ts))) as { equipmentId: string }[];

			const lastEquipmentId = sessionSets[0]?.equipmentId ?? null;
			const lastEquipment = lastEquipmentId
				? equipments.find((e) => e.id === lastEquipmentId)
				: undefined;
			backdatedSession = {
				id: past.id,
				setCount: sessionSets.length,
				lastEquipmentName: lastEquipment?.name ?? null,
				lastEquipmentId
			};
		}
	}

	return {
		userName: locals.user.name,
		userId: locals.user.id,
		gyms: switcherGyms as Gym[],
		activeGym,
		tiles,
		activeSession,
		backdatedSession,
		asOfTs
	};
};
