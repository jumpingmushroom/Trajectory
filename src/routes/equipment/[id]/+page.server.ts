import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { equipment, exercise, gym, set as setTable, user } from '$lib/server/db/schema';
import { isNull, eq, and, asc, inArray } from 'drizzle-orm';
import { effectiveSetLoad } from '$lib/server/db/effective-load';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const id = params.id;
	if (!id) throw error(404, 'equipment not found');

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
		.orderBy(asc(exercise.sortOrder), asc(exercise.createdAt));
	const exerciseIds = exercises.map((x) => x.id);

	// All current user's sets on any exercise of this equipment, oldest first
	// so we can plot left-to-right.
	const sets = exerciseIds.length
		? ((await db
				.select({
					id: setTable.id,
					weight: setTable.weight,
					reps: setTable.reps,
					durationMin: setTable.durationMin,
					extras: setTable.extras,
					ts: setTable.ts,
					sessionId: setTable.workoutSessionId,
					exerciseId: setTable.exerciseId
				})
				.from(setTable)
				.where(
					and(
						eq(setTable.userId, locals.user.id),
						isNull(setTable.deletedAt),
						inArray(setTable.exerciseId, exerciseIds)
					)
				)
				.orderBy(asc(setTable.ts))) as {
				id: string;
				weight: number | null;
				reps: number | null;
				durationMin: number | null;
				extras: Record<string, number> | null;
				ts: Date;
				sessionId: string;
				exerciseId: string;
			}[])
		: [];

	// Per-session top value for the LineChart series. The axis follows the
	// equipment's inputMode: cardio + timed plot duration; weight_distance
	// plots distance; everything else plots effective load (weight + bw).
	const isCardio = eqRow.type === 'cardio';
	const perSession = new Map<string, { value: number; ts: number }>();
	for (const s of sets) {
		// Chart axis follows the equipment's PR axis (see evaluatePr in
		// mutations.ts) so the progression line and the PR badge reflect the
		// same dimension: cardio + timed plot duration; everything else
		// (including weight_distance carries) plots effective weight.
		let v: number;
		if (eqRow.inputMode === 'distance_time' || eqRow.inputMode === 'timed') {
			v = s.durationMin ?? 0;
		} else {
			v = effectiveSetLoad(s);
		}
		if (v <= 0) continue;
		const cur = perSession.get(s.sessionId);
		if (!cur || v > cur.value) {
			perSession.set(s.sessionId, { value: v, ts: s.ts.getTime() });
		}
	}
	const series = [...perSession.values()]
		.sort((a, b) => a.ts - b.ts)
		.slice(-15)
		.map((p) => p.value);

	// Common weights: top 4 distinct weights ordered by recency (max ts).
	// Keeps the user's typed value (added weight) since that's what the
	// stepper round-trips on tap.
	const recencyByWeight = new Map<number, number>();
	for (const s of sets) {
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

	// Meta tile PR. The axis follows the equipment's inputMode so the
	// metaTile shows the right number for each kind of station: minutes for
	// timed holds, distance for carries, effective load for everything else.
	const sessionsCount = perSession.size;
	const setsCount = sets.length;
	const pr = sets.reduce<number | null>((best, s) => {
		let v: number;
		if (eqRow.inputMode === 'timed') {
			v = s.durationMin ?? 0;
		} else if (eqRow.inputMode === 'distance_time') {
			const d = s.extras?.distance;
			v = typeof d === 'number' ? d : 0;
		} else {
			// weighted | bodyweight | timed_weighted | weight_distance —
			// effective load (weight + bw snapshot) per evaluatePr.
			if (s.weight == null && s.extras?.bwLoadKg == null) return best;
			v = effectiveSetLoad(s);
		}
		if (v <= 0) return best;
		if (best == null || v > best) return v;
		return best;
	}, null);
	const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	const daysSinceLast =
		lastSet == null ? null : Math.max(0, Math.floor((now - lastSet.ts.getTime()) / dayMs));

	const profile = (
		await db
			.select({ bodyWeightKg: user.bodyWeightKg })
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1)
	)[0];

	const lastBwLoadRaw = lastSet?.extras?.bwLoadKg;
	const lastBwLoadKg =
		typeof lastBwLoadRaw === 'number' && Number.isFinite(lastBwLoadRaw) ? lastBwLoadRaw : null;
	const lastDistanceRaw = lastSet?.extras?.distance;
	const lastDistance =
		typeof lastDistanceRaw === 'number' && Number.isFinite(lastDistanceRaw)
			? lastDistanceRaw
			: null;

	return {
		userId: locals.user.id,
		equipment: eqRow,
		exercises,
		series,
		commonWeights,
		sessionsCount,
		setsCount,
		pr,
		lastWeight: lastSet?.weight ?? null,
		lastReps: lastSet?.reps ?? null,
		lastDurationMin: lastSet?.durationMin ?? null,
		lastDistance,
		lastBwLoadKg,
		daysSinceLast,
		bodyWeightKg: profile?.bodyWeightKg ?? null
	};
};
