// Drizzle query helpers that bake the soft-delete tombstone filter into
// every read by default. Per DECISIONS D4 trade-off #2, every query on
// equipment/exercise/set/gym needs `WHERE deleted_at IS NULL`; one
// missed `WHERE` shows tombstoned rows in a chart. Use these helpers
// instead of writing raw conditions.

import { and, isNull, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Returns `WHERE deleted_at IS NULL` AND'd with any additional conditions.
 *
 * Usage:
 *   db.select().from(equipment).where(notDeleted(equipment.deletedAt))
 *   db.select().from(equipment).where(notDeleted(equipment.deletedAt, eq(equipment.gymId, gymId)))
 */
export function notDeleted(deletedAtColumn: AnySQLiteColumn, ...extras: (SQL | undefined)[]): SQL {
	const filters: (SQL | undefined)[] = [isNull(deletedAtColumn), ...extras];
	const composed = and(...filters);
	if (!composed) {
		// `and` returns undefined only when all inputs are undefined, which
		// can't happen here because isNull always returns a SQL. Safety net.
		return isNull(deletedAtColumn);
	}
	return composed;
}
