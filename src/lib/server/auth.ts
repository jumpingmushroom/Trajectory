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
		minPasswordLength: 8,
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
	// Rate limiting. Better Auth only enables this in production by default,
	// so dev (`pnpm dev` + smoke tests) is unaffected. Storage is in-memory,
	// which is fine for the single-container deploy: the table doesn't need
	// to survive a restart, and there's no second process to share state
	// with. The global window/max acts as a coarse DoS shield; the explicit
	// `customRules` cover the credential-attack and email-spam surfaces that
	// matter most for a public-facing self-hosted instance.
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
		customRules: {
			// Credential stuffing: 10 attempts per 5 minutes per IP. Better
			// Auth's matcher is path-prefix based, so this also catches
			// /sign-in/email/* if any future variant is added.
			'/sign-in/email': { window: 300, max: 10 },
			// Password-reset email spam: 5 requests per hour per IP. Reset
			// emails are expensive (SMTP round-trip) and the endpoint
			// silently succeeds on unknown emails, so it's tempting bait.
			'/request-password-reset': { window: 3600, max: 5 },
			// Forgot-password verification: same posture as sign-in to
			// throttle token-guessing if a leaked email lands in an attacker's
			// hands.
			'/reset-password': { window: 300, max: 10 }
		}
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
