// Better Auth server config — email/password + admin plugin + reset-password
// email hook. v0.2 multiuser: no public sign-up surface (admins create users
// via the invite flow), reset-password is self-service via email.

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from './db/index';
import { user, session, account, verification } from './db/schema';
import { sendResetPasswordEmail } from './mailer';

// Secret resolution is intentionally non-throwing here so SvelteKit's
// build-time analyse step (which imports server modules with
// NODE_ENV=production but no app env vars) can complete. The real
// guard runs in hooks.server.ts on first request.
const baseURL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
// Sentinel string used as the dev fallback. Exported so hooks.server.ts
// can refuse it in production even when BETTER_AUTH_SECRET is "set" but
// to this known-public value (e.g. compose default leaked into prod).
export const DEV_SECRET_SENTINEL =
	'dev-only-insecure-secret-please-set-BETTER_AUTH_SECRET-in-prod';
const secret = process.env.BETTER_AUTH_SECRET ?? DEV_SECRET_SENTINEL;

export const auth = betterAuth({
	baseURL,
	secret,
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: { user, session, account, verification }
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: false,
		// Public sign-up is closed under v0.2 multiuser; admins create users
		// via the invite flow. We DON'T set `disableSignUp: true` here because
		// it also blocks the server-side `auth.api.signUpEmail` call we use
		// during admin seed and invite creation. Instead, `hooks.server.ts`
		// blocks the public POST /api/auth/sign-up/email route.
		minPasswordLength: 6,
		// Self-service password reset: BA fires this when /request-password-reset
		// is POSTed with a known email. The `url` argument already includes the
		// reset token as a query parameter, pointing at the redirectTo we send.
		sendResetPassword: async ({ user, url }) => {
			await sendResetPasswordEmail({ to: user.email, url });
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24 // refresh once per day
	},
	advanced: {
		cookiePrefix: 'trajectory'
	},
	plugins: [
		// Admin plugin: adds role/banned/banReason/banExpires to user, plus
		// /admin/* server endpoints (createUser, listUsers, removeUser, …).
		// We only surface a subset in the UI (list, invite, remove); the rest
		// are available for future scope without additional plumbing.
		admin()
	]
});

export type Session = typeof auth.$Infer.Session;
