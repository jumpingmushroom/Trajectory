// POST /api/admin/recompute
// Re-derives is_pr + achievements for every user from current data and
// reconciles the stored rows to match (award newly-earned, silently revoke
// no-longer-earned, rewrite is_pr to chronological semantics). Idempotent —
// safe to run repeatedly; intended as a one-time backfill after shipping the
// recompute-on-edit feature, and as the self-serve equivalent of the manual
// SQL fixes that used to require SSH.
//
// Authorisation: hooks.server.ts already blocks /api/admin/* on role !== admin;
// this re-checks as defense in depth.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { recomputeUser } from '$lib/server/recompute';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'admin only');

	const users = await db.select({ id: user.id }).from(user);
	for (const u of users) {
		// One transaction per user so a failure on one doesn't strand a
		// half-reconciled state across the others.
		db.transaction((tx) => {
			recomputeUser(tx, u.id);
		});
	}
	return json({ recomputed: users.length });
};
