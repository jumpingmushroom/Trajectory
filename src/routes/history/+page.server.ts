import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	gym,
	equipment,
	exercise,
	set as setTable,
	workoutSession
} from '$lib/server/db/schema';
import { isNull, eq, and, desc, asc } from 'drizzle-orm';

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
		.where(isNull(gym.deletedAt))
		.orderBy(asc(gym.createdAt));
	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const sessions = await db
		.select()
		.from(workoutSession)
		.where(eq(workoutSession.userId, locals.user.id))
		.orderBy(desc(workoutSession.startedAt));

	const sessionIds = sessions.map((s) => s.id);

	// All sets for this user's sessions, joined to equipment for the names.
	const sessionSets = sessionIds.length
		? ((await db
				.select({
					sessionId: setTable.workoutSessionId,
					weight: setTable.weight,
					reps: setTable.reps,
					durationMin: setTable.durationMin,
					ts: setTable.ts,
					equipmentId: exercise.equipmentId,
					equipmentName: equipment.name
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(and(eq(setTable.userId, locals.user.id), isNull(setTable.deletedAt)))
				.orderBy(asc(setTable.ts))) as {
				sessionId: string;
				weight: number | null;
				reps: number | null;
				durationMin: number | null;
				ts: Date;
				equipmentId: string;
				equipmentName: string;
			}[])
		: [];

	// Group sets by session for summary metrics.
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
	for (const s of sessionSets) {
		const cur = summaries.get(s.sessionId) ?? {
			machineOrder: [] as string[],
			machineNames: new Map<string, string>(),
			setCount: 0,
			totalVolume: 0,
			cardioDurationMin: 0,
			lastSetTs: null as number | null
		};
		if (!cur.machineNames.has(s.equipmentId)) {
			cur.machineNames.set(s.equipmentId, s.equipmentName);
			cur.machineOrder.push(s.equipmentId);
		}
		cur.setCount += 1;
		if (s.weight != null && s.reps != null) {
			cur.totalVolume += s.weight * s.reps;
		}
		if (s.durationMin != null) {
			cur.cardioDurationMin += s.durationMin;
		}
		const tsMs = s.ts.getTime();
		if (cur.lastSetTs == null || tsMs > cur.lastSetTs) cur.lastSetTs = tsMs;
		summaries.set(s.sessionId, cur);
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
	const heatmap = sessionSummaries.reduce<Record<string, Record<number, number>>>(
		(acc, s) => {
			if (s.dayOffset >= 84) return acc;
			const all = (acc.all ??= {});
			all[s.dayOffset] = (all[s.dayOffset] ?? 0) + 1;
			const byGym = (acc[s.gymId] ??= {});
			byGym[s.dayOffset] = (byGym[s.dayOffset] ?? 0) + 1;
			return acc;
		},
		{}
	);

	return {
		userName: locals.user.name,
		gyms,
		sessions: sessionSummaries,
		heatmap
	};
};
