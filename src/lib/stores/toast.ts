// Lightweight toast queue. Used for surfacing failed mutations and other
// non-blocking errors. Toasts auto-dismiss after `ttlMs`; tapping the
// toast dismisses it immediately.

import { writable } from 'svelte/store';

export interface Toast {
	id: number;
	kind: 'error' | 'info';
	message: string;
	ttlMs: number;
}

const DEFAULT_TTL_MS = 5_000;

let nextId = 1;

const store = writable<Toast[]>([]);

export const toasts = {
	subscribe: store.subscribe
};

export function pushToast(message: string, kind: Toast['kind'] = 'error', ttlMs = DEFAULT_TTL_MS) {
	const id = nextId++;
	const t: Toast = { id, kind, message, ttlMs };
	store.update((list) => [...list, t]);
	if (typeof window !== 'undefined') {
		setTimeout(() => dismissToast(id), ttlMs);
	}
}

export function dismissToast(id: number) {
	store.update((list) => list.filter((t) => t.id !== id));
}
