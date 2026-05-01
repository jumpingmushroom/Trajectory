// Seed the first admin from env on first boot.
// Format: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password>
// - Only runs when the user table is empty; subsequent boots are no-ops.
// - The user is created via Better Auth's sign-up flow so the password is
//   hashed correctly, then `role` is flipped to 'admin'.
// - Replaces the v0.1 SEED_USERS pattern. There is no `mustChangePassword`
//   flag anymore; the admin can change their password via /profile.

import { db } from './db/index';
import { user } from './db/schema';
import { auth } from './auth';
import { eq, sql } from 'drizzle-orm';

let seedAttempted = false;

export async function seedAdminIfEmpty(): Promise<void> {
	if (seedAttempted) return;
	seedAttempted = true;

	const email = process.env.ADMIN_EMAIL;
	const password = process.env.ADMIN_PASSWORD;

	if (!email || !password) {
		console.log('[trajectory] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed');
		return;
	}

	const existing = (
		(await db.select({ n: sql<number>`count(*)` }).from(user)) as { n: number }[]
	)[0]?.n;
	if (existing && existing > 0) {
		console.log(`[trajectory] user table has ${existing} row(s) — skipping admin seed`);
		return;
	}

	const name = email.split('@')[0] ?? 'admin';
	console.log(`[trajectory] seeding admin: ${email}`);
	try {
		await auth.api.signUpEmail({
			body: { email, password, name }
		});
		await db.update(user).set({ role: 'admin' }).where(eq(user.email, email));
		console.log(`[trajectory] seeded admin: ${name} <${email}> (role=admin)`);
	} catch (err) {
		console.error(`[trajectory] failed to seed admin ${email}:`, err);
	}
}
