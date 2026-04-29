import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { gym } from '$lib/server/db/schema';
import { isNull, sql, desc } from 'drizzle-orm';
import pkg from '../../package.json' with { type: 'json' };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const gymCount = (
		(await db
			.select({ n: sql<number>`count(*)` })
			.from(gym)
			.where(isNull(gym.deletedAt))) as { n: number }[]
	)[0]?.n ?? 0;

	if (gymCount === 0) {
		throw redirect(303, '/setup/first-run');
	}

	const primary = (
		await db
			.select()
			.from(gym)
			.where(isNull(gym.deletedAt))
			.orderBy(desc(gym.isPrimary), desc(gym.createdAt))
			.limit(1)
	)[0];

	return {
		userName: locals.user.name,
		gymName: primary?.name ?? 'Your gym',
		gymCity: primary?.city ?? null,
		version: pkg.version
	};
};
