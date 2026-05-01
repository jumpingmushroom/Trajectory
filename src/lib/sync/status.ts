// Tiny reactive store for sync state (online flag + pending count +
// drainer activity). Components subscribe via $store. Refreshable
// directly from anywhere via refreshPendingCount() so the count stays
// honest even when no sync events fire.

import { writable, get } from 'svelte/store';
import { pendingCount, listPending, type PendingMutation } from './queue';

export interface SyncSnapshot {
	online: boolean;
	pending: number;
	draining: boolean;
	pendingMutations: PendingMutation[];
	// Set when the server returns 401 on a queued mutation — the user's
	// session has expired and the queue can't drain until they sign in
	// again. UI surfaces this as a "Sign in again" banner.
	authExpired: boolean;
}

const initial: SyncSnapshot = {
	// Default optimistic — we don't trust `navigator.onLine` because it
	// lies often enough that seeding from it causes spurious "Offline"
	// banners on boot. Real reachability is established by the first
	// fetch or health ping in the sync runtime.
	online: true,
	pending: 0,
	draining: false,
	pendingMutations: [],
	authExpired: false
};

const store = writable<SyncSnapshot>(initial);

export const syncStatus = {
	subscribe: store.subscribe,
	set: store.set,
	update: store.update,
	snapshot(): SyncSnapshot {
		return get(store);
	}
};

export async function refreshPendingCount(): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const list = await listPending();
	store.update((s) => ({ ...s, pending: list.length, pendingMutations: list }));
}

// Subset of pending mutations matching a particular op + filter, used
// by the Log screen to render optimistic rows for queued set.create
// calls.
export async function pendingMatching(
	predicate: (m: PendingMutation) => boolean
): Promise<PendingMutation[]> {
	if (typeof indexedDB === 'undefined') return [];
	const all = await listPending();
	return all.filter(predicate);
}
