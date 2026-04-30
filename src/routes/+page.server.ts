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
import { isNull, eq, and, desc, asc } from 'drizzle-orm';
import { resolveActiveGym } from '$lib/server/active-gym';

const SAFETY_MS = 6 * 60 * 60 * 1000;

export interface EquipmentTileMeta {
	equipment: Equipment;
	lastWeight: number | null;
	lastReps: number | null;
	lastDurationMin: number | null;
	lastTs: number | null;
	daysSince: number | null;
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/login');

	const gyms = await db
		.select()
		.from(gym)
		.where(isNull(gym.deletedAt))
		.orderBy(desc(gym.isPrimary), asc(gym.createdAt));

	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const activeGym = (await resolveActiveGym(cookies)) ?? gyms[0];

	const equipments = await db
		.select()
		.from(equipment)
		.where(and(isNull(equipment.deletedAt), eq(equipment.gymId, activeGym.id)))
		.orderBy(asc(equipment.sortOrder), asc(equipment.createdAt));

	// Last-set-per-equipment for the current user. One query, group in JS.
	// At 2 users × ~1000 sets/year scale this is well under a millisecond.
	const lastSetsRaw = equipments.length
		? ((await db
				.select({
					equipmentId: exercise.equipmentId,
					weight: setTable.weight,
					reps: setTable.reps,
					durationMin: setTable.durationMin,
					ts: setTable.ts
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(
					and(
						eq(setTable.userId, locals.user.id),
						isNull(setTable.deletedAt),
						isNull(exercise.deletedAt)
					)
				)
				.orderBy(desc(setTable.ts))) as {
				equipmentId: string;
				weight: number | null;
				reps: number | null;
				durationMin: number | null;
				ts: Date;
			}[])
		: [];

	const lastByEquipment = new Map<string, (typeof lastSetsRaw)[number]>();
	for (const row of lastSetsRaw) {
		if (!lastByEquipment.has(row.equipmentId)) {
			lastByEquipment.set(row.equipmentId, row);
		}
	}

	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	const tiles: EquipmentTileMeta[] = equipments.map((eq) => {
		const last = lastByEquipment.get(eq.id);
		const ts = last ? last.ts.getTime() : null;
		return {
			equipment: eq,
			lastWeight: last?.weight ?? null,
			lastReps: last?.reps ?? null,
			lastDurationMin: last?.durationMin ?? null,
			lastTs: ts,
			daysSince: ts == null ? null : Math.max(0, Math.floor((now - ts) / dayMs))
		};
	});

	// Active session for the SessionBar. We accept any open session (across
	// gyms) for this user; the bar links back to the equipment of the
	// last-logged set. If the last set is older than 6h we treat the
	// session as effectively over and hide the bar (the row stays open in
	// the DB; resolveSession() will close it on the next set.create).
	const open = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, locals.user.id), isNull(workoutSession.endedAt)))
			.orderBy(desc(workoutSession.startedAt))
			.limit(1)
	)[0];

	let activeSession: {
		startedAt: number;
		setCount: number;
		lastSetTs: number | null;
		lastEquipmentName: string | null;
		lastEquipmentId: string | null;
	} | null = null;

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
		const isStale = lastSetTs != null && Date.now() - lastSetTs > SAFETY_MS;

		if (!isStale && sessionSets.length > 0) {
			const lastEquipmentId = sessionSets[0].equipmentId;
			const lastEquipment = equipments.find((e) => e.id === lastEquipmentId);
			activeSession = {
				startedAt: open.startedAt.getTime(),
				setCount: sessionSets.length,
				lastSetTs,
				lastEquipmentName: lastEquipment?.name ?? null,
				lastEquipmentId
			};
		}
	}

	return {
		userName: locals.user.name,
		userId: locals.user.id,
		gyms: gyms as Gym[],
		activeGym,
		tiles,
		activeSession
	};
};
