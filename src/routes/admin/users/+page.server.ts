import type { PageServerLoad } from './$types';
import { desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account, invite, user } from '$lib/server/db/schema';

export interface AdminUserRow {
	id: string;
	email: string;
	name: string;
	role: string;
	createdAt: number;
	// 'invited' if there's a non-consumed, non-expired invite outstanding;
	// otherwise 'active'. A user with no `account.password` after invite
	// expiry would technically be locked out — admin can resend invite.
	status: 'invited' | 'active';
	hasPendingInvite: boolean;
}

export const load: PageServerLoad = async () => {
	const users = await db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(desc(user.createdAt));

	const pending = await db
		.select({ userId: invite.userId })
		.from(invite)
		.where(isNull(invite.consumedAt));
	const pendingSet = new Set(pending.map((p) => p.userId));

	// A "consumed any account password" check is enough to mark as active
	// since a user without a credential account is, by definition, still
	// in the invite-pending state.
	const passworded = (await db
		.select({ userId: account.userId })
		.from(account)
		.where(isNotNull(account.password))) as { userId: string }[];
	const passwordedSet = new Set(passworded.map((p) => p.userId));

	const rows: AdminUserRow[] = users.map((u) => ({
		id: u.id,
		email: u.email,
		name: u.name,
		role: u.role,
		createdAt: u.createdAt.getTime(),
		status: passwordedSet.has(u.id) && !pendingSet.has(u.id) ? 'active' : 'invited',
		hasPendingInvite: pendingSet.has(u.id)
	}));

	return { users: rows };
};
