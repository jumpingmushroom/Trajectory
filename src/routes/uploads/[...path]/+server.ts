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

// SVG is intentionally absent: SVG with embedded <script> executes
// in a same-origin context and would be stored XSS. The photo upload
// endpoint only writes .webp (sharp transcodes everything), so under
// normal flow this map is exhaustive. Files dropped manually into
// data/uploads/ that aren't in this list serve as application/octet-stream
// with Content-Disposition: attachment, which the browser downloads
// rather than rendering inline.
const MIME: Record<string, string> = {
	webp: 'image/webp',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif'
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
	const mime = MIME[ext];
	const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;

	const headers: Record<string, string> = {
		'content-type': mime ?? 'application/octet-stream',
		'content-length': String(stats.size),
		'cache-control': 'public, max-age=2592000, immutable',
		// Defense in depth: browsers must not sniff a typed image as HTML/SVG.
		'x-content-type-options': 'nosniff',
		// Even if a malicious image with embedded script-like bytes were ever
		// served inline, the CSP confines it to a sandboxed, no-script context.
		'content-security-policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'"
	};
	if (!mime) {
		// Unknown extension → force download so the browser never tries to
		// render it inline.
		headers['content-disposition'] = 'attachment';
	}

	return new Response(stream, { status: 200, headers });
};
