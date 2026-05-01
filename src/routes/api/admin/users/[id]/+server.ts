import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

// DELETE /api/admin/users/[id]
//   Hard-deletes the user. ON DELETE CASCADE on session/account/workout_session/
//   set/achievement/mutation_log/invite/gym wipes out their entire footprint.
//   Refuses to delete the calling admin (you can't shoot yourself in the foot
//   from this endpoint) and refuses to delete the *last* remaining admin so
//   the instance never ends up with no admins.

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'admin only');
	const id = params.id;
	if (!id) throw error(400, 'missing id');
	if (id === locals.user.id) throw error(400, 'cannot remove yourself');

	const target = (
		await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, id)).limit(1)
	)[0];
	if (!target) throw error(404, 'user not found');

	if (target.role === 'admin') {
		const adminCount = (
			(await db
				.select({ n: sql<number>`count(*)` })
				.from(user)
				.where(eq(user.role, 'admin'))) as { n: number }[]
		)[0]?.n;
		if (!adminCount || adminCount <= 1) {
			throw error(400, 'cannot remove the last admin');
		}
	}

	await db.delete(user).where(eq(user.id, id));
	return json({ ok: true });
};
