import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { achievement } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const rows = (await db
		.select({ badgeKey: achievement.badgeKey, unlockedAt: achievement.unlockedAt })
		.from(achievement)
		.where(eq(achievement.userId, locals.user.id))
		.orderBy(desc(achievement.unlockedAt))) as { badgeKey: string; unlockedAt: Date }[];

	return {
		earnedAchievements: rows.map((r) => ({
			badgeKey: r.badgeKey,
			unlockedAt: r.unlockedAt.getTime()
		}))
	};
};
