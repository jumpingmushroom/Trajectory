// Per-device, per-user "active gym" resolution. Reads the cookie set by
// /api/active-gym; falls back to the gym marked isPrimary, then to the
// most-recent gym. Returns null if the user has no gyms.

import { eq, isNull, and, desc } from 'drizzle-orm';
import { db } from './db';
import { gym, type Gym } from './db/schema';

export const ACTIVE_GYM_COOKIE = 'trajectory_active_gym';

export async function resolveActiveGym(
	cookies: { get: (name: string) => string | undefined }
): Promise<Gym | null> {
	const cookieValue = cookies.get(ACTIVE_GYM_COOKIE) ?? null;
	if (cookieValue) {
		const fromCookie = (
			await db
				.select()
				.from(gym)
				.where(and(eq(gym.id, cookieValue), isNull(gym.deletedAt)))
				.limit(1)
		)[0];
		if (fromCookie) return fromCookie;
	}
	// Fallback: primary first, then most-recently-created.
	const fallback = (
		await db
			.select()
			.from(gym)
			.where(isNull(gym.deletedAt))
			.orderBy(desc(gym.isPrimary), desc(gym.createdAt))
			.limit(1)
	)[0];
	return fallback ?? null;
}
