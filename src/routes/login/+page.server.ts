import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Only accept same-origin paths. `//evil.com` would otherwise be a
	// host-controlled redirect target.
	const raw = url.searchParams.get('next');
	const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	// `redirected` is true whenever the auth gate sent the user here from
	// somewhere they were trying to reach. The login page uses it to show
	// a "Session expired" banner, distinguishing it from a fresh visit.
	const redirected = raw != null && next !== '/';
	return { next, redirected };
};
