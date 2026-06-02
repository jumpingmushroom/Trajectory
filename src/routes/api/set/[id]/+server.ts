// GET /api/set/[id]
// Read-only fetch of a single set owned by the authenticated user, including
// the recomputed is_pr flag. Used by the smoke test to assert PR recomputation
// after edits/deletes (is_pr isn't otherwise exposed over HTTP). Owner-scoped:
// another user's set 404s the same as a missing one.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { set as setTable } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	const row = (
		await db
			.select({
				id: setTable.id,
				weight: setTable.weight,
				reps: setTable.reps,
				durationMin: setTable.durationMin,
				extras: setTable.extras,
				isPr: setTable.isPr,
				deletedAt: setTable.deletedAt
			})
			.from(setTable)
			.where(and(eq(setTable.id, params.id), eq(setTable.userId, locals.user.id)))
			.limit(1)
	)[0];
	if (!row) throw error(404, 'set not found');
	return json({
		id: row.id,
		weight: row.weight,
		reps: row.reps,
		durationMin: row.durationMin,
		extras: row.extras,
		isPr: row.isPr,
		deletedAt: row.deletedAt ? row.deletedAt.getTime() : null
	});
};
