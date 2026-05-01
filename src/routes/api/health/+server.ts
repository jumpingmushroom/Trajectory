// GET /api/health — cheap reachability probe used by the offline banner
// to verify the server is actually reachable before trusting
// `navigator.onLine === false`. Unauthenticated and side-effect-free so
// it works regardless of session state.

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return new Response(null, { status: 204 });
};
