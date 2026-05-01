import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Defense in depth — hooks.server.ts already enforces this. Repeating it
// here means a misconfigured hook (e.g. someone accidentally narrowing the
// path prefix) doesn't silently expose the admin pages.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	if (locals.user.role !== 'admin') throw error(403, 'Admin only');
	return {};
};
