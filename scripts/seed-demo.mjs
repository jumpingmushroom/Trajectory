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
// curated-exercise bookkeeping. Demo set spans every input mode and every
// muscle group so the Stats charts, the achievement gallery, and the
// equipment-detail screens all land on populated data after seeding.
const EQUIPMENT = [
	// push / pull / legs strength
	{ name: 'Bench Press', type: 'machine', group: 'push', glyph: 'bench', inputMode: 'weighted' },
	{ name: 'Chest Fly', type: 'machine', group: 'push', glyph: 'chestpress', inputMode: 'weighted' },
	{
		name: 'Tricep Pushdown',
		type: 'cable',
		group: 'arms',
		glyph: 'cable',
		inputMode: 'weighted'
	},
	{ name: 'Cable Row', type: 'cable', group: 'pull', glyph: 'cable', inputMode: 'weighted' },
	{ name: 'Lat Pulldown', type: 'cable', group: 'pull', glyph: 'pulldown', inputMode: 'weighted' },
	{ name: 'Leg Press', type: 'machine', group: 'legs', glyph: 'legpress', inputMode: 'weighted' },
	{ name: 'Hack Squat', type: 'machine', group: 'legs', glyph: 'hackquat', inputMode: 'weighted' },
	// New-mode + new-group equipment.
	{
		name: 'Hip Thrust',
		type: 'machine',
		group: 'glutes',
		glyph: 'hipthrust',
		inputMode: 'weighted'
	},
	{
		name: 'Preacher Curl',
		type: 'machine',
		group: 'arms',
		glyph: 'preacher',
		inputMode: 'weighted'
	},
	{
		name: 'Shoulder Press',
		type: 'machine',
		group: 'shoulders',
		glyph: 'shoulderpress',
		inputMode: 'weighted'
	},
	{
		name: 'Plank Mat',
		type: 'freeweight',
		group: 'core',
		glyph: 'plank',
		inputMode: 'timed'
	},
	{
		name: 'Farmer Walk',
		type: 'freeweight',
		group: 'core',
		glyph: 'farmer',
		inputMode: 'weight_distance'
	},
	// Cardio.
	{
		name: 'Treadmill',
		type: 'cardio',
		group: 'cardio',
		glyph: 'treadmill',
		cardioKind: 'treadmill',
		inputMode: 'distance_time'
	},
	{
		name: 'Rower',
		type: 'cardio',
		group: 'cardio',
		glyph: 'rower',
		cardioKind: 'rower',
		inputMode: 'distance_time'
	},
	{
		name: 'Bike',
		type: 'cardio',
		group: 'cardio',
		glyph: 'bike',
		cardioKind: 'bike',
		inputMode: 'distance_time'
	}
];

// Weekly split: push / pull / legs / core strength days plus two cardio
// days. The core day exists to host plank + farmer carry so timed and
// weight_distance modes both have natural cadence. Day index 0 = Monday.
const WEEKLY_SCHEDULE = [
	{
		kind: 'push',
		exercises: ['Bench Press', 'Shoulder Press', 'Chest Fly', 'Tricep Pushdown']
	},
	{ kind: 'cardio', exercises: ['Treadmill'] },
	{ kind: 'pull', exercises: ['Cable Row', 'Lat Pulldown', 'Preacher Curl'] },
	{ kind: 'core', exercises: ['Plank Mat', 'Farmer Walk'] }, // Thu (was rest)
	{ kind: 'legs', exercises: ['Leg Press', 'Hack Squat', 'Hip Thrust'] },
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
	'Hack Squat': { baseKg: 70, perWeekKg: 2.5, baseReps: 8 },
	'Hip Thrust': { baseKg: 80, perWeekKg: 2.5, baseReps: 10 },
	'Preacher Curl': { baseKg: 25, perWeekKg: 0.5, baseReps: 10 },
	'Shoulder Press': { baseKg: 30, perWeekKg: 0.75, baseReps: 10 }
};

// Timed-hold progression (mode = 'timed'). Stored as durationMin; baseSec /
// perWeekSec are friendlier to author and convert at use site. Three sets,
// 60 s rest between, drifting from 30 s up to ~50 s over 8 weeks.
const TIMED_BASELINES = {
	'Plank Mat': { baseSec: 30, perWeekSec: 2.5, sets: 3, restSec: 60 }
};

// Loaded-carry progression (mode = 'weight_distance'). Per-hand kg + a
// fixed distance. Four sets per session, 90 s rest. The distance stays
// constant (20 m) so the chart highlights weight progression — bumping
// distance instead is an equally valid pattern but harder to read.
const CARRY_BASELINES = {
	'Farmer Walk': { baseKg: 16, perWeekKg: 0.5, distanceM: 20, sets: 4, restSec: 90 }
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
			...(def.cardioKind ? { cardioKind: def.cardioKind } : {}),
			...(def.inputMode ? { inputMode: def.inputMode } : {})
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
			const sessionStart = dayStart + 18 * 60 * 60 * 1000 + Math.floor(jitter(30 * 60 * 1000));
			let setTs = sessionStart;

			for (const exerciseName of slot.exercises) {
				const ent = equipmentByName[exerciseName];
				if (!ent) throw new Error(`unknown exercise in schedule: ${exerciseName}`);

				if (slot.kind === 'cardio') {
					const cb = CARDIO_BASELINES[exerciseName];
					const distanceKm = roundHalf(cb.baseDistanceKm + cb.perWeekKm * week + jitter(0.4));
					const durationMin = Math.max(5, Math.round(cb.baseDurationMin + week * 0.5 + jitter(2)));
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
				} else if (slot.kind === 'core') {
					// Dispatch on the equipment's input mode so the same core
					// day cleanly hosts plank (timed) + farmer carry
					// (weight_distance) without requiring per-exercise branches
					// in the schedule itself.
					const mode = ent.def.inputMode;
					if (mode === 'timed') {
						const tb = TIMED_BASELINES[exerciseName];
						for (let s = 0; s < tb.sets; s++) {
							const sec = Math.max(15, Math.round(tb.baseSec + tb.perWeekSec * week + jitter(5)));
							await mutate('set.create', {
								id: ulid(),
								exerciseId: ent.exerciseId,
								durationMin: sec / 60,
								ts: setTs
							});
							setTs += (sec + tb.restSec) * 1000;
							setsCreated++;
						}
						setTs += 2 * 60 * 1000;
					} else if (mode === 'weight_distance') {
						const cb = CARRY_BASELINES[exerciseName];
						for (let s = 0; s < cb.sets; s++) {
							const weight = Math.max(0, roundHalf(cb.baseKg + cb.perWeekKg * week + jitter(1)));
							await mutate('set.create', {
								id: ulid(),
								exerciseId: ent.exerciseId,
								weight,
								extras: { distance: cb.distanceM },
								ts: setTs
							});
							// Carries take ~30 s + rest. Pad enough that all 4 sets
							// don't crowd the same minute.
							setTs += (30 + cb.restSec) * 1000;
							setsCreated++;
						}
						setTs += 2 * 60 * 1000;
					}
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
