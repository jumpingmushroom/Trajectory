import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Called by /login/change-password after a successful password change to
// clear the seed-time `mustChangePassword` flag for the current user.
// Authentication is enforced by hooks.server.ts before reaching here.

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ ok: false }, { status: 401 });
	}
	await db
		.update(user)
		.set({ mustChangePassword: false })
		.where(eq(user.id, locals.user.id));
	return json({ ok: true });
};
