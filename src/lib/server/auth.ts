// Better Auth server config — email/password only, no social providers,
// custom `mustChangePassword` field on user, Drizzle/SQLite adapter.

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index';
import { user, session, account, verification } from './db/schema';

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
		minPasswordLength: 6
	},
	user: {
		additionalFields: {
			mustChangePassword: {
				type: 'boolean',
				required: false,
				defaultValue: false,
				input: false
			}
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24 // refresh once per day
	},
	advanced: {
		cookiePrefix: 'trajectory'
	}
});

export type Session = typeof auth.$Infer.Session;
