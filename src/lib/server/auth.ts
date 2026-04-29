// Better Auth server config — email/password only, no social providers,
// custom `mustChangePassword` field on user, Drizzle/SQLite adapter.

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index';
import { user, session, account, verification } from './db/schema';

const baseURL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
const secret =
	process.env.BETTER_AUTH_SECRET ??
	(process.env.NODE_ENV === 'production'
		? (() => {
				throw new Error('BETTER_AUTH_SECRET must be set in production');
			})()
		: 'dev-only-insecure-secret-please-set-BETTER_AUTH_SECRET-in-prod');

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
