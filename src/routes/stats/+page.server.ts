import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	equipment,
	exercise,
	set as setTable
} from '$lib/server/db/schema';
import { isNull, eq, and, asc } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_30D = 30 * DAY_MS;

export interface MachineCard {
	equipmentId: string;
	name: string;
	type: string;
	glyph: string;
	tint: string;
	cardioKind: string | null;
	series: number[];
	delta: number;
	lastValue: number;
	unit: 'kg' | 'km' | 'min';
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

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const sets = (await db
		.select({
			equipmentId: equipment.id,
			equipmentName: equipment.name,
			equipmentType: equipment.type,
			equipmentGlyph: equipment.glyph,
			equipmentTint: equipment.tint,
			equipmentGroup: equipment.group,
			equipmentCardioKind: equipment.cardioKind,
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
		workoutSessionId: string;
		weight: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		ts: Date;
	}>;

	const cutoff30 = Date.now() - WINDOW_30D;

	// Strength distribution by muscle group over last 30 days. Cardio gets
	// its own dedicated section below; counting cardio "sets" alongside
	// strength sets is misleading (1 cardio set ≈ 45 min, 1 leg set ≈ 30 s).
	const groupCounts: Record<string, number> = { push: 0, pull: 0, legs: 0 };
	for (const s of sets) {
		if (s.ts.getTime() < cutoff30) continue;
		if (s.equipmentType === 'cardio') continue;
		const g = s.equipmentGroup;
		if (g in groupCounts) groupCounts[g] += 1;
	}

	// Cardio summary over last 30 days: top-line totals + per-equipment rows.
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
		if (s.ts.getTime() < cutoff30) continue;
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
			meta: Pick<MachineCard, 'name' | 'type' | 'glyph' | 'tint' | 'cardioKind'>;
			isCardio: boolean;
			distancePerSession: Map<string, SessionPoint>;
			durationPerSession: Map<string, SessionPoint>;
			weightPerSession: Map<string, SessionPoint>;
			lastTs: number;
		}
	>();
	for (const s of sets) {
		const isCardio = s.equipmentType === 'cardio';
		const tsMs = s.ts.getTime();
		let row = perEquipment.get(s.equipmentId);
		if (!row) {
			row = {
				meta: {
					name: s.equipmentName,
					type: s.equipmentType,
					glyph: s.equipmentGlyph,
					tint: s.equipmentTint,
					cardioKind: s.equipmentCardioKind
				},
				isCardio,
				distancePerSession: new Map(),
				durationPerSession: new Map(),
				weightPerSession: new Map(),
				lastTs: 0
			};
			perEquipment.set(s.equipmentId, row);
		}
		if (tsMs > row.lastTs) row.lastTs = tsMs;

		if (isCardio) {
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
		} else {
			const w = s.weight ?? 0;
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
			let unit: 'kg' | 'km' | 'min';
			let pointsMap: Map<string, SessionPoint>;
			if (row.isCardio) {
				if (row.distancePerSession.size > 0) {
					unit = 'km';
					pointsMap = row.distancePerSession;
				} else {
					unit = 'min';
					pointsMap = row.durationPerSession;
				}
			} else {
				unit = 'kg';
				pointsMap = row.weightPerSession;
			}
			const points = [...pointsMap.values()]
				.sort((a, b) => a.ts - b.ts)
				.slice(-15);
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

	return {
		userName: locals.user.name,
		groupCounts,
		groupMax: Math.max(...Object.values(groupCounts), 1),
		cardioSummary,
		machineCards
	};
};
