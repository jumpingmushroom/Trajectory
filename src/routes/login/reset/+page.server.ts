import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';

// /login/reset: a single page with two modes.
//   1. No `?token=…` → email-request form. Submitting calls Better Auth's
//      requestPasswordReset; BA fires sendResetPassword (mailer.ts).
//   2. `?token=…` present → new-password form. Submitting calls BA's
//      resetPassword to set the new password and invalidate the token.
//
// Both paths return the same generic "if your email is registered, …"
// success message to avoid email enumeration.

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	const errorParam = url.searchParams.get('error');
	return {
		mode: token ? ('confirm' as const) : ('request' as const),
		token: token ?? null,
		linkError: errorParam === 'INVALID_TOKEN' ? 'Reset link is invalid or expired.' : null
	};
};

export const actions: Actions = {
	request: async ({ request, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim().toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, { error: 'Enter a valid email.', email });
		}
		try {
			await auth.api.requestPasswordReset({
				body: {
					email,
					// Same path; the page switches to confirm-mode when ?token= is set.
					redirectTo: `${url.origin}/login/reset`
				}
			});
		} catch (err) {
			// BA may throw on rate limits or send failures. Surface generic so
			// no enumeration is possible.
			console.error('[trajectory] requestPasswordReset failed:', err);
		}
		return { sent: true as const, email };
	},

	confirm: async ({ request }) => {
		const data = await request.formData();
		const token = String(data.get('token') ?? '');
		const newPassword = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');
		if (!token) return fail(400, { error: 'Missing reset token.' });
		if (newPassword.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters.' });
		}
		if (newPassword !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}
		try {
			await auth.api.resetPassword({
				body: { newPassword, token }
			});
		} catch (err) {
			console.error('[trajectory] resetPassword failed:', err);
			return fail(410, { error: 'Reset link is invalid or expired.' });
		}
		throw redirect(303, '/login?reset=1');
	}
};
