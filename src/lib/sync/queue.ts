// IndexedDB-backed mutation queue. Every write goes through here so a
// network blip at the gym doesn't drop a logged set. Server-side
// /api/mutate is idempotent on (clientId, mutationId) per M4, so
// replays are safe.

import { openDB, type IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

const DB_NAME = 'trajectory';
const DB_VERSION = 1;
const STORE = 'pending_mutations';

export interface PendingMutation {
	clientId: string;
	mutationId: string;
	op: string;
	payload: unknown;
	enqueuedAt: number;
	attempts: number;
	lastError: string | null;
	nextAttemptAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
	if (typeof indexedDB === 'undefined') {
		throw new Error('IndexedDB not available');
	}
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE)) {
					const store = db.createObjectStore(STORE, { keyPath: 'mutationId' });
					store.createIndex('byEnqueuedAt', 'enqueuedAt');
				}
			}
		});
	}
	return dbPromise;
}

const CLIENT_ID_KEY = 'trajectory.clientId';

export function clientId(): string {
	if (typeof localStorage === 'undefined') return 'server';
	let id = localStorage.getItem(CLIENT_ID_KEY);
	if (!id) {
		id = ulid();
		localStorage.setItem(CLIENT_ID_KEY, id);
	}
	return id;
}

export async function enqueue(op: string, payload: unknown): Promise<PendingMutation> {
	const entry: PendingMutation = {
		clientId: clientId(),
		mutationId: ulid(),
		op,
		payload,
		enqueuedAt: Date.now(),
		attempts: 0,
		lastError: null,
		nextAttemptAt: Date.now()
	};
	const db = await getDb();
	await db.put(STORE, entry);
	return entry;
}

export async function listPending(): Promise<PendingMutation[]> {
	if (typeof indexedDB === 'undefined') return [];
	const db = await getDb();
	return (await db.getAllFromIndex(STORE, 'byEnqueuedAt')) as PendingMutation[];
}

export async function listPendingByOp(op: string): Promise<PendingMutation[]> {
	const all = await listPending();
	return all.filter((m) => m.op === op);
}

export async function complete(mutationId: string): Promise<void> {
	const db = await getDb();
	await db.delete(STORE, mutationId);
}

export async function recordFailure(
	mutationId: string,
	error: string,
	nextAttemptAt: number
): Promise<void> {
	const db = await getDb();
	const existing = (await db.get(STORE, mutationId)) as PendingMutation | undefined;
	if (!existing) return;
	existing.attempts += 1;
	existing.lastError = error;
	existing.nextAttemptAt = nextAttemptAt;
	await db.put(STORE, existing);
}

export async function pendingCount(): Promise<number> {
	if (typeof indexedDB === 'undefined') return 0;
	const db = await getDb();
	return await db.count(STORE);
}
