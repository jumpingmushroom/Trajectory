// Server-side request lifecycle:
// 1. Ensure data dir + bind-mount sentinel exist.
// 2. Apply pending Drizzle migrations + take pre-migration snapshot (D9).
// 3. Seed first admin from ADMIN_EMAIL/ADMIN_PASSWORD on empty database.
// 4. Populate event.locals.session/user from Better Auth.
// 5. Redirect unauthenticated traffic to /login (except public paths).
// 6. Gate /admin/* on role === 'admin'.
// 7. Hand off to Better Auth's svelteKitHandler so /api/auth/* works.

import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { auth, DEV_SECRET_SENTINEL } from '$lib/server/auth';
import { ensureMigrations } from '$lib/server/db/migrate';
import { seedAdminIfEmpty } from '$lib/server/seedAdmin';

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
			if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
				throw new Error(
					'SMTP_HOST and SMTP_FROM must be set in production (invites + password reset rely on email)'
				);
			}
		}
		ensurePlaceholder();
		await ensureMigrations();
		await seedAdminIfEmpty();
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
		pathname.startsWith('/invite/') ||
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

	// Block public sign-up. Admins create users via /admin/users → /api/admin/invite,
	// which calls signUpEmail server-side. The /api/auth/sign-up/email route is
	// what a client would hit directly; refuse it outright.
	if (pathname.startsWith('/api/auth/sign-up')) {
		throw error(403, 'Sign-up is admin-only on this instance');
	}

	// Auth gate.
	if (!event.locals.user && !isPublicPath(pathname)) {
		throw redirect(303, `/login?next=${encodeURIComponent(pathname)}`);
	}

	// Admin gate. Path-prefix match covers /admin and any nested route +
	// matching API endpoints under /api/admin/*.
	const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
	if (isAdminPath && event.locals.user?.role !== 'admin') {
		throw error(403, 'Admin only');
	}

	// Already-signed-in users hitting /login go home.
	if (event.locals.user && pathname === '/login') {
		throw redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
