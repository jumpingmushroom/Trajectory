// POST /api/equipment/[id]/photo
// Accepts a multipart/form-data upload (field name: "photo"), runs it
// through sharp (resize to 1080px max long edge, strip EXIF, encode as
// webp), writes to data/uploads/equipment/<id>.webp, then patches the
// equipment row's photo_path.
//
// This sits outside /api/mutate because binary upload doesn't fit the
// JSON envelope cleanly and isn't usefully replayable in the same way
// (the file content is a side-effect on the filesystem).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { equipment } from '$lib/server/db/schema';
import { isUlid } from '$lib/server/ulid';

const DATA_DIR = process.env.TRAJECTORY_DATA_DIR ?? 'data';
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB raw upload

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	const { id } = params;
	if (!id || !isUlid(id)) throw error(400, 'invalid equipment id');

	const existing = (
		await db.select().from(equipment).where(eq(equipment.id, id)).limit(1)
	)[0];
	if (!existing) throw error(404, 'equipment not found');

	const form = await request.formData().catch(() => null);
	const file = form?.get('photo');
	if (!(file instanceof File)) throw error(400, 'photo field required');
	if (file.size > MAX_BYTES) throw error(413, 'photo too large');

	const buffer = Buffer.from(await file.arrayBuffer());
	let webpBytes: Buffer;
	try {
		webpBytes = await sharp(buffer, { failOn: 'error' })
			.rotate()
			.resize({ width: 1080, height: 1080, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer();
	} catch (err) {
		console.error('[trajectory] sharp failed:', err);
		throw error(415, 'unsupported image format');
	}

	const relPath = join('equipment', `${id}.webp`);
	const absPath = join(UPLOADS_DIR, relPath);
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, webpBytes);

	await db
		.update(equipment)
		.set({ photoPath: relPath, updatedAt: new Date() })
		.where(eq(equipment.id, id));

	return json({ ok: true, photoPath: relPath, size: webpBytes.length });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	const { id } = params;
	if (!id || !isUlid(id)) throw error(400, 'invalid equipment id');

	await db
		.update(equipment)
		.set({ photoPath: null, updatedAt: new Date() })
		.where(eq(equipment.id, id));
	// Note: the .webp file is intentionally left on disk for recoverability.
	// A FUTURE.md cleanup task can reap orphans.
	return json({ ok: true });
};
