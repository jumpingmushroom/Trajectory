// Drizzle client + SQLite operational profile.
// PRAGMAs per DECISIONS.md D6: WAL + synchronous=NORMAL + foreign_keys=ON.
// SIGTERM handler closes the DB cleanly so WAL doesn't get stranded.

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_FILE = process.env.TRAJECTORY_DB_FILE ?? './data/db.sqlite';

mkdirSync(dirname(DB_FILE), { recursive: true });

const sqlite = new Database(DB_FILE);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };

// Graceful shutdown so WAL is checkpointed and the DB closes cleanly.
let closed = false;
function closeDb() {
	if (closed) return;
	closed = true;
	try {
		sqlite.close();
		console.log('[trajectory] sqlite closed cleanly');
	} catch (err) {
		console.error('[trajectory] sqlite close failed:', err);
	}
}
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);
process.on('beforeExit', closeDb);

export const dbFile = DB_FILE;
