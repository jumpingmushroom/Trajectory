// Single-use invite tokens for admin-issued accounts.
//
// Lifecycle:
//   1. Admin posts /api/admin/invite → user row + invite row created.
//   2. Email goes out with link <base>/invite/<token>.
//   3. Recipient opens link → page calls validateInviteToken → if OK, shows
//      password-set form.
//   4. Recipient submits → consumeInvite + Better Auth password set + sign-in.
//
// Tokens are 32 bytes of CSPRNG, base64url-encoded → 43 chars URL-safe.
// Expiry is fixed at 7 days; resending an invite mints a fresh token and
// abandons the old one (unique-on-token; we update the row).

import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/index';
import { invite, type Invite } from './db/schema';
import { newUlid } from './ulid';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(): string {
	return randomBytes(32).toString('base64url');
}

export async function createInvite(userId: string): Promise<{ token: string }> {
	const token = generateToken();
	await db.insert(invite).values({
		id: newUlid(),
		userId,
		token,
		expiresAt: new Date(Date.now() + SEVEN_DAYS_MS)
	});
	return { token };
}

// Replace any outstanding invites for a user with a fresh one. Used by the
// admin "Resend invite" action — the old token stops working immediately.
export async function rotateInvite(userId: string): Promise<{ token: string }> {
	await db.delete(invite).where(eq(invite.userId, userId));
	return createInvite(userId);
}

interface ValidatedInvite {
	id: string;
	userId: string;
	token: string;
}

export async function validateInviteToken(token: string): Promise<ValidatedInvite | null> {
	const rows = (await db.select().from(invite).where(eq(invite.token, token)).limit(1)) as Invite[];
	const row = rows[0];
	if (!row) return null;
	if (row.consumedAt) return null;
	if (row.expiresAt.getTime() <= Date.now()) return null;
	return { id: row.id, userId: row.userId, token: row.token };
}

export async function consumeInvite(token: string): Promise<void> {
	await db.update(invite).set({ consumedAt: new Date() }).where(eq(invite.token, token));
}
