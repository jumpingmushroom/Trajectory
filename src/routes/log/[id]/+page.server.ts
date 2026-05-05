import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	equipment,
	exercise,
	gym,
	set as setTable,
	workoutSession,
	user
} from '$lib/server/db/schema';
import { isNull, eq, and, asc, desc, inArray, gte, lt } from 'drizzle-orm';
import { parseAsOfTs, startOfUtcDay, endOfUtcDay } from '$lib/dateMode';
import { effectiveSetLoad } from '$lib/server/db/effective-load';

export interface ExerciseContext {
	id: string;
	name: string;
	isHidden: boolean;
	lastWeight: number | null;
	lastReps: number | null;
	lastDurationMin: number | null;
	// Distance from the most-recent set's extras (used by weight_distance
	// equipment to seed the carry Stepper and the "Last time" summary).
	lastDistance: number | null;
	// Bodyweight contribution snapshotted on the most-recent set. Lets the
	// "Last time: X kg × Y" label render effective load to match the set
	// list. Null when the last set has no bodyweight snapshot.
	lastBwLoadKg: number | null;
	commonWeights: number[];
	sparklineSeries: number[];
	// Current PR for this exercise & user. Axis depends on the equipment's
	// inputMode: distance_time → MAX(extras.distance); timed → MAX(durationMin);
	// timed_weighted / weight_distance → MAX(weight); weighted / bodyweight →
	// MAX(effective load). Null when no qualifying prior set exists. Used by
	// the client for optimistic "New PR" feedback at log time.
	prValue: number | null;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(303, '/login');
	const id = params.id;
	if (!id) throw error(404, 'equipment not found');

	const asOfTs = parseAsOfTs(url.searchParams);

	// Ownership-scoped lookup: a request for someone else's equipment id
	// resolves to no row and surfaces as 404 (no existence leak).
	const eqRow = (
		await db
			.select({
				id: equipment.id,
				gymId: equipment.gymId,
				name: equipment.name,
				type: equipment.type,
				group: equipment.group,
				glyph: equipment.glyph,
				tint: equipment.tint,
				photoPath: equipment.photoPath,
				cardioKind: equipment.cardioKind,
				sortOrder: equipment.sortOrder,
				notes: equipment.notes,
				bodyweightPct: equipment.bodyweightPct,
				inputMode: equipment.inputMode,
				createdAt: equipment.createdAt,
				updatedAt: equipment.updatedAt,
				deletedAt: equipment.deletedAt
			})
			.from(equipment)
			.innerJoin(gym, eq(gym.id, equipment.gymId))
			.where(
				and(
					eq(equipment.id, id),
					eq(gym.userId, locals.user.id),
					isNull(equipment.deletedAt),
					isNull(gym.deletedAt)
				)
			)
			.limit(1)
	)[0];
	if (!eqRow) throw error(404, 'equipment not found');

	const exercises = await db
		.select()
		.from(exercise)
		.where(and(eq(exercise.equipmentId, id), isNull(exercise.deletedAt)))
		.orderBy(asc(exercise.isHidden), asc(exercise.sortOrder), asc(exercise.createdAt));
	if (exercises.length === 0) throw error(409, 'equipment has no exercises');

	const exerciseIds = exercises.map((x) => x.id);

	const setFilters = [
		eq(setTable.userId, locals.user.id),
		isNull(setTable.deletedAt),
		inArray(setTable.exerciseId, exerciseIds)
	];
	if (asOfTs != null) {
		setFilters.push(lt(setTable.ts, new Date(endOfUtcDay(asOfTs))));
	}

	const sets = (await db
		.select({
			id: setTable.id,
			workoutSessionId: setTable.workoutSessionId,
			exerciseId: setTable.exerciseId,
			weight: setTable.weight,
			reps: setTable.reps,
			durationMin: setTable.durationMin,
			extras: setTable.extras,
			ts: setTable.ts
		})
		.from(setTable)
		.where(and(...setFilters))
		.orderBy(desc(setTable.ts))) as {
		id: string;
		workoutSessionId: string;
		exerciseId: string;
		weight: number | null;
		reps: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		ts: Date;
	}[];

