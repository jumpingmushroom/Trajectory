// Migration runner: take a hot-backup snapshot, then apply pending
// migrations. Called once on first request via hooks.server.ts. The
// pre-migration snapshot lets us roll back a botched migration without
// losing the working DB.

import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { db, dbFile } from './index';

const MIGRATIONS_DIR = './drizzle';

let migrationsRan = false;

function hasPendingMigrations(): boolean {
	if (!existsSync(MIGRATIONS_DIR)) return false;
	const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
	if (sqlFiles.length === 0) return false;
	if (!existsSync(dbFile)) return true;
	try {
		const sqlite = new Database(dbFile, { readonly: true });
		try {
			const row = sqlite.prepare(`SELECT COUNT(*) as n FROM __drizzle_migrations`).get() as {
				n: number;
			};
			return row.n < sqlFiles.length;
		} finally {
			sqlite.close();
		}
	} catch {
		// __drizzle_migrations table doesn't exist yet → all migrations pending.
		return true;
	}
}

async function snapshot(): Promise<string | null> {
	if (!existsSync(dbFile)) return null;
	if (statSync(dbFile).size === 0) return null;
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const snapshotPath = `${dbFile}.pre-migration-${ts}`;
	const sourceDb = new Database(dbFile, { readonly: true });
	try {
		await sourceDb.backup(snapshotPath);
		console.log(`[trajectory] pre-migration snapshot: ${snapshotPath}`);
		return snapshotPath;
	} finally {
		sourceDb.close();
	}
}

export async function ensureMigrations(): Promise<void> {
	if (migrationsRan) return;
	migrationsRan = true;

	if (!hasPendingMigrations()) {
		console.log('[trajectory] no pending migrations');
		return;
	}

	await snapshot();
	console.log('[trajectory] applying migrations...');
	drizzleMigrate(db, { migrationsFolder: MIGRATIONS_DIR });
	console.log('[trajectory] migrations applied');
}
