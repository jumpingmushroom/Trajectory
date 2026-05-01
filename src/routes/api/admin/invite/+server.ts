import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { createInvite } from '$lib/server/invites';
import { sendInviteEmail } from '$lib/server/mailer';

// POST /api/admin/invite  body: { email, name }
//   - Creates the user via Better Auth's signUpEmail with a random password
//     the recipient never sees. This produces both the user row and the
//     credential account row.
//   - Mints a single-use invite token and emails it.
//   - The recipient's chosen password replaces the random one when they
//     accept the invite.
//
// Authorisation is layered:
//   - hooks.server.ts blocks /api/admin/* unless role === 'admin'.
//   - /admin/+layout.server.ts repeats the check for the page bundle.
//   - This handler also rejects unauthenticated callers as defense in depth.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'admin only');

	const body = (await request.json().catch(() => null)) as
		| { email?: unknown; name?: unknown }
		| null;
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
	const name = typeof body?.name === 'string' ? body.name.trim() : '';

	if (!EMAIL_RE.test(email) || email.length > 254) {
		throw error(400, 'invalid email');
	}
	if (!name || name.length > 80) {
		throw error(400, 'name required (max 80 chars)');
	}

	const existing = (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1))[0];
	if (existing) throw error(409, 'a user with that email already exists');

	// 256-bit random initial password the recipient never learns. They will
	// overwrite it when they finish the invite flow.
	const tempPassword = randomBytes(32).toString('base64url');

	try {
		await auth.api.signUpEmail({
			body: { email, password: tempPassword, name }
		});
	} catch (err) {
		console.error('[trajectory] signUpEmail failed during invite:', err);
		throw error(500, 'could not create user');
	}

	const created = (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1))[0];
	if (!created) throw error(500, 'user vanished after sign-up');

	const { token } = await createInvite(created.id);
	const inviteUrl = `${url.origin}/invite/${token}`;
	try {
		await sendInviteEmail({ to: email, name, url: inviteUrl });
	} catch (err) {
		console.error('[trajectory] sendInviteEmail failed:', err);
		// Don't roll the user back: the admin can re-send the invite.
	}

	return json({ ok: true, userId: created.id });
};
