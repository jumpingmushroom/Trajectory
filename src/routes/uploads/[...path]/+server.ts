// GET /uploads/<path>
// Serves files from data/uploads/ (host bind-mount). Read-only static
// route. Validates the path stays under UPLOADS_DIR so a crafted URL
// can't escape.

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';

const DATA_DIR = process.env.TRAJECTORY_DATA_DIR ?? 'data';
const UPLOADS_DIR = resolve(DATA_DIR, 'uploads');

const MIME: Record<string, string> = {
	webp: 'image/webp',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	const rel = params.path ?? '';
	if (!rel) throw error(404, 'not found');

	const safe = normalize(rel);
	if (safe.startsWith('..') || safe.includes('\0')) throw error(400, 'invalid path');

	const abs = resolve(join(UPLOADS_DIR, safe));
	if (!abs.startsWith(UPLOADS_DIR + '/') && abs !== UPLOADS_DIR) {
		throw error(400, 'invalid path');
	}

	let stats;
	try {
		stats = await stat(abs);
	} catch {
		throw error(404, 'not found');
	}
	if (!stats.isFile()) throw error(404, 'not found');

	const ext = abs.toLowerCase().split('.').pop() ?? '';
	const mime = MIME[ext] ?? 'application/octet-stream';
	const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;

	return new Response(stream, {
		status: 200,
		headers: {
			'content-type': mime,
			'content-length': String(stats.size),
			'cache-control': 'public, max-age=2592000, immutable'
		}
	});
};
