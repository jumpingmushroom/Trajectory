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
const DISTRIBUTION_WINDOW = 30 * DAY_MS;

export interface MachineCard {
	equipmentId: string;
	name: string;
	type: string;
	glyph: string;
	tint: string;
	cardioKind: string | null;
	series: number[];
	delta: number;
	unit: 'kg' | 'min';
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
		ts: Date;
	}>;

	// Distribution by muscle group over last 30 days.
	const cutoff = Date.now() - DISTRIBUTION_WINDOW;
	const groupCounts: Record<string, number> = { push: 0, pull: 0, legs: 0, cardio: 0 };
	for (const s of sets) {
		if (s.ts.getTime() < cutoff) continue;
		const g = s.equipmentGroup;
		if (g in groupCounts) groupCounts[g] += 1;
	}

	// Per-equipment top-set series (last 15 sessions). Cardio uses
	// durationMin instead of weight.
	const perEquipment = new Map<
		string,
		{
			meta: Pick<
				MachineCard,
				'name' | 'type' | 'glyph' | 'tint' | 'cardioKind'
			>;
			perSession: Map<string, { value: number; ts: number }>;
			isCardio: boolean;
		}
	>();
	for (const s of sets) {
		const isCardio = s.equipmentType === 'cardio';
		const v = isCardio ? (s.durationMin ?? 0) : (s.weight ?? 0);
		if (v <= 0) continue;
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
				perSession: new Map(),
				isCardio
			};
			perEquipment.set(s.equipmentId, row);
		}
		const cur = row.perSession.get(s.workoutSessionId);
		const tsMs = s.ts.getTime();
		if (!cur || v > cur.value) {
			row.perSession.set(s.workoutSessionId, { value: v, ts: tsMs });
		}
	}

	const machineCards: MachineCard[] = [...perEquipment.entries()]
		.map(([equipmentId, row]) => {
			const series = [...row.perSession.values()]
				.sort((a, b) => a.ts - b.ts)
				.slice(-15)
				.map((p) => p.value);
			const delta = series.length > 1 ? series[series.length - 1] - series[0] : 0;
			return {
				equipmentId,
				name: row.meta.name,
				type: row.meta.type,
				glyph: row.meta.glyph,
				tint: row.meta.tint,
				cardioKind: row.meta.cardioKind,
				series,
				delta,
				unit: row.isCardio ? 'min' : 'kg'
			} satisfies MachineCard;
		})
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

	return {
		userName: locals.user.name,
		groupCounts,
		groupMax: Math.max(...Object.values(groupCounts), 1),
		machineCards
	};
};
