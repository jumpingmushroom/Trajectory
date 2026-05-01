// Build the README hero composite + recompress all screenshots so the
// docs/screenshots/ payload stays modest. Run after taking screenshots.
//
//   node scripts/build-screenshots.mjs
//
// Inputs (all 1170x2532 @3x captured by chrome-devtools):
//   docs/screenshots/{home, log-strength, stats, setup, history,
//                     session-detail, log-cardio, achievement}.png
//
// Outputs:
//   docs/screenshots/hero.png  — Home + Log + Stats side by side
//   each input is resized to ≤780px wide (2x retina for ~390-pt frames)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const DIR = join(ROOT, 'docs', 'screenshots');

const PHONES_FOR_HERO = ['home.png', 'log-strength.png', 'stats.png'];
const ALL_SHOTS = [
	'home.png',
	'setup.png',
	'log-strength.png',
	'log-cardio.png',
	'session-detail.png',
	'history.png',
	'stats.png',
	'achievement.png'
];

const TARGET_WIDTH = 780;
const HERO_WIDTH_PER_PHONE = 520; // 3 × 520 = 1560 hero
const GAP = 32;

async function buildHero() {
	const phones = await Promise.all(
		PHONES_FOR_HERO.map((name) =>
			sharp(join(DIR, name))
				.resize({ width: HERO_WIDTH_PER_PHONE })
				.png({ compressionLevel: 9, palette: true })
				.toBuffer({ resolveWithObject: true })
		)
	);

	const heroWidth = HERO_WIDTH_PER_PHONE * phones.length + GAP * (phones.length - 1);
	const heroHeight = Math.max(...phones.map((p) => p.info.height));

	const composites = phones.map((p, i) => ({
		input: p.data,
		left: i * (HERO_WIDTH_PER_PHONE + GAP),
		top: 0
	}));

	await sharp({
		create: {
			width: heroWidth,
			height: heroHeight,
			channels: 4,
			background: { r: 13, g: 15, b: 18, alpha: 1 } // matches --color-bg
		}
	})
		.composite(composites)
		.png({ compressionLevel: 9, palette: true })
		.toFile(join(DIR, 'hero.png'));

	console.log(`hero.png: ${heroWidth}x${heroHeight}`);
}

async function recompress(name) {
	const inPath = join(DIR, name);
	const tmpPath = inPath + '.tmp';
	const meta = await sharp(inPath).metadata();
	let pipeline = sharp(inPath);
	if (meta.width && meta.width > TARGET_WIDTH) {
		pipeline = pipeline.resize({ width: TARGET_WIDTH });
	}
	await pipeline.png({ compressionLevel: 9, palette: true }).toFile(tmpPath);
	const { renameSync, statSync } = await import('node:fs');
	renameSync(tmpPath, inPath);
	console.log(`  ${name}: ${(statSync(inPath).size / 1024).toFixed(0)} KB`);
}

async function main() {
	console.log('building hero composite');
	await buildHero();
	console.log('recompressing individual shots');
	for (const name of ALL_SHOTS) {
		await recompress(name);
	}
	// hero already created above; recompress it last so the resize/palette
	// step lines up with the other shots.
	await recompress('hero.png');
	console.log('done');
}

main().catch((err) => {
	console.error('build-screenshots failed:', err);
	process.exit(1);
});
