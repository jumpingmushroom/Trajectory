// Generate PNG icon set from static/icons/source.svg.
// Run via `pnpm gen:icons`. Outputs:
//   static/icons/icon-192.png        — primary install icon (Android)
//   static/icons/icon-512.png        — large install icon
//   static/icons/icon-maskable-512.png — same image but with safe area
//                                       (the corners get cropped to a
//                                       circle on Android adaptive icons,
//                                       so we keep the artwork inside the
//                                       inner 80% safe area)
//   static/icons/apple-touch-icon.png — 180x180 for iOS Add-to-Home-Screen
//   static/favicon.png                — 32x32 browser tab icon

import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const SRC = 'static/icons/source.svg';
const OUT_DIR = 'static/icons';

async function rasterize(input, size, outPath, opts = {}) {
	const buf = await sharp(input)
		.resize(size, size, { fit: 'contain', background: opts.bg ?? { r: 13, g: 15, b: 18, alpha: 1 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
	await writeFile(outPath, buf);
	console.log(`  wrote ${outPath} (${buf.length} bytes)`);
}

async function rasterizeMaskable(input, size, outPath) {
	// Maskable icons need an 80% safe area: render the source at 80% and
	// pad with the dark background.
	const inner = Math.round(size * 0.8);
	const padded = await sharp(input)
		.resize(inner, inner, { fit: 'contain', background: { r: 13, g: 15, b: 18, alpha: 1 } })
		.extend({
			top: Math.round((size - inner) / 2),
			bottom: size - inner - Math.round((size - inner) / 2),
			left: Math.round((size - inner) / 2),
			right: size - inner - Math.round((size - inner) / 2),
			background: { r: 13, g: 15, b: 18, alpha: 1 }
		})
		.png({ compressionLevel: 9 })
		.toBuffer();
	await writeFile(outPath, padded);
	console.log(`  wrote ${outPath} (${padded.length} bytes)`);
}

async function main() {
	console.log(`reading ${SRC}`);
	const src = await readFile(SRC);
	await mkdir(OUT_DIR, { recursive: true });

	await rasterize(src, 192, `${OUT_DIR}/icon-192.png`);
	await rasterize(src, 512, `${OUT_DIR}/icon-512.png`);
	await rasterizeMaskable(src, 512, `${OUT_DIR}/icon-maskable-512.png`);
	await rasterize(src, 180, `${OUT_DIR}/apple-touch-icon.png`);
	await rasterize(src, 32, 'static/favicon.png');
	console.log('done');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
