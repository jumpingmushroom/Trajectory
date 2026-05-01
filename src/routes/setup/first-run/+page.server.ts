import { fail, redirect } from '@sveltejs/kit';
import { ulid } from 'ulid';
import { db } from '$lib/server/db';
import { gym } from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const existingCount = (
		(await db
			.select({ n: sql<number>`count(*)` })
			.from(gym)
			.where(and(eq(gym.userId, locals.user.id), isNull(gym.deletedAt)))) as { n: number }[]
	)[0]?.n;
	if (existingCount && existingCount > 0) {
		throw redirect(303, '/');
	}
	return { userName: locals.user.name };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const city = String(data.get('city') ?? '').trim();

		if (!name) {
			return fail(400, { name, city, error: 'Gym name is required.' });
		}

		const id = ulid();
		await db.insert(gym).values({
			id,
			userId: locals.user.id,
			name,
			city: city || null,
			tint: '#1c2026',
			isPrimary: true
		});
		throw redirect(303, '/');
	}
};
