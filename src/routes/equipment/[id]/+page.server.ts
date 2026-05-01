import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	equipment,
	exercise,
	gym,
	set as setTable
} from '$lib/server/db/schema';
import { isNull, eq, and, asc, inArray } from 'drizzle-orm';

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
				ts: Date;
				sessionId: string;
				exerciseId: string;
			}[])
		: [];

	// Per-session top weight for the LineChart series. Cardio rows feed
	// duration_min instead of weight so the chart still has a series.
	const isCardio = eqRow.type === 'cardio';
	const perSession = new Map<string, { value: number; ts: number }>();
	for (const s of sets) {
		const v = isCardio ? (s.durationMin ?? 0) : (s.weight ?? 0);
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

	// Meta tile values.
	const sessionsCount = perSession.size;
	const setsCount = sets.length;
	const pr = sets.reduce<number | null>((best, s) => {
		const v = s.weight;
		if (v == null) return best;
		if (best == null || v > best) return v;
		return best;
	}, null);
	const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	const daysSinceLast =
		lastSet == null ? null : Math.max(0, Math.floor((now - lastSet.ts.getTime()) / dayMs));

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
		daysSinceLast
	};
};
