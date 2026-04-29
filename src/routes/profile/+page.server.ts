import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pkg from '../../../package.json' with { type: 'json' };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	return {
		userName: locals.user.name,
		userEmail: locals.user.email,
		version: pkg.version,
		buildSha: process.env.TRAJECTORY_BUILD_SHA ?? 'dev'
	};
};
