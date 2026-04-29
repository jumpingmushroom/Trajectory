// Better Auth catch-all: forwards every /api/auth/* request to the
// auth handler so sign-in / sign-up / session endpoints work.

import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request }) => auth.handler(request);

export const GET = handler;
export const POST = handler;
