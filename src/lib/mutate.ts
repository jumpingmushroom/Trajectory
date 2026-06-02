// Client-side helper for posting mutations through /api/mutate.
// All writes flow through the IndexedDB queue (M10) so a network blip
// at the gym doesn't drop a logged set. The API contract is idempotent
// on (clientId, mutationId) so replays are safe.

import { ulid } from 'ulid';
import { enqueue } from './sync/queue';
import { drainNow } from './sync/sync';
import { refreshPendingCount } from './sync/status';

export interface MutationResult<T = unknown> {
	replayed: boolean;
	result: T;
	queued: boolean;
	// True when the server permanently rejected this mutation (4xx) and the
	// drainer dropped it. `queued` is false in this case too, so callers must
	// check `discarded` to tell a real save apart from a discarded one.
	discarded: boolean;
}

/**
 * Mint a mutationId, enqueue it locally, and immediately try to flush
 * the queue. Returns `{ queued: true }` when the network is down (or the
 * server returns a transient error); the queued mutation will retry on
 * its own with exponential backoff and eventually drain.
 *
 * Callers should treat the return as best-effort: by the time it
 * resolves, either the mutation made it to the server (queued: false)
 * or it's safely sitting in IndexedDB waiting to retry (queued: true).
 */
export async function mutate<T = unknown>(
	op: string,
	payload: unknown
): Promise<MutationResult<T>> {
	const entry = await enqueue(op, payload);
	await refreshPendingCount();
	const drainResult = await drainNow();
	if (drainResult.discardedIds.includes(entry.mutationId)) {
		// Server permanently rejected this exact mutation; it's already been
		// dropped from the queue with a toast. Tell the caller so it doesn't
		// treat the rejection as a successful save.
		return { replayed: false, result: null as T, queued: false, discarded: true };
	}
	if (drainResult.drained === 0 && drainResult.remaining > 0) {
		return { replayed: false, result: null as T, queued: true, discarded: false };
	}
	return { replayed: false, result: null as T, queued: false, discarded: false };
}

export { ulid };