	// Per-exercise context: last values, common weights, top-set series.
	const contexts: ExerciseContext[] = exercises.map((ex) => {
		const own = sets.filter((s) => s.exerciseId === ex.id);
		const last = own[0];

		const recencyByWeight = new Map<number, number>();
		for (const s of own) {
			if (s.weight == null || s.weight <= 0) continue;
			const ts = s.ts.getTime();
			const cur = recencyByWeight.get(s.weight) ?? 0;
			if (ts > cur) recencyByWeight.set(s.weight, ts);
		}
		const commonWeights = [...recencyByWeight.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4)
			.map(([w]) => w)
			.sort((a, b) => a - b);

		// Top-set per session, oldest first, last 10. The axis follows the
		// equipment's inputMode: cardio + timed plot durationMin; weight_distance
		// plots distance; everything else plots effective load (weight + bw).
		const perSession = new Map<string, number>();
		for (const s of own) {
			let v: number;
			if (eqRow.inputMode === 'distance_time' || eqRow.inputMode === 'timed') {
				v = s.durationMin ?? 0;
			} else if (eqRow.inputMode === 'weight_distance') {
				const d = s.extras?.distance;
				v = typeof d === 'number' ? d : 0;
			} else {
				v = effectiveSetLoad(s);
			}
			if (v <= 0) continue;
			const cur = perSession.get(s.workoutSessionId) ?? 0;
			if (v > cur) perSession.set(s.workoutSessionId, v);
		}
		// Reorder by session start time (we don't have it directly; use the
		// row order from `sets` which is by ts DESC — first occurrence of a
		// session id is its newest set, so iterating gives us sessions newest
		// first; reverse for chronological).
		const seenSessionOrder: string[] = [];
		for (const s of own) {
			if (!seenSessionOrder.includes(s.workoutSessionId)) {
				seenSessionOrder.push(s.workoutSessionId);
			}
		}
		const sparklineSeries = seenSessionOrder
			.reverse()
			.map((sid) => perSession.get(sid))
			.filter((v): v is number => typeof v === 'number')
			.slice(-10);

		let prValue: number | null = null;
		if (eqRow.inputMode === 'distance_time') {
			for (const s of own) {
				const d = s.extras?.distance;
				if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
					if (prValue == null || d > prValue) prValue = d;
				}
			}
		} else if (eqRow.inputMode === 'timed') {
			for (const s of own) {
				const d = s.durationMin;
				if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
					if (prValue == null || d > prValue) prValue = d;
				}
			}
		} else if (
			eqRow.inputMode === 'timed_weighted' ||
			eqRow.inputMode === 'weight_distance'
		) {
			for (const s of own) {
				const w = s.weight;
				if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
					if (prValue == null || w > prValue) prValue = w;
				}
			}
		} else {
			for (const s of own) {
				const v = effectiveSetLoad(s);
				if (v > 0) {
					if (prValue == null || v > prValue) prValue = v;
				}
			}
		}

		const lastBw = last?.extras?.bwLoadKg;
		const lastDistanceRaw = last?.extras?.distance;
		return {
			id: ex.id,
			name: ex.name,
			isHidden: ex.isHidden,
			lastWeight: last?.weight ?? null,
			lastReps: last?.reps ?? null,
			lastDurationMin: last?.durationMin ?? null,
			lastDistance:
				typeof lastDistanceRaw === 'number' && Number.isFinite(lastDistanceRaw)
					? lastDistanceRaw
					: null,
			lastBwLoadKg: typeof lastBw === 'number' && Number.isFinite(lastBw) ? lastBw : null,
			commonWeights,
			sparklineSeries,
			prValue
		};
	});

	// Pick the session whose set list this page should show:
	//   - live mode: the user's most recent open session (existing behavior).
	//   - date-mode: any session for this user on the picked calendar day,
	//     scoped to this equipment's gym so we only show sets the user could
	//     have logged here.
	let activeSession: { id: string; startedAt: Date } | undefined;
	if (asOfTs != null) {
		const dayStart = startOfUtcDay(asOfTs);
		const dayEnd = dayStart + 86_400_000;
		activeSession = (
			await db
				.select({ id: workoutSession.id, startedAt: workoutSession.startedAt })
				.from(workoutSession)
				.where(
					and(
						eq(workoutSession.userId, locals.user.id),
						eq(workoutSession.gymId, eqRow.gymId),
						gte(workoutSession.startedAt, new Date(dayStart)),
						lt(workoutSession.startedAt, new Date(dayEnd))
					)
				)
				.orderBy(asc(workoutSession.startedAt))
				.limit(1)
		)[0];
	} else {
		activeSession = (
			await db
				.select({ id: workoutSession.id, startedAt: workoutSession.startedAt })
				.from(workoutSession)
				.where(and(eq(workoutSession.userId, locals.user.id), isNull(workoutSession.endedAt)))
				.orderBy(desc(workoutSession.startedAt))
				.limit(1)
		)[0];
	}

	const sessionSets =
		activeSession != null
			? sets.filter((s) => s.workoutSessionId === activeSession.id).reverse()
			: [];

	const profile = (
		await db
			.select({ bodyWeightKg: user.bodyWeightKg })
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1)
	)[0];

	return {
		userId: locals.user.id,
		equipment: eqRow,
		exercises: exercises.map((ex) => ({ id: ex.id, name: ex.name, isHidden: ex.isHidden })),
		contexts,
		openSessionId: activeSession?.id ?? null,
		openSessionStartedAt: activeSession?.startedAt.getTime() ?? null,
		sessionSets: sessionSets.map((s) => ({
			id: s.id,
			exerciseId: s.exerciseId,
			weight: s.weight,
			reps: s.reps,
			durationMin: s.durationMin,
			extras: s.extras,
			ts: s.ts.getTime()
		})),
		bodyWeightKg: profile?.bodyWeightKg ?? null,
		asOfTs
	};
};
