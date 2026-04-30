// Drainer: walks the IndexedDB pending-mutations queue and POSTs each
// to /api/mutate. Runs on app open, on `online` event, and after every
// new enqueue. Failed POSTs back off exponentially (1s, 2s, 4s, 8s, 16s,
// 30s thereafter) so a flaky network doesn't busy-loop.

import { invalidateAll } from '$app/navigation';
import { clientId, complete, listPending, recordFailure, pendingCount } from './queue';
import { syncStatus, refreshPendingCount } from './status';

const BACKOFFS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];
const STEADY_BACKOFF_MS = 30_000;

// 4xx codes that are NOT terminal: the same payload may succeed on a later
// attempt once the underlying condition clears. 401 = expired session;
// 408 = request timeout; 425 = server says retry; 429 = rate limit.
// Anything else in 4xx is treated as a permanent client error and dropped
// (with the entry surfaced via authExpired/console for visibility).
const RETRYABLE_4XX = new Set([401, 408, 425, 429]);

let draining = false;
let drainScheduled: ReturnType<typeof setTimeout> | null = null;

function backoffFor(attempts: number): number {
	if (attempts < BACKOFFS_MS.length) return BACKOFFS_MS[attempts];
	return STEADY_BACKOFF_MS;
}

async function postOne(op: string, payload: unknown, mutationId: string): Promise<{
	ok: boolean;
	status: number;
	body: string;
}> {
	try {
		const res = await fetch('/api/mutate', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				clientId: clientId(),
				mutationId,
				op,
				payload
			})
		});
		const body = await res.text();
		return { ok: res.ok, status: res.status, body };
	} catch (err) {
		return {
			ok: false,
			status: 0,
			body: err instanceof Error ? err.message : String(err)
		};
	}
}

function isOnline(): boolean {
	return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function drainNow(): Promise<{ drained: number; remaining: number }> {
	if (draining) return { drained: 0, remaining: await pendingCount() };
	draining = true;
	syncStatus.update((s) => ({ ...s, draining: true }));
	let drained = 0;
	try {
		const queue = await listPending();
		const now = Date.now();
		for (const m of queue) {
			if (m.nextAttemptAt > now) continue;
			const result = await postOne(m.op, m.payload, m.mutationId);
			if (result.ok) {
				await complete(m.mutationId);
				drained += 1;
				// Successful POST means the cookie is valid again, clear the flag.
				syncStatus.update((s) => (s.authExpired ? { ...s, authExpired: false } : s));
			} else if (result.status === 401) {
				// Session expired. Don't drop the mutation — the user's set is
				// safe in IndexedDB. Surface via authExpired so the banner
				// prompts re-sign-in, and stop draining (every subsequent POST
				// would 401 too).
				syncStatus.update((s) => ({ ...s, authExpired: true }));
				await recordFailure(
					m.mutationId,
					`401 unauthenticated (session expired)`,
					Date.now() + STEADY_BACKOFF_MS
				);
				break;
			} else if (RETRYABLE_4XX.has(result.status)) {
				const delay = backoffFor(m.attempts);
				await recordFailure(
					m.mutationId,
					`${result.status} ${result.body || 'retryable'}`,
					Date.now() + delay
				);
				if (drainScheduled) clearTimeout(drainScheduled);
				drainScheduled = setTimeout(() => {
					drainScheduled = null;
					drainNow().catch(() => undefined);
				}, delay);
				break;
			} else if (result.status >= 400 && result.status < 500) {
				// Permanent 4xx (validation, 404, 413). Won't fix itself; drop
				// to avoid an infinite loop. Logged loudly so a debug screen
				// (or `console.error` in DevTools on desktop) surfaces it.
				console.error(`[sync] ${m.op} ${m.mutationId} rejected (${result.status}): ${result.body}`);
				await complete(m.mutationId);
			} else {
				const delay = backoffFor(m.attempts);
				await recordFailure(m.mutationId, result.body || String(result.status), Date.now() + delay);
				if (drainScheduled) clearTimeout(drainScheduled);
				drainScheduled = setTimeout(() => {
					drainScheduled = null;
					drainNow().catch(() => undefined);
				}, delay);
				break;
			}
		}
	} finally {
		draining = false;
		// Order matters: invalidateAll first so the page load picks up the
		// freshly-inserted server rows, then refreshPendingCount so the
		// optimistic overlay clears AFTER the server data is already
		// visible. Otherwise the row briefly disappears while waiting for
		// invalidateAll to land.
		if (drained > 0) {
			try {
				await invalidateAll();
			} catch {
				// Page may have unmounted — ignore.
			}
		}
		await refreshPendingCount();
		syncStatus.update((s) => ({ ...s, draining: false, online: isOnline() }));
	}
	return { drained, remaining: await pendingCount() };
}

let initialized = false;
export function startSyncRuntime() {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	window.addEventListener('online', () => {
		syncStatus.update((s) => ({ ...s, online: true }));
		drainNow().catch(() => undefined);
	});
	window.addEventListener('offline', () => {
		syncStatus.update((s) => ({ ...s, online: false }));
	});
	window.addEventListener('focus', () => {
		drainNow().catch(() => undefined);
	});
	// Kick off an initial drain shortly after boot so any leftovers from
	// a prior session land before the user touches anything.
	setTimeout(() => drainNow().catch(() => undefined), 500);
	syncStatus.update((s) => ({ ...s, online: isOnline() }));
	refreshPendingCount();
}
