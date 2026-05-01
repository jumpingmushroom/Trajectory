// POST /api/active-gym  body: { gymId }
// Per-device "active gym" selection. Stored in a cookie so each phone
// or browser can have its own pick — the active-gym chip is local UI
// state, not a per-user setting. Server reads the cookie in load
// functions to filter the equipment grid.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUlid } from '$lib/server/ulid';
import { db } from '$lib/server/db';
import { gym } from '$lib/server/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { ACTIVE_GYM_COOKIE } from '$lib/server/active-gym';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	const body = (await request.json().catch(() => null)) as { gymId?: string } | null;
	if (!body?.gymId || !isUlid(body.gymId)) throw error(400, 'invalid gymId');

	const exists = (
		await db
			.select({ id: gym.id })
			.from(gym)
			.where(
				and(
					eq(gym.id, body.gymId),
					eq(gym.userId, locals.user.id),
					isNull(gym.deletedAt)
				)
			)
			.limit(1)
	)[0];
	if (!exists) throw error(404, 'gym not found');

	cookies.set(ACTIVE_GYM_COOKIE, body.gymId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 365
	});
	return json({ ok: true });
};
