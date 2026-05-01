// Trajectory demo seed.
//
// Populates the configured admin account with eight weeks of believable
// workout history so the app has something to look at on first boot —
// useful for screenshots, tire-kicking, or shipping the README.
//
// Run from inside the running dev container:
//
//   docker compose exec trajectory node scripts/seed-demo.mjs
//
// The script signs in as the configured admin (ADMIN_EMAIL /
// ADMIN_PASSWORD env vars, with the same docker-compose.yml defaults the
// smoke test uses) and posts everything through /api/mutate, the same
// path real clients use. Idempotent: bails if any sets are already
// logged on the account. Re-seed by removing data/db.sqlite and rebooting.

import { ulid } from 'ulid';

const BASE = process.env.TRAJECTORY_URL ?? 'http://localhost:5173';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@trajectory.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'change-me-on-first-login';

let cookies = '';

function captureCookies(setCookieHeaders) {
	if (!setCookieHeaders) return;
	for (const sc of setCookieHeaders) {
		const pair = sc.split(';')[0];
		if (!pair.includes('=')) continue;
		const name = pair.split('=')[0];
		const without = cookies
			.split('; ')
			.filter((c) => c.length > 0 && !c.startsWith(`${name}=`))
			.join('; ');
		cookies = without ? `${without}; ${pair}` : pair;
	}
}

async function call(path, init = {}) {
	const headers = new Headers(init.headers ?? {});
	if (cookies) headers.set('cookie', cookies);
	if (!headers.has('origin')) headers.set('origin', BASE);
	if (init.body && !headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}
	const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
	captureCookies(res.headers.getSetCookie?.() ?? []);
	return res;
}

async function callJson(path, init) {
	const res = await call(path, init);
	const text = await res.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	return { status: res.status, ok: res.ok, body };
}

const clientId = ulid();
let mutationsRun = 0;

async function mutate(op, payload) {
	const res = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({ clientId, mutationId: ulid(), op, payload })
	});
	if (!res.ok) {
		throw new Error(`mutate ${op} failed: ${res.status} ${JSON.stringify(res.body)}`);
	}
	mutationsRun++;
	return res.body;
}

// Equipment definitions. All non-freeweight types so the server auto-
// creates the hidden exercise — keeps the script a single pass with no
// curated-exercise bookkeeping. Ten pieces split push / pull / legs /
// cardio so the muscle-group distribution chart actually has data.
const EQUIPMENT = [
	{ name: 'Bench Press', type: 'machine', group: 'push', glyph: 'bench' },
	{ name: 'Chest Fly', type: 'machine', group: 'push', glyph: 'machine' },
	{ name: 'Tricep Pushdown', type: 'cable', group: 'push', glyph: 'cable' },
	{ name: 'Cable Row', type: 'cable', group: 'pull', glyph: 'cable' },
	{ name: 'Lat Pulldown', type: 'cable', group: 'pull', glyph: 'cable' },
	{ name: 'Leg Press', type: 'machine', group: 'legs', glyph: 'legpress' },
	{ name: 'Hack Squat', type: 'machine', group: 'legs', glyph: 'hackquat' },
	{ name: 'Treadmill', type: 'cardio', group: 'cardio', glyph: 'treadmill', cardioKind: 'treadmill' },
	{ name: 'Rower', type: 'cardio', group: 'cardio', glyph: 'rower', cardioKind: 'rower' },
	{ name: 'Bike', type: 'cardio', group: 'cardio', glyph: 'bike', cardioKind: 'bike' }
];

// Weekly split: push / pull / legs strength days plus one cardio day.
// Empty arrays = rest day. Day index 0 = Monday.
const WEEKLY_SCHEDULE = [
	{ kind: 'push', exercises: ['Bench Press', 'Chest Fly', 'Tricep Pushdown'] },
	{ kind: 'cardio', exercises: ['Treadmill'] },
	{ kind: 'pull', exercises: ['Cable Row', 'Lat Pulldown'] },
	null, // Thu rest
	{ kind: 'legs', exercises: ['Leg Press', 'Hack Squat'] },
	{ kind: 'cardio', exercises: ['Rower'] },
	null // Sun rest
];

// Per-equipment strength baseline and weekly progression. Baseline is
// the working-set weight (kg) at week 0; progression is added per week.
// Reps stay around 8 with ±1 noise.
const STRENGTH_BASELINES = {
	'Bench Press': { baseKg: 60, perWeekKg: 1.25, baseReps: 8 },
	'Chest Fly': { baseKg: 30, perWeekKg: 0.5, baseReps: 12 },
	'Tricep Pushdown': { baseKg: 25, perWeekKg: 0.5, baseReps: 12 },
	'Cable Row': { baseKg: 50, perWeekKg: 1.0, baseReps: 10 },
	'Lat Pulldown': { baseKg: 55, perWeekKg: 1.0, baseReps: 10 },
	'Leg Press': { baseKg: 120, perWeekKg: 5, baseReps: 8 },
	'Hack Squat': { baseKg: 70, perWeekKg: 2.5, baseReps: 8 }
};

// Cardio progression. Distance + duration creep up modestly week to week;
// kcal + HR are derived noisily from those.
const CARDIO_BASELINES = {
	Treadmill: { baseDistanceKm: 4.5, baseDurationMin: 28, perWeekKm: 0.15 },
	Rower: { baseDistanceKm: 4.0, baseDurationMin: 22, perWeekKm: 0.12 },
	Bike: { baseDistanceKm: 12, baseDurationMin: 35, perWeekKm: 0.4 }
};

const SETS_PER_EXERCISE = 4;

function jitter(amount) {
	return (Math.random() - 0.5) * 2 * amount;
}

function roundHalf(n) {
	return Math.round(n * 2) / 2;
}

