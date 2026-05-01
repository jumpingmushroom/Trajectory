#!/usr/bin/env node
// Live SQLite snapshot via better-sqlite3's online backup API.
// Equivalent to `sqlite3 src.db ".backup dest.db"` but uses the module
// already installed in the container, so node-alpine doesn't need the
// sqlite3 CLI on PATH. Invoked from scripts/backup.sh.

import Database from 'better-sqlite3';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
	console.error('usage: snapshot.mjs <src> <dest>');
	process.exit(1);
}

const db = new Database(src, { readonly: true, fileMustExist: true });
try {
	await db.backup(dest);
} finally {
	db.close();
}
