import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	gym,
	equipment,
	exercise,
	set as setTable,
	type Equipment,
	type Gym
} from '$lib/server/db/schema';
import { isNull, eq, and, desc, asc, sql } from 'drizzle-orm';
import { resolveActiveGym } from '$lib/server/active-gym';
import pkg from '../../package.json' with { type: 'json' };

export interface EquipmentTileMeta {
	equipment: Equipment;
	lastWeight: number | null;
	lastReps: number | null;
	lastDurationMin: number | null;
	lastTs: number | null;
	daysSince: number | null;
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/login');

	const gyms = await db
		.select()
		.from(gym)
		.where(isNull(gym.deletedAt))
		.orderBy(desc(gym.isPrimary), asc(gym.createdAt));

	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const activeGym = (await resolveActiveGym(cookies)) ?? gyms[0];

	const equipments = await db
		.select()
		.from(equipment)
		.where(and(isNull(equipment.deletedAt), eq(equipment.gymId, activeGym.id)))
		.orderBy(asc(equipment.sortOrder), asc(equipment.createdAt));

	// Last-set-per-equipment for the current user. One query, group in JS.
	// At 2 users × ~1000 sets/year scale this is well under a millisecond.
	const lastSetsRaw = equipments.length
		? ((await db
				.select({
					equipmentId: exercise.equipmentId,
					weight: setTable.weight,
					reps: setTable.reps,
					durationMin: setTable.durationMin,
					ts: setTable.ts
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(
					and(
						eq(setTable.userId, locals.user.id),
						isNull(setTable.deletedAt),
						isNull(exercise.deletedAt)
					)
				)
				.orderBy(desc(setTable.ts))) as {
				equipmentId: string;
				weight: number | null;
				reps: number | null;
				durationMin: number | null;
				ts: Date;
			}[])
		: [];

	const lastByEquipment = new Map<string, (typeof lastSetsRaw)[number]>();
	for (const row of lastSetsRaw) {
		if (!lastByEquipment.has(row.equipmentId)) {
			lastByEquipment.set(row.equipmentId, row);
		}
	}

	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	const tiles: EquipmentTileMeta[] = equipments.map((eq) => {
		const last = lastByEquipment.get(eq.id);
		const ts = last ? last.ts.getTime() : null;
		return {
			equipment: eq,
			lastWeight: last?.weight ?? null,
			lastReps: last?.reps ?? null,
			lastDurationMin: last?.durationMin ?? null,
			lastTs: ts,
			daysSince: ts == null ? null : Math.max(0, Math.floor((now - ts) / dayMs))
		};
	});

	return {
		userName: locals.user.name,
		userId: locals.user.id,
		version: pkg.version,
		gyms: gyms as Gym[],
		activeGym,
		tiles
	};
};
