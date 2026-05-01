import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { rotateInvite } from '$lib/server/invites';
import { sendInviteEmail } from '$lib/server/mailer';

// POST /api/admin/users/[id]/resend-invite
//   Mints a fresh invite token (rotateInvite drops any prior one) and
//   re-emails the welcome link. Useful when the original expired or was
//   lost. Accepting the new link supersedes any older link.

export const POST: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'admin only');
	const id = params.id;
	if (!id) throw error(400, 'missing id');

	const target = (
		await db
			.select({ id: user.id, email: user.email, name: user.name })
			.from(user)
			.where(eq(user.id, id))
			.limit(1)
	)[0];
	if (!target) throw error(404, 'user not found');

	const { token } = await rotateInvite(target.id);
	const inviteUrl = `${url.origin}/invite/${token}`;
	try {
		await sendInviteEmail({ to: target.email, name: target.name, url: inviteUrl });
	} catch (err) {
		console.error('[trajectory] resend invite email failed:', err);
		throw error(500, 'could not send email');
	}

	return json({ ok: true });
};
