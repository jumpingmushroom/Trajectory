// POST /api/mutate
// Single idempotent write surface for the entire app. The client posts
// { clientId, mutationId, op, payload }; the server validates, applies,
// and returns the canonical row. Replays of the same (clientId,
// mutationId) are no-ops. The IndexedDB sync layer (M10) drains its
// queue against this endpoint.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyMutation, type MutationEnvelope } from '$lib/server/mutations';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'unauthenticated');
	}

	let envelope: MutationEnvelope;
	try {
		envelope = (await request.json()) as MutationEnvelope;
	} catch {
		throw error(400, 'invalid JSON body');
	}

	try {
		const result = await applyMutation(envelope, locals.user.id);
		return json(result);
	} catch (err) {
		const status = (err as Error & { status?: number }).status ?? 500;
		const message = (err as Error).message ?? 'unknown error';
		if (status >= 500) {
			console.error('[trajectory] mutation failed:', err);
		}
		throw error(status, message);
	}
};
