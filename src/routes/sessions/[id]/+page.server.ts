import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	gym,
	equipment,
	exercise,
	set as setTable,
	workoutSession,
	type Equipment
} from '$lib/server/db/schema';
import { isNull, eq, and, asc } from 'drizzle-orm';
import { effectiveSetLoad } from '$lib/server/db/effective-load';

export interface SessionDetailEquipmentBlock {
	equipment: Pick<Equipment, 'id' | 'name' | 'type' | 'glyph' | 'tint' | 'cardioKind'>;
	sets: Array<{
		id: string;
		exerciseName: string;
		exerciseIsHidden: boolean;
		weight: number | null;
		reps: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		ts: number;
	}>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const id = params.id;
	if (!id) throw error(404, 'session not found');

	const session = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.id, id), eq(workoutSession.userId, locals.user.id)))
			.limit(1)
	)[0];
	if (!session) throw error(404, 'session not found');

	const gymRow = (await db.select().from(gym).where(eq(gym.id, session.gymId)).limit(1))[0];

	const sets = (await db
		.select({
			id: setTable.id,
			weight: setTable.weight,
			reps: setTable.reps,
			durationMin: setTable.durationMin,
			extras: setTable.extras,
			ts: setTable.ts,
			exerciseId: exercise.id,
			exerciseName: exercise.name,
			exerciseIsHidden: exercise.isHidden,
			equipmentId: equipment.id,
			equipmentName: equipment.name,
			equipmentType: equipment.type,
			equipmentGlyph: equipment.glyph,
			equipmentTint: equipment.tint,
			equipmentCardioKind: equipment.cardioKind
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.where(and(eq(setTable.workoutSessionId, id), isNull(setTable.deletedAt)))
		.orderBy(asc(setTable.ts))) as Array<{
		id: string;
		weight: number | null;
		reps: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		ts: Date;
		exerciseId: string;
		exerciseName: string;
		exerciseIsHidden: boolean;
		equipmentId: string;
		equipmentName: string;
		equipmentType: string;
		equipmentGlyph: string;
		equipmentTint: string;
		equipmentCardioKind: string | null;
	}>;

	// Group by equipment, preserving first-seen order.
	const order: string[] = [];
	const blocks = new Map<string, SessionDetailEquipmentBlock>();
	for (const s of sets) {
		if (!blocks.has(s.equipmentId)) {
			order.push(s.equipmentId);
			blocks.set(s.equipmentId, {
				equipment: {
					id: s.equipmentId,
					name: s.equipmentName,
					type: s.equipmentType,
					glyph: s.equipmentGlyph,
					tint: s.equipmentTint,
					cardioKind: s.equipmentCardioKind
				},
				sets: []
			});
		}
		blocks.get(s.equipmentId)!.sets.push({
			id: s.id,
			exerciseName: s.exerciseName,
			exerciseIsHidden: s.exerciseIsHidden,
			weight: s.weight,
			reps: s.reps,
			durationMin: s.durationMin,
			extras: s.extras,
			ts: s.ts.getTime()
		});
	}

	const totalVolume = sets.reduce(
		(a, s) =>
			a +
			(s.reps != null && (s.weight != null || s.extras?.bwLoadKg != null)
				? effectiveSetLoad(s) * s.reps
				: 0),
		0
	);
	const lastTs = sets.length > 0 ? sets[sets.length - 1].ts.getTime() : null;
	const startedAt = session.startedAt.getTime();
	const endedAt = session.endedAt?.getTime() ?? null;
	const wallClockMin = Math.round(((lastTs ?? endedAt ?? Date.now()) - startedAt) / 60000);
	const cardioMin = sets.reduce((a, s) => a + (s.durationMin ?? 0), 0);
	const durationMin = Math.max(1, wallClockMin, cardioMin);

	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const sessionDay = new Date(startedAt);
	sessionDay.setHours(0, 0, 0, 0);
	const dayOffset = Math.max(0, Math.round((todayStart.getTime() - sessionDay.getTime()) / DAY_MS));

	return {
		session: {
			id: session.id,
			gymId: session.gymId,
			gymName: gymRow?.name ?? 'Unknown gym',
			startedAt,
			endedAt,
			durationMin,
			dayOffset,
			machineCount: order.length,
			setCount: sets.length,
			totalVolume: Math.round(totalVolume),
			isOpen: session.endedAt == null
		},
		blocks: order.map((id) => blocks.get(id)!)
	};
};
