import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { achievement, equipment, exercise, set as setTable } from '$lib/server/db/schema';
import { isNull, eq, and, asc, desc } from 'drizzle-orm';
import { effectiveSetLoad } from '$lib/server/db/effective-load';

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = {
	'7d': 7 * DAY_MS,
	'30d': 30 * DAY_MS,
	'3mo': 90 * DAY_MS,
	'6mo': 180 * DAY_MS,
	'1y': 365 * DAY_MS,
	all: null
} as const;
export type RangeKey = keyof typeof RANGES;

const RANGE_LABEL: Record<RangeKey, string> = {
	'7d': 'last 7 days',
	'30d': 'last 30 days',
	'3mo': 'last 3 months',
	'6mo': 'last 6 months',
	'1y': 'last year',
	all: 'lifetime'
};

export interface MachineCard {
	equipmentId: string;
	name: string;
	type: string;
	glyph: string;
	tint: string;
	cardioKind: string | null;
	inputMode: string;
	series: number[];
	delta: number;
	lastValue: number;
	unit: 'kg' | 'km' | 'min' | 'm';
}

export interface CardioEquipmentRow {
	equipmentId: string;
	name: string;
	glyph: string;
	tint: string;
	cardioKind: string | null;
	totalMin: number;
	sessions: number;
	totalKm: number;
}

export interface CardioSummary {
	totalMin: number;
	sessions: number;
	totalKm: number;
	rows: CardioEquipmentRow[];
}

