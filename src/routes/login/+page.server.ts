import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		next: url.searchParams.get('next') ?? '/'
	};
};
