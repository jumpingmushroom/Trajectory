import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	equipment,
	exercise,
	set as setTable,
	workoutSession
} from '$lib/server/db/schema';
import { isUlid } from '$lib/server/ulid';
import { isNull, eq, and, asc, desc, inArray, gte, lt } from 'drizzle-orm';
import { parseAsOfTs, startOfUtcDay, endOfUtcDay } from '$lib/dateMode';

export interface ExerciseContext {
	id: string;
	name: string;
	isHidden: boolean;
	lastWeight: number | null;
	lastReps: number | null;
	lastDurationMin: number | null;
	commonWeights: number[];
	sparklineSeries: number[];
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(303, '/login');
	const id = params.id;
	if (!id || !isUlid(id)) throw error(404, 'not found');

	const asOfTs = parseAsOfTs(url.searchParams);

	const eqRow = (
		await db
			.select()
			.from(equipment)
			.where(and(eq(equipment.id, id), isNull(equipment.deletedAt)))
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

	const sets = ((await db
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
	}[]);

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

		// Top-set per session, oldest first, last 10.
		const perSession = new Map<string, number>();
		for (const s of own) {
			const v = eqRow.type === 'cardio' ? (s.durationMin ?? 0) : (s.weight ?? 0);
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

		return {
			id: ex.id,
			name: ex.name,
			isHidden: ex.isHidden,
			lastWeight: last?.weight ?? null,
			lastReps: last?.reps ?? null,
			lastDurationMin: last?.durationMin ?? null,
			commonWeights,
			sparklineSeries
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
		asOfTs
	};
};
