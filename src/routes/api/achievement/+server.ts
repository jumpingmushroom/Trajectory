// GET /api/achievement
// Read-only list of the authenticated user's awarded achievements.
// Used by the smoke test to assert evaluator behavior; the Stats
// gallery loads the same data via its server load function.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { achievement } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');

	const rows = (await db
		.select({
			id: achievement.id,
			badgeKey: achievement.badgeKey,
			unlockedAt: achievement.unlockedAt,
			seenAt: achievement.seenAt
		})
		.from(achievement)
		.where(eq(achievement.userId, locals.user.id))
		.orderBy(desc(achievement.unlockedAt))) as {
		id: string;
		badgeKey: string;
		unlockedAt: Date;
		seenAt: Date | null;
	}[];

	return json({
		earned: rows.map((r) => ({
			id: r.id,
			badgeKey: r.badgeKey,
			unlockedAt: r.unlockedAt.getTime(),
			seenAt: r.seenAt?.getTime() ?? null
		}))
	});
};