async function main() {
	console.log(`seed-demo: ${BASE} as ${EMAIL}`);

	// 1. Sign in.
	const signin = await callJson('/api/auth/sign-in/email', {
		method: 'POST',
		body: JSON.stringify({ email: EMAIL, password: PASSWORD })
	});
	if (!signin.ok) {
		console.error(
			`sign-in failed (${signin.status}): make sure the container is up and ` +
				`ADMIN_EMAIL / ADMIN_PASSWORD match a seeded admin.`
		);
		process.exit(1);
	}

	// 2. Idempotency: if any sets already exist on this account, bail.
	const csv = await (await call('/api/export.csv')).text();
	const csvLines = csv.trim().split('\n');
	if (csvLines.length > 1) {
		console.error(
			`refusing to seed: account has ${csvLines.length - 1} existing rows. ` +
				`Wipe data/db.sqlite and reboot to re-seed.`
		);
		process.exit(1);
	}

	// 3. Create the gym.
	const gymId = ulid();
	await mutate('gym.create', {
		id: gymId,
		name: 'Demo Gym',
		city: 'Berlin',
		isPrimary: true
	});
	console.log(`  gym created`);

	// 4. Create equipment, capturing each piece's auto-hidden exerciseId.
	const equipmentByName = {};
	for (const def of EQUIPMENT) {
		const equipmentId = ulid();
		const result = await mutate('equipment.create', {
			id: equipmentId,
			gymId,
			name: def.name,
			type: def.type,
			group: def.group,
			glyph: def.glyph,
			...(def.cardioKind ? { cardioKind: def.cardioKind } : {})
		});
		const exerciseId = result?.result?.hiddenExercise?.id;
		if (!exerciseId) {
			throw new Error(`equipment.create for ${def.name} did not return a hidden exercise`);
		}
		equipmentByName[def.name] = { equipmentId, exerciseId, def };
	}
	console.log(`  ${EQUIPMENT.length} equipment created`);

	// 5. Walk eight weeks day by day, log sets per the weekly schedule.
	const NOW = Date.now();
	const WEEKS = 8;
	const DAY_MS = 24 * 60 * 60 * 1000;

	// Anchor the first day to 8 weeks ago (Mon of that week relative to the
	// current weekday). new Date().getDay(): Sun=0..Sat=6. Convert to
	// Mon=0..Sun=6.
	const todayMonZero = (new Date(NOW).getDay() + 6) % 7;
	const startTs = NOW - (WEEKS * 7 + todayMonZero) * DAY_MS;

	let sessionsCreated = 0;
	let setsCreated = 0;

	for (let week = 0; week < WEEKS; week++) {
		for (let weekday = 0; weekday < 7; weekday++) {
			const slot = WEEKLY_SCHEDULE[weekday];
			if (!slot) continue;

			// Skip days strictly in the future (e.g. this week's Friday if
			// today is Wednesday). Future timestamps are rejected by the API
			// and would corrupt the heatmap besides.
			const dayStart = startTs + (week * 7 + weekday) * DAY_MS;
			if (dayStart > NOW) continue;

			// Sessions start at 18:00 ± 30min jitter so the heatmap reads
			// like a real evening lifter rather than a bot.
			const sessionStart =
				dayStart + 18 * 60 * 60 * 1000 + Math.floor(jitter(30 * 60 * 1000));
			let setTs = sessionStart;

			for (const exerciseName of slot.exercises) {
				const ent = equipmentByName[exerciseName];
				if (!ent) throw new Error(`unknown exercise in schedule: ${exerciseName}`);

				if (slot.kind === 'cardio') {
					const cb = CARDIO_BASELINES[exerciseName];
					const distanceKm = roundHalf(cb.baseDistanceKm + cb.perWeekKm * week + jitter(0.4));
					const durationMin = Math.max(
						5,
						Math.round(cb.baseDurationMin + week * 0.5 + jitter(2))
					);
					const kcal = Math.round(distanceKm * 60 + jitter(20));
					const hr_avg = Math.round(140 + jitter(10));
					await mutate('set.create', {
						id: ulid(),
						exerciseId: ent.exerciseId,
						durationMin,
						extras: { distance: distanceKm, kcal, hr_avg },
						ts: setTs
					});
					setTs += (durationMin + 5) * 60 * 1000;
					setsCreated++;
				} else {
					const sb = STRENGTH_BASELINES[exerciseName];
					for (let s = 0; s < SETS_PER_EXERCISE; s++) {
						const weight = Math.max(0, roundHalf(sb.baseKg + sb.perWeekKg * week + jitter(2.5)));
						const reps = Math.max(1, sb.baseReps + Math.floor(jitter(2)));
						await mutate('set.create', {
							id: ulid(),
							exerciseId: ent.exerciseId,
							weight,
							reps,
							ts: setTs
						});
						setTs += 90 * 1000; // 90s rest between sets
						setsCreated++;
					}
					setTs += 4 * 60 * 1000; // 4min between exercises
				}
			}
			sessionsCreated++;
		}
	}

	// 6. Achievements: count how many landed naturally from the seeded
	// volume. The evaluator fires inside set.create and session.end; the
	// final count gives the user a useful "did the gallery populate?"
	// signal in screenshots.
	const ach = await callJson('/api/achievement');
	const earned = ach.body?.earned?.length ?? 0;

	console.log(
		`  ${sessionsCreated} sessions, ${setsCreated} sets, ${earned} achievements unlocked`
	);
	console.log(`  ${mutationsRun} mutations posted total`);
	console.log(`done — sign in as ${EMAIL} to see populated data`);
}

main().catch((err) => {
	console.error('seed-demo failed:', err);
	process.exit(1);
});
