import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { gym, equipment, exercise, set as setTable, workoutSession } from '$lib/server/db/schema';
import { isNull, eq, and, desc, asc, sql } from 'drizzle-orm';

export interface HistorySessionSummary {
	id: string;
	gymId: string;
	gymName: string;
	startedAt: number;
	endedAt: number | null;
	durationMin: number;
	machineNames: string[];
	machineCount: number;
	setCount: number;
	totalVolume: number;
	dayOffset: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const gyms = await db
		.select()
		.from(gym)
		.where(and(eq(gym.userId, locals.user.id), isNull(gym.deletedAt)))
		.orderBy(asc(gym.createdAt));
	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const sessions = await db
		.select()
		.from(workoutSession)
		.where(eq(workoutSession.userId, locals.user.id))
		.orderBy(desc(workoutSession.startedAt));

	// Per-session summary metrics, aggregated in SQL so we transfer one row per
	// session (numeric) plus one row per distinct machine, rather than every
	// set row for the user's entire history. Tombstone filter mirrors the prior
	// JS pass (set.deletedAt only — deleted equipment's sets still count here,
	// matching pre-existing history behaviour).
	const summaries = new Map<
		string,
		{
			machineOrder: string[];
			machineNames: Map<string, string>;
			setCount: number;
			totalVolume: number;
			cardioDurationMin: number;
			lastSetTs: number | null;
		}
	>();

	// effective load = COALESCE(weight,0) + COALESCE(extras.bwLoadKg,0); volume
	// only counts sets with reps and at least one of weight / bwLoadKg present —
	// identical to the previous effectiveSetLoad(s) * reps accumulation.
	const numericRows = (await db
		.select({
			sessionId: setTable.workoutSessionId,
			setCount: sql<number>`COUNT(*)`,
			lastSetTs: sql<number>`MAX(${setTable.ts})`,
			cardioDurationMin: sql<number>`COALESCE(SUM(CASE WHEN ${equipment.inputMode} = 'distance_time' THEN ${setTable.durationMin} ELSE 0 END), 0)`,
			totalVolume: sql<number>`COALESCE(SUM(CASE WHEN ${setTable.reps} IS NOT NULL AND (${setTable.weight} IS NOT NULL OR json_extract(${setTable.extras}, '$.bwLoadKg') IS NOT NULL) THEN (COALESCE(${setTable.weight}, 0) + COALESCE(json_extract(${setTable.extras}, '$.bwLoadKg'), 0)) * ${setTable.reps} ELSE 0 END), 0)`
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.where(and(eq(setTable.userId, locals.user.id), isNull(setTable.deletedAt)))
		.groupBy(setTable.workoutSessionId)) as {
		sessionId: string;
		setCount: number;
		lastSetTs: number | null;
		cardioDurationMin: number;
		totalVolume: number;
	}[];

	for (const r of numericRows) {
		summaries.set(r.sessionId, {
			machineOrder: [],
			machineNames: new Map<string, string>(),
			setCount: r.setCount,
			totalVolume: r.totalVolume,
			cardioDurationMin: r.cardioDurationMin,
			lastSetTs: r.lastSetTs ?? null
		});
	}

	// Distinct machines per session, ordered by first appearance (MIN ts) so
	// machineOrder reproduces the old first-seen order from the ts-asc scan.
	const machineRows = (await db
		.select({
			sessionId: setTable.workoutSessionId,
			equipmentId: exercise.equipmentId,
			name: equipment.name,
			firstTs: sql<number>`MIN(${setTable.ts})`
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.where(and(eq(setTable.userId, locals.user.id), isNull(setTable.deletedAt)))
		.groupBy(setTable.workoutSessionId, exercise.equipmentId, equipment.name)
		.orderBy(asc(setTable.workoutSessionId), sql`MIN(${setTable.ts}) ASC`)) as {
		sessionId: string;
		equipmentId: string;
		name: string;
		firstTs: number;
	}[];

	for (const m of machineRows) {
		const cur = summaries.get(m.sessionId);
		if (!cur || cur.machineNames.has(m.equipmentId)) continue;
		cur.machineNames.set(m.equipmentId, m.name);
		cur.machineOrder.push(m.equipmentId);
	}

	const gymById = new Map(gyms.map((g) => [g.id, g] as const));
	const now = Date.now();
	const todayStart = new Date(now);
	todayStart.setHours(0, 0, 0, 0);

	const sessionSummaries: HistorySessionSummary[] = sessions
		.map((session) => {
			const sum = summaries.get(session.id);
			const startedAt = session.startedAt.getTime();
			const endedAt = session.endedAt?.getTime() ?? null;
			const lastTs = sum?.lastSetTs ?? endedAt ?? startedAt;
			const wallClockMin = Math.round((lastTs - startedAt) / 60000);
			const cardioMin = sum?.cardioDurationMin ?? 0;
			const durationMin = Math.max(1, wallClockMin, cardioMin);
			const sessionDay = new Date(startedAt);
			sessionDay.setHours(0, 0, 0, 0);
			const dayOffset = Math.max(
				0,
				Math.round((todayStart.getTime() - sessionDay.getTime()) / DAY_MS)
			);
			const gymRow = gymById.get(session.gymId);
			return {
				id: session.id,
				gymId: session.gymId,
				gymName: gymRow?.name ?? 'Unknown gym',
				startedAt,
				endedAt,
				durationMin,
				machineNames: sum ? sum.machineOrder.map((id) => sum.machineNames.get(id) ?? '') : [],
				machineCount: sum?.machineOrder.length ?? 0,
				setCount: sum?.setCount ?? 0,
				totalVolume: sum ? Math.round(sum.totalVolume) : 0,
				dayOffset
			};
		})
		.filter((s) => s.machineCount > 0 || s.endedAt != null);

	// Heatmap: count sessions per day for last 84 days (12 weeks × 7).
	const heatmap = sessionSummaries.reduce<Record<string, Record<number, number>>>((acc, s) => {
		if (s.dayOffset >= 84) return acc;
		const all = (acc.all ??= {});
		all[s.dayOffset] = (all[s.dayOffset] ?? 0) + 1;
		const byGym = (acc[s.gymId] ??= {});
		byGym[s.dayOffset] = (byGym[s.dayOffset] ?? 0) + 1;
		return acc;
	}, {});

	return {
		userName: locals.user.name,
		gyms,
		sessions: sessionSummaries,
		heatmap
	};
};
