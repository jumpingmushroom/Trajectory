import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';
import pkg from '../../../package.json' with { type: 'json' };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	// Better Auth's locals.user doesn't carry our additional columns (we
	// don't register them via the SDK's additionalFields machinery — see
	// auth.ts). Read the row directly for non-auth fields.
	const profile = (
		await db
			.select({ bodyWeightKg: user.bodyWeightKg })
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1)
	)[0];
	return {
		userName: locals.user.name,
		userEmail: locals.user.email,
		userImage: locals.user.image ?? null,
		userRole: locals.user.role ?? 'user',
		bodyWeightKg: profile?.bodyWeightKg ?? null,
		version: pkg.version,
		buildSha: process.env.TRAJECTORY_BUILD_SHA ?? 'dev'
	};
};
