// Trajectory smoke test — exercises the full server-side contract
// against a running dev container. Designed to be the single safety net
// that catches "I broke /api/mutate while refactoring." Deliberately
// small + contract-focused; UI testing comes later if it earns the lift.
//
// Each run creates its own smoke user (timestamped email) to avoid
// fixture-state collisions with the seed flow. Logged data accumulates
// in the dev DB; that's fine — these are realistic-looking rows
// indistinguishable from any other use.
//
// Run: `pnpm test:smoke` (assumes the container is up at
// http://localhost:5173). Override base URL via env:
//   TRAJECTORY_URL=http://other-host:5173 pnpm test:smoke

import { ulid } from 'ulid';

const BASE = process.env.TRAJECTORY_URL ?? 'http://localhost:5173';
const STAMP = Date.now();
const SMOKE_NAME = `smoke_${STAMP}`;
const SMOKE_EMAIL = `${SMOKE_NAME}@trajectory.local`;
const SMOKE_PASSWORD = `smoke-${STAMP}-pw`;

let cookies = '';

function captureCookies(setCookieHeaders) {
	if (!setCookieHeaders) return;
	for (const sc of setCookieHeaders) {
		const pair = sc.split(';')[0];
		if (!pair.includes('=')) continue;
		const name = pair.split('=')[0];
		// Replace any existing cookie with the same name.
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
	const setCookies = res.headers.getSetCookie?.() ?? [];
	captureCookies(setCookies);
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

function assert(cond, message) {
	if (!cond) {
		console.error(`  FAIL: ${message}`);
		process.exit(1);
	}
	console.log(`  ok    ${message}`);
}

async function main() {
	console.log(`smoke against ${BASE} as ${SMOKE_EMAIL}`);

	// 1. Sign up the smoke user. autoSignIn is off, so we sign in next.
	console.log('step 1 — sign up');
	const signup = await callJson('/api/auth/sign-up/email', {
		method: 'POST',
		body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD, name: SMOKE_NAME })
	});
	assert(signup.ok, `sign-up returns 2xx (got ${signup.status})`);

	console.log('step 2 — sign in');
	const signin = await callJson('/api/auth/sign-in/email', {
		method: 'POST',
		body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD })
	});
	assert(signin.ok, `sign-in returns 2xx (got ${signin.status})`);
	assert(/trajectory.session_token/.test(cookies), 'session cookie set');

	// 2. Create a gym + equipment + exercise via /api/mutate.
	const clientId = `smoke-${ulid()}`;
	const gymId = ulid();
	const equipmentId = ulid();

	async function mutate(op, payload) {
		const res = await callJson('/api/mutate', {
			method: 'POST',
			body: JSON.stringify({
				clientId,
				mutationId: ulid(),
				op,
				payload
			})
		});
		assert(res.ok, `mutate ${op} → 2xx (got ${res.status})`);
		return res.body;
	}

	console.log('step 3 — create gym');
	await mutate('gym.create', {
		id: gymId,
		name: `Smoke Gym ${STAMP}`,
		city: 'Test City',
		isPrimary: true
	});

	console.log('step 4 — create equipment');
	const eqResult = await mutate('equipment.create', {
		id: equipmentId,
		gymId,
		name: 'Smoke Cable Row',
		type: 'cable',
		group: 'pull',
		glyph: 'cable'
	});
	const exerciseId = eqResult?.result?.hiddenExercise?.id;
	assert(typeof exerciseId === 'string', 'auto-hidden exercise returned');

	console.log('step 5 — log three sets');
	const setIds = [ulid(), ulid(), ulid()];
	for (const [i, sid] of setIds.entries()) {
		await mutate('set.create', {
			id: sid,
			exerciseId,
			weight: 60 + i * 2.5,
			reps: 8,
			ts: Date.now() + i // ensure ordering
		});
	}

	// 3. Pull CSV and verify our 3 rows landed.
	console.log('step 6 — export CSV');
	const csvRes = await call('/api/export.csv?scope=user');
	assert(csvRes.status === 200, `csv → 200 (got ${csvRes.status})`);
	const ct = csvRes.headers.get('content-type') ?? '';
	assert(ct.includes('text/csv'), `csv content-type is text/csv (got ${ct})`);
	const csv = await csvRes.text();
	const lines = csv.trim().split('\n');
	assert(lines.length >= 4, `csv has header + ≥3 rows (got ${lines.length})`);
	const ours = lines.filter((l) => setIds.some((id) => l.startsWith(id)));
	assert(ours.length === 3, `csv contains our 3 set IDs (got ${ours.length})`);

	// Spot check: the first row's data parses out roughly as expected.
	const firstCells = ours[0].split(',');
	assert(firstCells[0] === setIds[0], 'first set id matches');
	assert(firstCells[8] === 'Smoke Cable Row', 'equipment name in CSV');
	assert(firstCells[14] === '60', 'weight in CSV');
	assert(firstCells[15] === '8', 'reps in CSV');

	// 4. Idempotency check — replay a mutation and assert no new rows.
	console.log('step 7 — replay idempotency');
	const replayMutationId = ulid();
	const replayPayload = {
		id: ulid(),
		exerciseId,
		weight: 999,
		reps: 1,
		ts: Date.now() + 100
	};
	const a = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({ clientId, mutationId: replayMutationId, op: 'set.create', payload: replayPayload })
	});
	const b = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({ clientId, mutationId: replayMutationId, op: 'set.create', payload: replayPayload })
	});
	assert(a.ok && b.ok, 'both mutate calls return 2xx');
	assert(b.body?.replayed === true, 'second call flagged as replayed');

	const csv2 = await (await call('/api/export.csv?scope=user')).text();
	const replayedHits = csv2.split('\n').filter((l) => l.startsWith(replayPayload.id)).length;
	assert(replayedHits === 1, `replay produced exactly 1 row (got ${replayedHits})`);

	// 8. cardioKind ↔ type invariant on equipment.update.
	console.log('step 8 — cardioKind invariant on equipment.update');
	const cardioEqId = ulid();
	await mutate('equipment.create', {
		id: cardioEqId,
		gymId,
		name: 'Smoke Treadmill',
		type: 'cardio',
		group: 'cardio',
		glyph: 'treadmill',
		cardioKind: 'treadmill'
	});

	const toMachine = await mutate('equipment.update', { id: cardioEqId, type: 'machine' });
	const toMachineRow = toMachine?.result;
	assert(toMachineRow?.type === 'machine', 'type changed to machine');
	assert(toMachineRow?.cardioKind === null, 'cardioKind cleared when type is non-cardio');

	const toCardio = await mutate('equipment.update', { id: cardioEqId, type: 'cardio' });
	const toCardioRow = toCardio?.result;
	assert(toCardioRow?.type === 'cardio', 'type changed back to cardio');
	assert(
		toCardioRow?.cardioKind === 'generic',
		'cardioKind defaulted to generic when type set to cardio without explicit kind'
	);

	const strengthEqId = ulid();
	await mutate('equipment.create', {
		id: strengthEqId,
		gymId,
		name: 'Smoke Strength Bench',
		type: 'machine',
		group: 'push',
		glyph: 'bench'
	});
	const emptyUpdate = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'equipment.update',
			payload: { id: strengthEqId }
		})
	});
	assert(!emptyUpdate.ok, 'empty equipment.update payload rejected');
	assert(
		emptyUpdate.status >= 400 && emptyUpdate.status < 500,
		`empty payload rejected with 4xx (got ${emptyUpdate.status})`
	);

	console.log('\nall smoke checks passed');
}

main().catch((err) => {
	console.error('smoke failed:', err);
	process.exit(1);
});
