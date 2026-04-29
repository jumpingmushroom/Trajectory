// ULID utilities used everywhere on the server side.
// Trajectory PKs are ULIDs (sortable, client-generatable, conflict-free
// across devices) per DECISIONS D4. Server validates incoming IDs from
// clients to defend against the most common bug class — malformed or
// duplicate IDs from a buggy client.

import { ulid as monotonicUlid } from 'ulid';

export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function newUlid(): string {
	return monotonicUlid();
}

export function isUlid(value: unknown): value is string {
	return typeof value === 'string' && ULID_RE.test(value);
}

export function assertUlid(value: unknown, label = 'id'): asserts value is string {
	if (!isUlid(value)) {
		throw new Error(`Invalid ULID for ${label}: ${String(value)}`);
	}
}
