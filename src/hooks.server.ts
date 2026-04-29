import type { Handle } from '@sveltejs/kit';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.TRAJECTORY_DATA_DIR ?? 'data';
const PLACEHOLDER = join(DATA_DIR, '.placeholder');

let placeholderEnsured = false;

function ensurePlaceholder() {
	if (placeholderEnsured) return;
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		if (!existsSync(PLACEHOLDER)) {
			writeFileSync(
				PLACEHOLDER,
				`Trajectory bind-mount sentinel.\nCreated: ${new Date().toISOString()}\n`
			);
		}
		placeholderEnsured = true;
		console.log(`[trajectory] data dir ready: ${DATA_DIR}`);
	} catch (err) {
		console.error(`[trajectory] failed to ensure ${PLACEHOLDER}:`, err);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	ensurePlaceholder();
	return resolve(event);
};
