import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { consumeInvite, validateInviteToken } from '$lib/server/invites';

// Render the password-set form when the token is valid; render an
// "invalid or expired" page otherwise. We don't 404 — a friendly page
// with a "request a new link" hint is the right UX. The token is in the
// URL path, so we treat it as opaque and don't echo it back to the page.

export const load: PageServerLoad = async ({ params }) => {
	const tokenParam = params.token;
	if (!tokenParam) throw error(404, 'invite not found');

	const validated = await validateInviteToken(tokenParam);
	if (!validated) {
		return { valid: false as const };
	}
	const u = (
		await db
			.select({ email: user.email, name: user.name })
			.from(user)
			.where(eq(user.id, validated.userId))
			.limit(1)
	)[0];
	if (!u) return { valid: false as const };
	return {
		valid: true as const,
		email: u.email,
		name: u.name
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const tokenParam = params.token;
		if (!tokenParam) throw error(404, 'invite not found');

		const data = await request.formData();
		const newPassword = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (newPassword.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters.' });
		}
		if (newPassword !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		const validated = await validateInviteToken(tokenParam);
		if (!validated) {
			return fail(410, { error: 'This invite link is invalid or has expired.' });
		}

		const u = (
			await db
				.select({ id: user.id, email: user.email })
				.from(user)
				.where(eq(user.id, validated.userId))
				.limit(1)
		)[0];
		if (!u) return fail(410, { error: 'This invite link is invalid or has expired.' });

		// Replace the random invite-time password on the credential account
		// with the recipient's chosen password. Going via Better Auth's hasher
		// keeps the hash format identical to one a normal sign-up would produce.
		const hashed = await hashPassword(newPassword);
		await db
			.update(account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(eq(account.userId, u.id));

		await consumeInvite(tokenParam);

		// Hand off to the standard sign-in form. Pre-fill the email and route
		// the post-sign-in redirect at first-run so the new user lands at gym
		// setup. We deliberately don't auto-sign-in here: routing the cookie
		// through the form action complicates Better Auth's session handling
		// for marginal UX gain.
		const next = encodeURIComponent('/setup/first-run');
		const emailQ = encodeURIComponent(u.email);
		throw redirect(303, `/login?email=${emailQ}&next=${next}&fresh=1`);
	}
};
