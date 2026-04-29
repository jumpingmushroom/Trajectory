// Seed users from SEED_USERS env var on first boot.
// Format: name1:password1,name2:password2
// - name is used as both display name and email local-part (name@trajectory.local).
// - The user is created via Better Auth's sign-up flow so the password is hashed correctly.
// - mustChangePassword is set on the user row so the first login forces a reset.
// - Only runs when the user table is empty; subsequent boots are no-ops.

import { db } from './db/index';
import { user } from './db/schema';
import { auth } from './auth';
import { eq, sql } from 'drizzle-orm';

let seedAttempted = false;

interface SeedSpec {
	name: string;
	email: string;
	password: string;
}

function parseSeedUsers(raw: string): SeedSpec[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.map((entry) => {
			const idx = entry.indexOf(':');
			if (idx <= 0) {
				throw new Error(`SEED_USERS entry "${entry}" must be name:password`);
			}
			const name = entry.slice(0, idx).trim();
			const password = entry.slice(idx + 1);
			if (!name || !password) {
				throw new Error(`SEED_USERS entry "${entry}" has empty name or password`);
			}
			return {
				name,
				email: `${name.toLowerCase()}@trajectory.local`,
				password
			};
		});
}

export async function seedUsersIfEmpty(): Promise<void> {
	if (seedAttempted) return;
	seedAttempted = true;

	const raw = process.env.SEED_USERS;
	if (!raw) {
		console.log('[trajectory] SEED_USERS not set — skipping seed');
		return;
	}

	const existing = (
		(await db.select({ n: sql<number>`count(*)` }).from(user)) as { n: number }[]
	)[0]?.n;
	if (existing && existing > 0) {
		console.log(`[trajectory] user table has ${existing} row(s) — skipping seed`);
		return;
	}

	let specs: SeedSpec[];
	try {
		specs = parseSeedUsers(raw);
	} catch (err) {
		console.error('[trajectory] SEED_USERS parse failed:', err);
		return;
	}

	console.log(`[trajectory] seeding ${specs.length} user(s)...`);
	for (const spec of specs) {
		try {
			await auth.api.signUpEmail({
				body: {
					email: spec.email,
					password: spec.password,
					name: spec.name
				}
			});
			// Force password change on first login.
			await db
				.update(user)
				.set({ mustChangePassword: true })
				.where(eq(user.email, spec.email));
			console.log(`[trajectory] seeded user: ${spec.name} <${spec.email}>`);
		} catch (err) {
			console.error(`[trajectory] failed to seed ${spec.name}:`, err);
		}
	}
}
