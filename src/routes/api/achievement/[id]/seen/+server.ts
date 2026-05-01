// POST /api/achievement/[id]/seen
// Single-purpose endpoint: mark a badge as seen so the modal queue stops
// re-showing it on next page load. Not run through /api/mutate because
// this is UI-state, not a domain mutation — no idempotency dance needed.
// The `WHERE seen_at IS NULL` guard makes a double-tap a no-op.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { achievement } from '$lib/server/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { isUlid } from '$lib/server/ulid';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	const id = params.id;
	if (!id || !isUlid(id)) throw error(400, 'invalid achievement id');

	await db
		.update(achievement)
		.set({ seenAt: new Date() })
		.where(
			and(
				eq(achievement.id, id),
				eq(achievement.userId, locals.user.id),
				isNull(achievement.seenAt)
			)
		);
	return json({ ok: true });
};
