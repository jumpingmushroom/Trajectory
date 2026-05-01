// POST   /api/profile/avatar  multipart/form-data { photo }
// DELETE /api/profile/avatar
//
// Uploads the caller's avatar: sharp resizes to a 256px square (cover crop,
// EXIF stripped, transcoded to WEBP) and writes data/uploads/avatars/<userId>.webp.
// On success, the user row's `image` field is set to the path under
// /uploads. DELETE clears the image field; the file is intentionally left
// on disk for recoverability.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

const DATA_DIR = process.env.TRAJECTORY_DATA_DIR ?? 'data';
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB raw upload

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');

	const form = await request.formData().catch(() => null);
	const file = form?.get('photo');
	if (!(file instanceof File)) throw error(400, 'photo field required');
	if (file.size > MAX_BYTES) throw error(413, 'photo too large (max 4MB)');

	const buffer = Buffer.from(await file.arrayBuffer());
	let webpBytes: Buffer;
	try {
		webpBytes = await sharp(buffer, { failOn: 'error' })
			.rotate()
			.resize({ width: 256, height: 256, fit: 'cover' })
			.webp({ quality: 86 })
			.toBuffer();
	} catch (err) {
		console.error('[trajectory] avatar sharp failed:', err);
		throw error(415, 'unsupported image format');
	}

	const relPath = join('avatars', `${locals.user.id}.webp`);
	const absPath = join(UPLOADS_DIR, relPath);
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, webpBytes);

	const publicPath = `/uploads/${relPath.replace(/\\/g, '/')}`;
	await db
		.update(user)
		.set({ image: publicPath, updatedAt: new Date() })
		.where(eq(user.id, locals.user.id));

	return json({ ok: true, image: publicPath });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');
	await db
		.update(user)
		.set({ image: null, updatedAt: new Date() })
		.where(eq(user.id, locals.user.id));
	return json({ ok: true });
};
