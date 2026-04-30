import { redirect } from '@sveltejs/kit';
import { isNull, eq, asc, sql, inArray, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { gym, equipment, exercise, set as setTable } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';
import pkg from '../../../package.json' with { type: 'json' };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const gyms = await db
		.select()
		.from(gym)
		.where(isNull(gym.deletedAt))
		.orderBy(asc(gym.createdAt));

	if (gyms.length === 0) throw redirect(303, '/setup/first-run');

	const gymIds = gyms.map((g) => g.id);
	const equipments = await db
		.select()
		.from(equipment)
		.where(and(isNull(equipment.deletedAt), inArray(equipment.gymId, gymIds)))
		.orderBy(asc(equipment.sortOrder), asc(equipment.createdAt));

	const equipmentIds = equipments.map((e) => e.id);
	const exercises = equipmentIds.length
		? await db
				.select()
				.from(exercise)
				.where(and(isNull(exercise.deletedAt), inArray(exercise.equipmentId, equipmentIds)))
				.orderBy(asc(exercise.sortOrder), asc(exercise.createdAt))
		: [];

	// Per-equipment set count (for delete-confirmation messaging).
	const setCounts = equipmentIds.length
		? ((await db
				.select({
					equipmentId: exercise.equipmentId,
					count: sql<number>`count(${setTable.id})`
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(
					and(isNull(setTable.deletedAt), inArray(exercise.equipmentId, equipmentIds))
				)
				.groupBy(exercise.equipmentId)) as { equipmentId: string; count: number }[])
		: [];

	const setCountByEquipment: Record<string, number> = {};
	for (const row of setCounts) setCountByEquipment[row.equipmentId] = row.count;

	return {
		userName: locals.user.name,
		version: pkg.version,
		gyms,
		equipments,
		exercises,
		setCountByEquipment
	};
};
