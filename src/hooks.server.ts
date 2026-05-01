// Server-side request lifecycle:
// 1. Ensure data dir + bind-mount sentinel exist (M1 carryover).
// 2. Apply pending Drizzle migrations + take pre-migration snapshot (D9).
// 3. Seed users from SEED_USERS env on empty database (M2).
// 4. Populate event.locals.session/user from Better Auth.
// 5. Redirect unauthenticated traffic to /login (except /login* and /api/auth/*).
// 6. Hand off to Better Auth's svelteKitHandler so /api/auth/* works.

import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { auth, DEV_SECRET_SENTINEL } from '$lib/server/auth';
import { ensureMigrations } from '$lib/server/db/migrate';
import { seedUsersIfEmpty } from '$lib/server/seed';

const DATA_DIR = process.env.TRAJECTORY_DATA_DIR ?? 'data';
const PLACEHOLDER = join(DATA_DIR, '.placeholder');

let placeholderEnsured = false;
function ensurePlaceholder() {
	if (placeholderEnsured) return;
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		if (!existsSync(PLACEHOLDER)) {
			writeFileSync(
				PLACEHOLDER,
				`Trajectory bind-mount sentinel.\nCreated: ${new Date().toISOString()}\n`
			);
		}
		placeholderEnsured = true;
		console.log(`[trajectory] data dir ready: ${DATA_DIR}`);
	} catch (err) {
		console.error(`[trajectory] failed to ensure ${PLACEHOLDER}:`, err);
	}
}

// Singleton-promise pattern so concurrent first requests await the same
// boot rather than each running migrations + seed in parallel.
let bootPromise: Promise<void> | null = null;
async function ensureBoot() {
	if (bootPromise) return bootPromise;
	bootPromise = (async () => {
		if (process.env.NODE_ENV === 'production') {
			const secret = process.env.BETTER_AUTH_SECRET;
			if (!secret) {
				throw new Error('BETTER_AUTH_SECRET must be set in production');
			}
			if (secret === DEV_SECRET_SENTINEL) {
				throw new Error(
					'BETTER_AUTH_SECRET is set to the dev fallback value — generate a real secret before going to production'
				);
			}
		}
		ensurePlaceholder();
		await ensureMigrations();
		await seedUsersIfEmpty();
	})();
	try {
		await bootPromise;
	} catch (err) {
		// Reset so a future request can retry; otherwise a transient migration
		// failure would brick the server until restart.
		bootPromise = null;
		throw err;
	}
}

function isPublicPath(pathname: string): boolean {
	return (
		pathname === '/login' ||
		pathname.startsWith('/login/') ||
		pathname.startsWith('/api/auth/') ||
		pathname === '/api/health'
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!building) await ensureBoot();

	// Attach session + user to locals.
	const sessionData = await auth.api.getSession({ headers: event.request.headers });
	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;
	}

	const { pathname } = event.url;

	// Force password change for users flagged on seed. The clear-flag and
	// auth endpoints are whitelisted so the user can complete the change.
	if (
		event.locals.user?.mustChangePassword &&
		pathname !== '/login/change-password' &&
		!pathname.startsWith('/api/auth/') &&
		pathname !== '/api/profile/clear-must-change'
	) {
		throw redirect(303, '/login/change-password');
	}

	// Auth gate.
	if (!event.locals.user && !isPublicPath(pathname)) {
		throw redirect(303, `/login?next=${encodeURIComponent(pathname)}`);
	}

	// Already-signed-in users hitting /login go home.
	if (event.locals.user && pathname === '/login') {
		throw redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
