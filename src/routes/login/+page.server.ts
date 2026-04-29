import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Only accept same-origin paths. `//evil.com` would otherwise be a
	// host-controlled redirect target.
	const raw = url.searchParams.get('next');
	const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	return { next };
};