// Normalize an `extras.distance` value to km. The Log UI stores km for
// treadmill/bike/generic and meters for rower. Mirrors the heuristic in
// CardioRow.svelte: big integer => meters, otherwise km.
function distanceKm(extras: Record<string, number> | null | undefined): number | null {
	if (!extras) return null;
	const d = extras.distance;
	if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return null;
	if (d >= 200 && Number.isInteger(d)) return d / 1000;
	return d;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const raw = url.searchParams.get('range') ?? '30d';
	const range: RangeKey = raw in RANGES ? (raw as RangeKey) : '30d';
	const windowMs = RANGES[range];
	const cutoff = windowMs === null ? 0 : Date.now() - windowMs;

	const sets = (await db
		.select({
			equipmentId: equipment.id,
			equipmentName: equipment.name,
			equipmentType: equipment.type,
			equipmentGlyph: equipment.glyph,
			equipmentTint: equipment.tint,
			equipmentGroup: equipment.group,
			equipmentCardioKind: equipment.cardioKind,
			equipmentInputMode: equipment.inputMode,
			workoutSessionId: setTable.workoutSessionId,
			weight: setTable.weight,
			durationMin: setTable.durationMin,
			extras: setTable.extras,
			ts: setTable.ts
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.where(
			and(
				eq(setTable.userId, locals.user.id),
				isNull(setTable.deletedAt),
				isNull(exercise.deletedAt),
				isNull(equipment.deletedAt)
			)
		)
		.orderBy(asc(setTable.ts))) as Array<{
		equipmentId: string;
		equipmentName: string;
		equipmentType: string;
		equipmentGlyph: string;
		equipmentTint: string;
		equipmentGroup: string;
		equipmentCardioKind: string | null;
		equipmentInputMode: string;
		workoutSessionId: string;
		weight: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		ts: Date;
	}>;

	// Strength distribution by muscle group over the selected range. Cardio gets
	// its own dedicated section below; counting cardio "sets" alongside
	// strength sets is misleading (1 cardio set ≈ 45 min, 1 leg set ≈ 30 s).
	const groupCounts: Record<string, number> = {
		push: 0,
		pull: 0,
		legs: 0,
		core: 0,
		arms: 0,
		shoulders: 0,
		glutes: 0
	};
	for (const s of sets) {
		if (s.ts.getTime() < cutoff) continue;
		if (s.equipmentInputMode === 'distance_time') continue;
		const g = s.equipmentGroup;
		if (g in groupCounts) groupCounts[g] += 1;
	}

	// Cardio summary over the selected range: top-line totals + per-equipment rows.
	let cardioTotalMin = 0;
	let cardioTotalKm = 0;
	const cardioSessionIds = new Set<string>();
	const perCardioEquipment = new Map<
		string,
		{
			meta: Pick<CardioEquipmentRow, 'name' | 'glyph' | 'tint' | 'cardioKind'>;
			totalMin: number;
			sessions: Set<string>;
			totalKm: number;
		}
	>();
	for (const s of sets) {
		if (s.equipmentType !== 'cardio') continue;
		if (s.ts.getTime() < cutoff) continue;
		const min = s.durationMin ?? 0;
		const km = distanceKm(s.extras) ?? 0;
		cardioTotalMin += min;
		cardioTotalKm += km;
		cardioSessionIds.add(s.workoutSessionId);
		let row = perCardioEquipment.get(s.equipmentId);
		if (!row) {
			row = {
				meta: {
					name: s.equipmentName,
					glyph: s.equipmentGlyph,
					tint: s.equipmentTint,
					cardioKind: s.equipmentCardioKind
				},
				totalMin: 0,
				sessions: new Set(),
				totalKm: 0
			};
			perCardioEquipment.set(s.equipmentId, row);
		}
		row.totalMin += min;
		row.totalKm += km;
		row.sessions.add(s.workoutSessionId);
	}

	const cardioRows: CardioEquipmentRow[] = [...perCardioEquipment.entries()]
		.map(([equipmentId, row]) => ({
			equipmentId,
			name: row.meta.name,
			glyph: row.meta.glyph,
			tint: row.meta.tint,
			cardioKind: row.meta.cardioKind,
			totalMin: row.totalMin,
			sessions: row.sessions.size,
			totalKm: row.totalKm
		}))
		.sort((a, b) => b.totalMin - a.totalMin);

	const cardioSummary: CardioSummary = {
		totalMin: cardioTotalMin,
		sessions: cardioSessionIds.size,
		totalKm: cardioTotalKm,
		rows: cardioRows
	};

	// Per-equipment top-set series (last 15 sessions). Strength uses weight,
	// cardio prefers distance and falls back to duration when no session in
	// the series has a usable distance.
	type SessionPoint = { value: number; ts: number };
	const perEquipment = new Map<
		string,
		{
			meta: Pick<MachineCard, 'name' | 'type' | 'glyph' | 'tint' | 'cardioKind' | 'inputMode'>;
			distancePerSession: Map<string, SessionPoint>;
			durationPerSession: Map<string, SessionPoint>;
			weightPerSession: Map<string, SessionPoint>;
			lastTs: number;
		}
	>();
	for (const s of sets) {
		const tsMs = s.ts.getTime();
		if (tsMs < cutoff) continue;
		let row = perEquipment.get(s.equipmentId);
		if (!row) {
			row = {
				meta: {
					name: s.equipmentName,
					type: s.equipmentType,
					glyph: s.equipmentGlyph,
					tint: s.equipmentTint,
					cardioKind: s.equipmentCardioKind,
					inputMode: s.equipmentInputMode
				},
				distancePerSession: new Map(),
				durationPerSession: new Map(),
				weightPerSession: new Map(),
				lastTs: 0
			};
			perEquipment.set(s.equipmentId, row);
		}
		if (tsMs > row.lastTs) row.lastTs = tsMs;

		const mode = s.equipmentInputMode;
		if (mode === 'distance_time') {
			const km = distanceKm(s.extras);
			if (km !== null) {
				const cur = row.distancePerSession.get(s.workoutSessionId);
				if (!cur || km > cur.value) {
					row.distancePerSession.set(s.workoutSessionId, { value: km, ts: tsMs });
				}
			}
			const min = s.durationMin ?? 0;
			if (min > 0) {
				const cur = row.durationPerSession.get(s.workoutSessionId);
				if (!cur || min > cur.value) {
					row.durationPerSession.set(s.workoutSessionId, { value: min, ts: tsMs });
				}
			}
		} else if (mode === 'timed') {
			const min = s.durationMin ?? 0;
			if (min > 0) {
				const cur = row.durationPerSession.get(s.workoutSessionId);
				if (!cur || min > cur.value) {
					row.durationPerSession.set(s.workoutSessionId, { value: min, ts: tsMs });
				}
			}
		} else {
			// weighted | bodyweight | timed_weighted | weight_distance —
			// chart the same axis evaluatePr uses for is_pr (effective load).
			const w = effectiveSetLoad(s);
			if (w > 0) {
				const cur = row.weightPerSession.get(s.workoutSessionId);
				if (!cur || w > cur.value) {
					row.weightPerSession.set(s.workoutSessionId, { value: w, ts: tsMs });
				}
			}
		}
	}

	const machineCards: MachineCard[] = [...perEquipment.entries()]
		.map(([equipmentId, row]) => {
			let unit: 'kg' | 'km' | 'min' | 'm';
			let pointsMap: Map<string, SessionPoint>;
			const mode = row.meta.inputMode;
			if (mode === 'distance_time') {
				if (row.distancePerSession.size > 0) {
					unit = 'km';
					pointsMap = row.distancePerSession;
				} else {
					unit = 'min';
					pointsMap = row.durationPerSession;
				}
			} else if (mode === 'timed') {
				unit = 'min';
				pointsMap = row.durationPerSession;
			} else {
				// weighted | bodyweight | timed_weighted | weight_distance
				unit = 'kg';
				pointsMap = row.weightPerSession;
			}
			const points = [...pointsMap.values()].sort((a, b) => a.ts - b.ts).slice(-30);
			const series = points.map((p) => p.value);
			const delta = series.length > 1 ? series[series.length - 1] - series[0] : 0;
			const lastValue = series.length > 0 ? series[series.length - 1] : 0;
			return {
				equipmentId,
				name: row.meta.name,
				type: row.meta.type,
				glyph: row.meta.glyph,
				tint: row.meta.tint,
				cardioKind: row.meta.cardioKind,
				inputMode: row.meta.inputMode,
				series,
				delta,
				lastValue,
				unit,
				lastTs: row.lastTs
			};
		})
		.filter((m) => m.series.length > 0)
		.sort((a, b) => b.lastTs - a.lastTs)
		.map(({ lastTs: _lastTs, ...card }) => card satisfies MachineCard);

	// Earned achievement keys + unlock timestamps for this user. The
	// definitions array is the source of truth for visible-locked entries
	// (rendered client-side); we only ship what the user has actually
	// unlocked plus the timestamp so the gallery can sort and date.
	const earnedRows = (await db
		.select({ badgeKey: achievement.badgeKey, unlockedAt: achievement.unlockedAt })
		.from(achievement)
		.where(eq(achievement.userId, locals.user.id))
		.orderBy(desc(achievement.unlockedAt))) as { badgeKey: string; unlockedAt: Date }[];
	const earnedAchievements = earnedRows.map((r) => ({
		badgeKey: r.badgeKey,
		unlockedAt: r.unlockedAt.getTime()
	}));

	return {
		userName: locals.user.name,
		range,
		rangeLabel: RANGE_LABEL[range],
		groupCounts,
		groupMax: Math.max(...Object.values(groupCounts), 1),
		cardioSummary,
		machineCards,
		earnedAchievements
	};
};
