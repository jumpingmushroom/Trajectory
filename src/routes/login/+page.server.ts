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

	// Pre-fill email after invite acceptance or password reset. Validate
	// shape minimally (presence of '@') so we don't echo arbitrary input.
	const emailParam = url.searchParams.get('email');
	const emailPrefill =
		emailParam && emailParam.includes('@') && emailParam.length <= 200 ? emailParam : null;
	const fresh = url.searchParams.get('fresh') === '1';
	const reset = url.searchParams.get('reset') === '1';

	return { next, redirected, emailPrefill, fresh, reset };
};
