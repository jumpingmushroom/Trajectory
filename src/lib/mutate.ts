// Client-side helper for posting mutations through /api/mutate.
// Mints a per-device clientId (persisted in localStorage) and a fresh
// mutationId (ULID) for each call. The IndexedDB sync layer (M10) will
// later wrap this with a queue + retry; for v0.1 every call is online.

import { ulid } from 'ulid';

const CLIENT_ID_KEY = 'trajectory.clientId';

function clientId(): string {
	if (typeof localStorage === 'undefined') return 'server';
	let id = localStorage.getItem(CLIENT_ID_KEY);
	if (!id) {
		id = ulid();
		localStorage.setItem(CLIENT_ID_KEY, id);
	}
	return id;
}

export interface MutationResult<T = unknown> {
	replayed: boolean;
	result: T;
}

export async function mutate<T = unknown>(op: string, payload: unknown): Promise<MutationResult<T>> {
	const res = await fetch('/api/mutate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			clientId: clientId(),
			mutationId: ulid(),
			op,
			payload
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`mutation failed (${res.status}): ${text}`);
	}
	return (await res.json()) as MutationResult<T>;
}

export { ulid };
