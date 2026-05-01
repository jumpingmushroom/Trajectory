// Layout-wide server load. Currently only ships unread-achievement
// metadata so <AchievementHost /> can pop a celebration modal on the
// next render after a badge is awarded. Runs on every navigation —
// the query is single-indexed and cheap.

import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { achievement } from '$lib/server/db/schema';
import { and, eq, isNull, asc } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { achievementQueue: [], isAdmin: false };
	}
	const rows = await db
		.select({ id: achievement.id, badgeKey: achievement.badgeKey })
		.from(achievement)
		.where(and(eq(achievement.userId, locals.user.id), isNull(achievement.seenAt)))
		.orderBy(asc(achievement.unlockedAt));
	return { achievementQueue: rows, isAdmin: locals.user.role === 'admin' };
};
