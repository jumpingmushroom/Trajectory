// Trajectory smoke test — exercises the full server-side contract
// against a running dev container. Designed to be the single safety net
// that catches "I broke /api/mutate while refactoring." Deliberately
// small + contract-focused; UI testing comes later if it earns the lift.
//
// Under v0.2 multiuser, public sign-up is disabled. The test signs in as
// the seeded admin (ADMIN_EMAIL / ADMIN_PASSWORD), or whatever override
// the caller provides via SMOKE_EMAIL / SMOKE_PASSWORD. Logged rows
// accumulate in the dev DB across runs; ULIDs make them sort cleanly
// and the test never asserts a clean state.
//
// Run: `pnpm test:smoke` (assumes the container is up at
// http://localhost:5173). Override base URL via env:
//   TRAJECTORY_URL=http://other-host:5173 pnpm test:smoke

import { ulid } from 'ulid';

const BASE = process.env.TRAJECTORY_URL ?? 'http://localhost:5173';
const STAMP = Date.now();
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? process.env.ADMIN_EMAIL ?? 'admin@trajectory.local';
const SMOKE_PASSWORD =
	process.env.SMOKE_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 'change-me-on-first-login';

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

	// 1. Sign in as the seeded admin. Public sign-up is disabled under v0.2;
	//    fixtures reuse a known account rather than mint a fresh user per run.
	console.log('step 1 — sign in');
	const signin = await callJson('/api/auth/sign-in/email', {
		method: 'POST',
		body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD })
	});
	assert(signin.ok, `sign-in returns 2xx (got ${signin.status})`);
	assert(/trajectory.session_token/.test(cookies), 'session cookie set');

	// 2. Create a gym + equipment + exercise via /api/mutate.
	// Server validates clientId as a ULID (per security fix in 0468990),
	// so we can't prefix with "smoke-" anymore — just use a fresh ULID.
	const clientId = ulid();
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

	// Each smoke set is a fresh PR for the smoke user (new exercise, no
	// prior history) so set.is_pr=1 is on every row, which means the
	// achievement evaluator should award strength.first_pr and
	// strength.single_plate (60 kg threshold) by the first set, and
	// easter.pr_day after the third (>=3 PRs in one session).
	console.log('step 5b — achievements awarded after set logging');
	const achRes = await callJson('/api/achievement');
	assert(achRes.ok, `GET /api/achievement → 2xx (got ${achRes.status})`);
	const earnedKeys = new Set((achRes.body?.earned ?? []).map((a) => a.badgeKey));
	assert(earnedKeys.has('strength.first_pr'), 'strength.first_pr awarded');
	assert(earnedKeys.has('strength.single_plate'), 'strength.single_plate awarded');
	assert(earnedKeys.has('easter.pr_day'), 'easter.pr_day awarded after 3 PRs in session');

	// 3. Pull CSV and verify our 3 rows landed.
	console.log('step 6 — export CSV');
	const csvRes = await call('/api/export.csv');
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
		body: JSON.stringify({
			clientId,
			mutationId: replayMutationId,
			op: 'set.create',
			payload: replayPayload
		})
	});
	const b = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: replayMutationId,
			op: 'set.create',
			payload: replayPayload
		})
	});
	assert(a.ok && b.ok, 'both mutate calls return 2xx');
	assert(b.body?.replayed === true, 'second call flagged as replayed');

	const csv2 = await (await call('/api/export.csv')).text();
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

	// 9. Manual session start/end/undo/delete contract.
	// At this point the user has one open session (from the 3 sets above).
	// session.start should be idempotent against that existing session.
	console.log('step 9 — manual session start (idempotent against open)');
	const startAttempt = await mutate('session.start', {
		id: ulid(),
		gymId
	});
	const openId = startAttempt?.result?.id;
	assert(typeof openId === 'string', 'session.start returns the open session id');
	assert(startAttempt?.result?.endedAt == null, 'returned session is open');

	console.log('step 10 — session.end closes the session');
	const endResult = await mutate('session.end', { id: openId });
	assert(endResult?.result?.endedAt != null, 'endedAt is set after session.end');

	console.log('step 11 — session.endUndo reopens (no newer session)');
	const undoResult = await mutate('session.endUndo', { id: openId });
	assert(undoResult?.result?.endedAt == null, 'endedAt cleared after undo');

	console.log('step 12 — session.end is idempotent');
	await mutate('session.end', { id: openId });
	const endAgain = await mutate('session.end', { id: openId });
	assert(endAgain?.result?.endedAt != null, 'second end keeps endedAt set');

	console.log('step 13 — session.delete refuses non-empty session');
	const badDelete = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'session.delete',
			payload: { id: openId }
		})
	});
	assert(!badDelete.ok, 'delete on non-empty session rejected');
	assert(
		badDelete.status >= 400 && badDelete.status < 500,
		`reject is 4xx (got ${badDelete.status})`
	);

	console.log('step 14 — manual start of a fresh session, then delete (empty)');
	const freshId = ulid();
	const freshResult = await mutate('session.start', { id: freshId, gymId });
	assert(freshResult?.result?.id === freshId, 'fresh session.start uses provided id');
	assert(freshResult?.result?.endedAt == null, 'fresh session is open');

	const deleteResult = await mutate('session.delete', { id: freshId });
	assert(deleteResult?.result?.deleted === true, 'session.delete on empty session succeeds');

	console.log('step 15 — endUndo blocked when a newer session exists');
	// Need a closed older session and a newer open session.
	// freshId was deleted in step 14 → start two sessions back-to-back.
	const olderId = ulid();
	await mutate('session.start', { id: olderId, gymId });
	await mutate('session.end', { id: olderId });
	// Wait briefly so the newer session's startedAt is strictly greater.
	await new Promise((r) => setTimeout(r, 5));
	const newerId = ulid();
	await mutate('session.start', { id: newerId, gymId });
	const blockedUndo = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'session.endUndo',
			payload: { id: olderId }
		})
	});
	assert(!blockedUndo.ok, 'endUndo blocked by newer session');
	assert(
		blockedUndo.status >= 400 && blockedUndo.status < 500,
		`blocked with 4xx (got ${blockedUndo.status})`
	);

	// 16. Bodyweight equipment: round-trip pct on equipment.update, and
	// confirm strength sets accept the bwLoadKg/bwKg/bwPct extras snapshot.
	console.log('step 16 — bodyweight pct round-trip + extras snapshot');
	const bwEqId = ulid();
	const bwCreate = await mutate('equipment.create', {
		id: bwEqId,
		gymId,
		name: 'Smoke Captains Chair',
		type: 'machine',
		group: 'core',
		glyph: 'captainschair',
		bodyweightPct: 0.33
	});
	const bwExId = bwCreate?.result?.hiddenExercise?.id;
	assert(typeof bwExId === 'string', 'auto-hidden exercise returned for bw equipment');
	assert(
		bwCreate?.result?.equipment?.bodyweightPct === 0.33,
		`equipment.create stores bodyweightPct (got ${bwCreate?.result?.equipment?.bodyweightPct})`
	);

	const bwSetId = ulid();
	const bwSet = await mutate('set.create', {
		id: bwSetId,
		exerciseId: bwExId,
		weight: 0,
		reps: 8,
		extras: { bwLoadKg: 26.4, bwKg: 80, bwPct: 0.33 },
		ts: Date.now() + 200
	});
	const bwSetRow = bwSet?.result?.set;
	assert(bwSetRow?.weight === 0, 'bodyweight set stored weight=0');
	assert(
		bwSetRow?.extras?.bwLoadKg === 26.4 &&
			bwSetRow?.extras?.bwKg === 80 &&
			bwSetRow?.extras?.bwPct === 0.33,
		'set.create snapshots bw extras'
	);

	const bwAssistedId = ulid();
	const bwAssisted = await mutate('set.create', {
		id: bwAssistedId,
		exerciseId: bwExId,
		weight: -10,
		reps: 5,
		extras: { bwLoadKg: 26.4, bwKg: 80, bwPct: 0.33 },
		ts: Date.now() + 250
	});
	assert(
		bwAssisted?.result?.set?.weight === -10,
		'bodyweight equipment accepts negative (assisted) weight'
	);

	// Reject path: a regular (non-bodyweight) strength set must not accept
	// bw-flavoured extras — they'd silently corrupt volume on stats.
	const rejectExtras = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'set.create',
			payload: {
				id: ulid(),
				exerciseId,
				weight: 60,
				reps: 8,
				extras: { bwLoadKg: 30 },
				ts: Date.now() + 260
			}
		})
	});
	assert(!rejectExtras.ok, 'extras on non-bw equipment rejected');
	assert(
		rejectExtras.status >= 400 && rejectExtras.status < 500,
		`bw-extras-on-loaded-equipment rejected with 4xx (got ${rejectExtras.status})`
	);

	const rejectNeg = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'set.create',
			payload: {
				id: ulid(),
				exerciseId,
				weight: -5,
				reps: 8,
				ts: Date.now() + 270
			}
		})
	});
	assert(!rejectNeg.ok, 'negative weight on non-bw equipment rejected');

	const updatePct = await mutate('equipment.update', {
		id: bwEqId,
		bodyweightPct: 0.4
	});
	assert(
		updatePct?.result?.bodyweightPct === 0.4,
		`equipment.update round-trips bodyweightPct (got ${updatePct?.result?.bodyweightPct})`
	);

	// Clearing a pct happens on a fresh equipment with no logged sets — a
	// machine that already has assisted (negative-weight) sets shouldn't
	// drop the bodyweight flag, since that would leave the sets stranded
	// in an invalid state for the log screen.
	const clearEqId = ulid();
	await mutate('equipment.create', {
		id: clearEqId,
		gymId,
		name: 'Smoke Toggle BW',
		type: 'machine',
		group: 'core',
		glyph: 'captainschair',
		bodyweightPct: 0.5
	});
	const clearPct = await mutate('equipment.update', { id: clearEqId, bodyweightPct: null });
	assert(
		clearPct?.result?.bodyweightPct === null,
		`equipment.update can clear bodyweightPct (got ${clearPct?.result?.bodyweightPct})`
	);

	// 17. user.update accepts/clears bodyWeightKg, with range validation.
	console.log('step 17 — user.update bodyWeightKg');
	const setBw = await mutate('user.update', { bodyWeightKg: 80 });
	assert(setBw?.result?.bodyWeightKg === 80, 'user.update sets bodyWeightKg');

	// CSV faithfully preserves both halves of a bodyweight set: the raw
	// added weight in the `weightKg` column and the bw snapshot in the
	// `otherExtrasJson` column. Display layers can recombine them; the
	// export must not flatten one into the other.
	console.log('step 17b — CSV export preserves bw fields');
	const csvBwRes = await call('/api/export.csv');
	assert(csvBwRes.status === 200, `csv → 200 (got ${csvBwRes.status})`);
	const csvBw = await csvBwRes.text();
	const bwLine = csvBw.split('\n').find((l) => l.startsWith(bwSetId));
	assert(typeof bwLine === 'string', 'bw set row present in CSV');
	const bwCells = bwLine.split(',');
	assert(bwCells[14] === '0', `bw set CSV weight column = 0 (got ${bwCells[14]})`);
	// otherExtrasJson is column 20 but contains commas inside the JSON;
	// rejoin from cell 20 to penultimate cell (last is ts).
	const bwExtrasJsonCsv = bwCells.slice(20, -1).join(',').replace(/^"|"$/g, '').replace(/""/g, '"');
	assert(
		bwExtrasJsonCsv.includes('"bwLoadKg":26.4') &&
			bwExtrasJsonCsv.includes('"bwKg":80') &&
			bwExtrasJsonCsv.includes('"bwPct":0.33'),
		`bw set CSV otherExtrasJson carries snapshot (got ${bwExtrasJsonCsv})`
	);

	const clearBw = await mutate('user.update', { bodyWeightKg: null });
	assert(clearBw?.result?.bodyWeightKg === null, 'user.update clears bodyWeightKg');

	const oobBw = await callJson('/api/mutate', {
		method: 'POST',
		body: JSON.stringify({
			clientId,
			mutationId: ulid(),
			op: 'user.update',
			payload: { bodyWeightKg: 1000 }
		})
	});
	assert(!oobBw.ok, 'out-of-range bodyWeightKg rejected');
	assert(
		oobBw.status >= 400 && oobBw.status < 500,
		`bodyWeightKg=1000 rejected with 4xx (got ${oobBw.status})`
	);

	console.log('\nall smoke checks passed');
}

main().catch((err) => {
	console.error('smoke failed:', err);
	process.exit(1);
});
