# Rest Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 90s rest readout with a configurable, per-equipment rest timer shown as a global overlay that beeps/vibrates/flashes when rest is up.

**Architecture:** Approach A — the countdown is a pure function of data. A module store holds a descriptor of the _triggering set_ plus ephemeral overrides; `remaining()` is derived each tick from `Date.now()`. Per-equipment `restTargetSec` (nullable) resolves against user-level settings. All persistence rides existing `equipment.*`/`user.update` mutation ops through `/api/mutate`, so it's offline-safe for free.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle ORM + better-sqlite3, Vitest (added here for pure-logic unit tests), Web Audio + Vibration APIs.

**Spec:** `docs/superpowers/specs/2026-06-15-rest-timer-design.md`

---

## File structure

**New files:**

- `src/lib/rest/resolve.ts` — `RestSettings` type + `resolveRestSec()` pure function.
- `src/lib/rest/resolve.test.ts` — unit tests for resolution.
- `src/lib/rest/timer.ts` — the `restTimer` store + start/adjust/skip/remaining/fire-once/hydrate.
- `src/lib/rest/timer.test.ts` — unit tests for timer logic.
- `src/lib/rest/alert.ts` — Web Audio beep + vibration helpers.
- `src/lib/components/RestTimer.svelte` — the global overlay pill.

**Modified files:**

- `src/lib/server/db/schema.ts` — new columns on `user` + `equipment`.
- `drizzle/` — generated migration(s).
- `src/lib/server/mutations.ts` — validators for the new fields.
- `src/routes/+layout.server.ts` — ship `restSettings` + `openRest`.
- `src/routes/+layout.svelte` — mount `<RestTimer>`, hydrate on load.
- `src/routes/log/[id]/+page.server.ts` — add `restTargetSec` to the equipment select.
- `src/routes/log/[id]/+page.svelte` — `afterSetLogged()` funnel + `primeAudio()`.
- `src/lib/components/AddEquipmentSheet.svelte` — rest-target field (create + edit).
- `src/routes/profile/+page.server.ts` + `+page.svelte` — global default + toggles UI.
- `src/lib/components/SessionBar.svelte` — remove the inline 90s rest math.
- `vite.config.ts` + `package.json` — Vitest wiring.
- `tests/smoke.mjs` — server-contract assertions for the new fields.

---

## Task 1: Add Vitest for pure-logic unit tests

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/rest/smoke.test.ts` (temporary sanity test, deleted at end of task)

- [ ] **Step 1: Install Vitest**

Run: `pnpm add -D vitest`
Expected: `vitest` appears under `devDependencies`.

- [ ] **Step 2: Add the test config to `vite.config.ts`**

Add a `test` block to the existing `defineConfig({...})` object (top level, sibling of `plugins`). Vitest reuses the SvelteKit Vite config so the `$lib` alias resolves:

```ts
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	},
```

If the file imports `defineConfig` from `'vite'`, switch the import to `'vitest/config'` so the `test` key type-checks:

```ts
import { defineConfig } from 'vitest/config';
```

- [ ] **Step 3: Add the test script to `package.json`**

In `"scripts"`, add:

```json
		"test:unit": "vitest run",
```

- [ ] **Step 4: Write a throwaway sanity test**

Create `src/lib/rest/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
	it('runs', () => {
		expect(1 + 1).toBe(2);
	});
});
```

- [ ] **Step 5: Run it to confirm the runner works**

Run: `pnpm test:unit`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Delete the throwaway test and commit**

```bash
rm src/lib/rest/smoke.test.ts
git add package.json pnpm-lock.yaml vite.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: `resolveRestSec` pure function (TDD)

**Files:**

- Create: `src/lib/rest/resolve.ts`
- Test: `src/lib/rest/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rest/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveRestSec, type RestSettings } from './resolve';

const on: RestSettings = { enabled: true, defaultSec: 90, sound: true, vibrate: true };
const off: RestSettings = { ...on, enabled: false };

describe('resolveRestSec', () => {
	it('returns 0 when the master toggle is off', () => {
		expect(resolveRestSec(120, off)).toBe(0);
		expect(resolveRestSec(null, off)).toBe(0);
	});

	it('inherits the global default when equipment target is null', () => {
		expect(resolveRestSec(null, on)).toBe(90);
	});

	it('uses the equipment target when set', () => {
		expect(resolveRestSec(180, on)).toBe(180);
	});

	it('treats an explicit 0 on equipment as "no timer"', () => {
		expect(resolveRestSec(0, on)).toBe(0);
	});

	it('treats a 0 global default with null equipment as "no timer"', () => {
		expect(resolveRestSec(null, { ...on, defaultSec: 0 })).toBe(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:unit resolve`
Expected: FAIL — `Cannot find module './resolve'`.

- [ ] **Step 3: Implement `resolve.ts`**

Create `src/lib/rest/resolve.ts`:

```ts
// Rest-timer resolution. The timer fires whenever the resolved value is > 0.
// `restTargetSec` null inherits the user's global default; an explicit 0 on
// the equipment disables the timer for that machine; the master toggle off
// disables it everywhere.

export interface RestSettings {
	enabled: boolean;
	defaultSec: number;
	sound: boolean;
	vibrate: boolean;
}

export function resolveRestSec(restTargetSec: number | null, settings: RestSettings): number {
	if (!settings.enabled) return 0;
	const target = restTargetSec ?? settings.defaultSec;
	return target > 0 ? target : 0;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test:unit resolve`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rest/resolve.ts src/lib/rest/resolve.test.ts
git commit -m "feat: rest duration resolution function"
```

---

## Task 3: Timer store with fire-once + hydrate (TDD)

**Files:**

- Create: `src/lib/rest/timer.ts`
- Test: `src/lib/rest/timer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rest/timer.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	restTimer,
	remainingSec,
	startRest,
	adjustRest,
	skipRest,
	shouldFireAlert,
	hydrateRest,
	__resetRestModule
} from './timer';
import type { RestSettings } from './resolve';

const settings: RestSettings = { enabled: true, defaultSec: 90, sound: true, vibrate: true };
const T0 = 1_000_000_000_000;

beforeEach(() => __resetRestModule());

describe('startRest + remainingSec', () => {
	it('starts a countdown from the set timestamp', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 90, equipmentId: 'e', equipmentName: 'Rack' });
		expect(remainingSec(get(restTimer), T0)).toBe(90);
		expect(remainingSec(get(restTimer), T0 + 30_000)).toBe(60);
		expect(remainingSec(get(restTimer), T0 + 200_000)).toBe(0);
	});

	it('resets adjust and clears any prior set on a new start', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 90, equipmentId: 'e', equipmentName: 'Rack' });
		adjustRest(15);
		startRest({ setId: 'b', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(get(restTimer)?.setId).toBe('b');
		expect(get(restTimer)?.adjustSec).toBe(0);
	});
});

describe('adjustRest', () => {
	it('extends and shortens without going below zero base', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		adjustRest(15);
		expect(remainingSec(get(restTimer), T0)).toBe(75);
		adjustRest(-15);
		adjustRest(-15);
		adjustRest(-60); // clamped so base+adjust >= 0
		expect(remainingSec(get(restTimer), T0)).toBe(0);
	});
});

describe('skipRest', () => {
	it('clears the timer', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		skipRest();
		expect(get(restTimer)).toBeNull();
	});
});

describe('shouldFireAlert', () => {
	it('fires exactly once when the countdown first hits zero', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(shouldFireAlert(get(restTimer), T0 + 30_000)).toBe(false); // still running
		expect(shouldFireAlert(get(restTimer), T0 + 60_000)).toBe(true); // hits zero
		expect(shouldFireAlert(get(restTimer), T0 + 61_000)).toBe(false); // already fired
	});

	it('fires again for a fresh set after a restart', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		shouldFireAlert(get(restTimer), T0 + 60_000);
		startRest({ setId: 'b', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(shouldFireAlert(get(restTimer), T0 + 60_000)).toBe(true);
	});
});

describe('hydrateRest', () => {
	const open = {
		setId: 'a',
		ts: T0,
		equipmentId: 'e',
		equipmentName: 'Rack',
		restTargetSec: null
	};

	it('resumes a still-running rest and will alert when it crosses zero', () => {
		hydrateRest(open, settings, T0 + 30_000);
		expect(remainingSec(get(restTimer), T0 + 30_000)).toBe(60);
		expect(shouldFireAlert(get(restTimer), T0 + 90_000)).toBe(true);
	});

	it('resumes a past-due rest without beeping on load', () => {
		hydrateRest(open, settings, T0 + 200_000);
		expect(remainingSec(get(restTimer), T0 + 200_000)).toBe(0);
		expect(shouldFireAlert(get(restTimer), T0 + 200_000)).toBe(false);
	});

	it('does nothing when resolved rest is 0', () => {
		hydrateRest({ ...open, restTargetSec: 0 }, settings, T0);
		expect(get(restTimer)).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:unit timer`
Expected: FAIL — `Cannot find module './timer'`.

- [ ] **Step 3: Implement `timer.ts`**

Create `src/lib/rest/timer.ts`:

```ts
// Rest-timer store (Approach A). The store holds a descriptor of the
// triggering set, not a ticking counter; remaining() is derived from
// Date.now() each tick. `firedFor` guarantees the end-alert plays exactly
// once even as the 1s tick re-evaluates.

import { writable } from 'svelte/store';
import { resolveRestSec, type RestSettings } from './resolve';

export interface RestState {
	setId: string;
	startTs: number; // ms — the set's ts
	baseSec: number;
	adjustSec: number;
	equipmentId: string;
	equipmentName: string;
}

export const restTimer = writable<RestState | null>(null);

let firedFor: string | null = null;

export function remainingSec(state: RestState | null, now: number): number {
	if (!state) return 0;
	const endMs = state.startTs + (state.baseSec + state.adjustSec) * 1000;
	return Math.max(0, Math.round((endMs - now) / 1000));
}

export function startRest(desc: Omit<RestState, 'adjustSec'>): void {
	firedFor = null;
	restTimer.set({ ...desc, adjustSec: 0 });
}

export function adjustRest(deltaSec: number): void {
	restTimer.update((s) => {
		if (!s) return s;
		// Never let base + adjust drop below 0.
		const nextAdjust = Math.max(-s.baseSec, s.adjustSec + deltaSec);
		return { ...s, adjustSec: nextAdjust };
	});
}

export function skipRest(): void {
	firedFor = null;
	restTimer.set(null);
}

// Returns true exactly once — when `state` first reaches 0 and its alert
// hasn't fired. Has the side effect of marking the alert fired.
export function shouldFireAlert(state: RestState | null, now: number): boolean {
	if (!state) return false;
	if (firedFor === state.setId) return false;
	if (remainingSec(state, now) > 0) return false;
	firedFor = state.setId;
	return true;
}

// Rehydrate from the open session's last set after a reload. If already
// past-due, mark the alert fired so a finished timer doesn't beep on load.
export function hydrateRest(
	openRest: {
		setId: string;
		ts: number;
		equipmentId: string;
		equipmentName: string;
		restTargetSec: number | null;
	} | null,
	settings: RestSettings,
	now: number
): void {
	if (!openRest) return;
	const baseSec = resolveRestSec(openRest.restTargetSec, settings);
	if (baseSec <= 0) return;
	const state: RestState = {
		setId: openRest.setId,
		startTs: openRest.ts,
		baseSec,
		adjustSec: 0,
		equipmentId: openRest.equipmentId,
		equipmentName: openRest.equipmentName
	};
	firedFor = remainingSec(state, now) <= 0 ? openRest.setId : null;
	restTimer.set(state);
}

// Test-only: reset module state between cases.
export function __resetRestModule(): void {
	firedFor = null;
	restTimer.set(null);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test:unit timer`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rest/timer.ts src/lib/rest/timer.test.ts
git commit -m "feat: rest timer store with fire-once and rehydrate"
```

---

## Task 4: Alert helpers (beep + vibrate)

**Files:**

- Create: `src/lib/rest/alert.ts`

Audio output can't be unit-tested meaningfully (no Web Audio in node); this is verified in the browser at Task 13. Keep the module side-effect-free on import.

- [ ] **Step 1: Implement `alert.ts`**

Create `src/lib/rest/alert.ts`:

```ts
// Rest-done alert: a short two-tone Web Audio beep plus an optional
// vibration. No assets; works offline. iOS only allows audio after a user
// gesture, so primeAudio() must be called from the set-log click handler.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const Ctor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	if (!ctx) ctx = new Ctor();
	return ctx;
}

// Call from a user gesture (logging a set) to unlock audio on iOS.
export function primeAudio(): void {
	const c = audioCtx();
	if (c && c.state === 'suspended') void c.resume();
}

function beep(c: AudioContext, freq: number, startSec: number, durSec: number): void {
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	const t = c.currentTime + startSec;
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
	osc.connect(gain).connect(c.destination);
	osc.start(t);
	osc.stop(t + durSec);
}

export function playRestDone(opts: { sound: boolean; vibrate: boolean }): void {
	if (opts.sound) {
		const c = audioCtx();
		if (c) {
			if (c.state === 'suspended') void c.resume();
			beep(c, 880, 0, 0.18);
			beep(c, 1175, 0.2, 0.22);
		}
	}
	if (opts.vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		navigator.vibrate([200, 100, 200]);
	}
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: no new errors from `alert.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rest/alert.ts
git commit -m "feat: rest-done audio + vibration alert helpers"
```

---

## Task 5: Schema columns + migration

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/<generated>.sql` (via `pnpm db:generate`)

- [ ] **Step 1: Add columns to the `user` table**

In `src/lib/server/db/schema.ts`, in the `user` table definition, immediately after the `bodyWeightKg: real('body_weight_kg'),` line, add:

```ts
	// Rest-timer settings. restDefaultSec is the global fallback used when an
	// equipment's restTargetSec is null. Booleans gate the master toggle and
	// the two alert channels (beep, vibration).
	restDefaultSec: integer('rest_default_sec').default(90).notNull(),
	restTimerEnabled: integer('rest_timer_enabled', { mode: 'boolean' }).default(true).notNull(),
	restSoundEnabled: integer('rest_sound_enabled', { mode: 'boolean' }).default(true).notNull(),
	restVibrateEnabled: integer('rest_vibrate_enabled', { mode: 'boolean' })
		.default(true)
		.notNull(),
```

- [ ] **Step 2: Add the column to the `equipment` table**

In the `equipment` table definition, immediately after the `bodyweightPct: real('bodyweight_pct'),` line, add:

```ts
	// Rest target in seconds for this machine. null = inherit the user's
	// global default; an explicit 0 = no timer for this equipment.
	restTargetSec: integer('rest_target_sec'),
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file under `drizzle/` adding the five columns; console shows the generated SQL.

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat: rest timer schema columns + migration"
```

---

## Task 6: Server validators for the new fields

**Files:**

- Modify: `src/lib/server/mutations.ts`

- [ ] **Step 1: Add a rest-seconds validator helper**

In `src/lib/server/mutations.ts`, after the `assertBodyweightPct` function (ends ~line 215), add:

```ts
// Rest duration in whole seconds, 0..3600 (1 hour ceiling). 0 means "no
// timer" for that equipment; null is handled by the caller as "inherit".
function assertRestSec(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		badRequest(`${label} must be an integer number of seconds`);
	}
	if (value < 0 || value > 3600) badRequest(`${label} must be between 0 and 3600`);
	return value;
}
```

- [ ] **Step 2: Extend the payload interfaces**

In the `EquipmentCreate` interface add:

```ts
	restTargetSec?: number | null;
```

In the `EquipmentUpdate` interface add:

```ts
	restTargetSec?: number | null;
```

Replace the `UserUpdate` interface with:

```ts
interface UserUpdate {
	bodyWeightKg?: number | null;
	restDefaultSec?: number;
	restTimerEnabled?: boolean;
	restSoundEnabled?: boolean;
	restVibrateEnabled?: boolean;
}
```

- [ ] **Step 3: Handle the new fields in `userUpdate`**

In `userUpdate()`, after the `bodyWeightKg` block and before the `if (Object.keys(updates).length === 1)` guard, add:

```ts
if (payload.restDefaultSec !== undefined) {
	updates.restDefaultSec = assertRestSec(payload.restDefaultSec, 'restDefaultSec');
}
if (payload.restTimerEnabled !== undefined) {
	if (typeof payload.restTimerEnabled !== 'boolean') {
		badRequest('restTimerEnabled must be a boolean');
	}
	updates.restTimerEnabled = payload.restTimerEnabled;
}
if (payload.restSoundEnabled !== undefined) {
	if (typeof payload.restSoundEnabled !== 'boolean')
		badRequest('restSoundEnabled must be a boolean');
	updates.restSoundEnabled = payload.restSoundEnabled;
}
if (payload.restVibrateEnabled !== undefined) {
	if (typeof payload.restVibrateEnabled !== 'boolean') {
		badRequest('restVibrateEnabled must be a boolean');
	}
	updates.restVibrateEnabled = payload.restVibrateEnabled;
}
```

- [ ] **Step 4: Handle `restTargetSec` in `equipmentCreate`**

In `equipmentCreate()`, after the `bodyweightPct` const (ends ~line 383) add:

```ts
const restTargetSec =
	payload.restTargetSec == null ? null : assertRestSec(payload.restTargetSec, 'restTargetSec');
```

Then add `restTargetSec` to the `.values({...})` insert object (alongside `bodyweightPct`).

- [ ] **Step 5: Handle `restTargetSec` in `equipmentUpdate`**

In `equipmentUpdate()`, after the `bodyweightPct` block (ends ~line 579) add:

```ts
if (payload.restTargetSec !== undefined) {
	updates.restTargetSec =
		payload.restTargetSec === null ? null : assertRestSec(payload.restTargetSec, 'restTargetSec');
	hasUserField = true;
}
```

- [ ] **Step 6: Type-check**

Run: `pnpm check`
Expected: no errors (the `Partial<Equipment>`/`Partial<User>` update objects now include the new columns from Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/mutations.ts
git commit -m "feat: validate rest timer fields in mutations"
```

---

## Task 7: Ship rest settings + open-rest descriptor from the layout loader

**Files:**

- Modify: `src/routes/+layout.server.ts`

- [ ] **Step 1: Add imports**

At the top of `src/routes/+layout.server.ts`, extend the schema import and the drizzle-orm import:

```ts
import {
	achievement,
	user,
	workoutSession,
	set as setTable,
	exercise,
	equipment
} from '$lib/server/db/schema';
import { and, eq, isNull, asc, desc } from 'drizzle-orm';
```

- [ ] **Step 2: Return `restSettings` + `openRest` for logged-in users**

Replace the body after `depends('app:achievements');` and the `if (!locals.user) { return ... }` early-return so the early return also includes the new keys:

```ts
if (!locals.user) {
	return { achievementQueue: [], isAdmin: false, restSettings: null, openRest: null };
}
```

Then, before the final `return`, add:

```ts
const urow = (
	await db
		.select({
			restDefaultSec: user.restDefaultSec,
			restTimerEnabled: user.restTimerEnabled,
			restSoundEnabled: user.restSoundEnabled,
			restVibrateEnabled: user.restVibrateEnabled
		})
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1)
)[0];
const restSettings = {
	enabled: urow?.restTimerEnabled ?? true,
	defaultSec: urow?.restDefaultSec ?? 90,
	sound: urow?.restSoundEnabled ?? true,
	vibrate: urow?.restVibrateEnabled ?? true
};

// Open session's last set → descriptor used to rehydrate the rest timer
// after a reload. Cheap, single-indexed; mirrors the achievements query
// that already runs on every navigation.
const openSession = (
	await db
		.select({ id: workoutSession.id })
		.from(workoutSession)
		.where(and(eq(workoutSession.userId, locals.user.id), isNull(workoutSession.endedAt)))
		.orderBy(desc(workoutSession.startedAt))
		.limit(1)
)[0];
let openRest: {
	setId: string;
	ts: number;
	equipmentId: string;
	equipmentName: string;
	restTargetSec: number | null;
} | null = null;
if (openSession) {
	const last = (
		await db
			.select({
				setId: setTable.id,
				ts: setTable.ts,
				equipmentId: equipment.id,
				equipmentName: equipment.name,
				restTargetSec: equipment.restTargetSec
			})
			.from(setTable)
			.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
			.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
			.where(and(eq(setTable.workoutSessionId, openSession.id), isNull(setTable.deletedAt)))
			.orderBy(desc(setTable.ts))
			.limit(1)
	)[0];
	if (last) {
		openRest = {
			setId: last.setId,
			ts: last.ts.getTime(),
			equipmentId: last.equipmentId,
			equipmentName: last.equipmentName,
			restTargetSec: last.restTargetSec
		};
	}
}
```

Update the final return to include them:

```ts
return {
	achievementQueue: rows,
	isAdmin: locals.user.role === 'admin',
	restSettings,
	openRest
};
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.server.ts
git commit -m "feat: ship rest settings and open-rest descriptor from layout"
```

---

## Task 8: RestTimer overlay component + mount in layout

**Files:**

- Create: `src/lib/components/RestTimer.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/RestTimer.svelte`:

```svelte
<script lang="ts">
	// Global rest-timer overlay. Rendered once in +layout.svelte so it
	// survives navigation. Reads the shared restTimer store; a single 1s
	// interval drives `now`. The countdown is derived (pure); the alert
	// fires exactly once via shouldFireAlert().

	import { onDestroy } from 'svelte';
	import { restTimer, remainingSec, adjustRest, skipRest, shouldFireAlert } from '$lib/rest/timer';
	import { playRestDone } from '$lib/rest/alert';
	import type { RestSettings } from '$lib/rest/resolve';

	let { settings }: { settings: RestSettings | null } = $props();

	let now = $state(Date.now());
	const handle = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(handle));

	const state = $derived($restTimer);
	const remaining = $derived(remainingSec(state, now));
	const done = $derived(state != null && remaining === 0);

	$effect(() => {
		if (state && shouldFireAlert(state, now)) {
			playRestDone({ sound: settings?.sound ?? true, vibrate: settings?.vibrate ?? true });
			const finishedId = state.setId;
			setTimeout(() => {
				restTimer.update((s) => (s && s.setId === finishedId ? null : s));
			}, 5000);
		}
	});

	function fmt(s: number): string {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}
</script>

{#if state}
	<div
		class="fixed inset-x-0 z-20 mx-auto w-full max-w-[480px] px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 122px);"
	>
		<div
			class="flex items-stretch gap-2 rounded-2xl border px-3 py-2"
			class:rest-done={done}
			style="background: var(--color-surface); border-color: var(--color-line); backdrop-filter: blur(8px);"
		>
			<div class="flex min-w-0 flex-1 flex-col justify-center">
				<div
					class="truncate text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					{done ? 'Rest done' : 'Resting'} · {state.equipmentName}
				</div>
				<div class="text-[20px] font-bold tabular-nums" style="color: var(--color-text);">
					{fmt(remaining)}
				</div>
			</div>
			<button
				type="button"
				onclick={() => adjustRest(-15)}
				class="flex-shrink-0 rounded-xl border px-3 text-[13px] font-semibold active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text);"
				aria-label="Subtract 15 seconds">−15</button
			>
			<button
				type="button"
				onclick={() => adjustRest(15)}
				class="flex-shrink-0 rounded-xl border px-3 text-[13px] font-semibold active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text);"
				aria-label="Add 15 seconds">+15</button
			>
			<button
				type="button"
				onclick={() => skipRest()}
				class="flex w-10 flex-shrink-0 items-center justify-center rounded-xl border active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text-dim);"
				aria-label="Skip rest"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.rest-done {
		animation: rest-pulse 0.8s ease-in-out 0s 4;
		border-color: var(--color-green, #4ade80) !important;
	}
	@keyframes rest-pulse {
		0%,
		100% {
			background: var(--color-surface);
		}
		50% {
			background: color-mix(in srgb, var(--color-green, #4ade80) 22%, var(--color-surface));
		}
	}
</style>
```

> Note on placement: the `122px` bottom offset stacks this pill _above_ the `SessionBar` (which sits at `65px` + safe area). If the theme has no `--color-green` token, the `#4ade80` fallback in `color-mix`/`border-color` is used; if a green token exists in `src/lib/theme.css`, drop the fallback.

- [ ] **Step 2: Mount it in `+layout.svelte`**

In `src/routes/+layout.svelte`:

Change the props line:

```ts
let { children, data } = $props();
```

Add the imports near the other component imports:

```ts
import RestTimer from '$lib/components/RestTimer.svelte';
import { hydrateRest } from '$lib/rest/timer';
```

Inside the existing `onMount(() => { ... })`, after `startSyncRuntime();`, add:

```ts
if (data.restSettings) {
	hydrateRest(data.openRest, data.restSettings, Date.now());
}
```

Add the component to the markup, after `<AchievementHost />`:

```svelte
<RestTimer settings={data.restSettings} />
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: no errors. `data.restSettings`/`data.openRest` resolve from the Task 7 `LayoutData`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/RestTimer.svelte src/routes/+layout.svelte
git commit -m "feat: global rest timer overlay + rehydrate on load"
```

---

## Task 9: Start the timer when a set is logged

**Files:**

- Modify: `src/routes/log/[id]/+page.server.ts`
- Modify: `src/routes/log/[id]/+page.svelte`

- [ ] **Step 1: Add `restTargetSec` to the log loader's equipment select**

In `src/routes/log/[id]/+page.server.ts`, in the `.select({...})` for equipment (the block with `bodyweightPct: equipment.bodyweightPct,` and `inputMode: equipment.inputMode,`), add:

```ts
				restTargetSec: equipment.restTargetSec,
```

- [ ] **Step 2: Add imports to the log page**

In `src/routes/log/[id]/+page.svelte`, in the existing import block add:

```ts
import { startRest } from '$lib/rest/timer';
import { primeAudio } from '$lib/rest/alert';
import { resolveRestSec } from '$lib/rest/resolve';
```

- [ ] **Step 3: Add the `afterSetLogged` funnel + `fmtRest` is already present**

Below the `setTs()` function definition (near the top of `<script>`), add:

```ts
// Start the rest timer after a live set is logged. Backdated edits to a
// closed session (asOfTs != null) never start a timer. No-op when the
// resolved rest is 0 (master off, or this equipment set to 0).
function afterSetLogged(setId: string) {
	if (asOfTs != null) return;
	const target = (eq as { restTargetSec?: number | null }).restTargetSec ?? null;
	const baseSec = resolveRestSec(
		target,
		data.restSettings ?? {
			enabled: true,
			defaultSec: 90,
			sound: true,
			vibrate: true
		}
	);
	if (baseSec <= 0) return;
	startRest({
		setId,
		startTs: Date.now(),
		baseSec,
		equipmentId: eq.id,
		equipmentName: eq.name
	});
}
```

- [ ] **Step 4: Prime audio + start the timer in `logSet`**

In the main set-logging handler (`logSet`), at the very start of the `try` block (before the mode branching), add the audio unlock — this runs inside the button-click gesture:

```ts
primeAudio();
```

Then, at the convergence point after all mode branches — immediately after the line `justSaved = true;` (~line 381) — add:

```ts
afterSetLogged(id);
```

(`id` is the const minted at the top of `logSet` for the new set.)

- [ ] **Step 5: Start the timer in `handleClone`**

In `handleClone`, the cloned set id is currently minted inline as `ulid()` in each branch. Capture it once at the top of the function instead. Add as the first line of the `try`:

```ts
const cloneId = ulid();
primeAudio();
```

Replace each `id: ulid(),` inside `handleClone` with `id: cloneId,` (there are four branches: `timed`, `timed_weighted`, `weight_distance`, and the `else`). Then, immediately after `lastLogAt = Date.now();` near the end of the function, add:

```ts
afterSetLogged(cloneId);
```

- [ ] **Step 6: Type-check**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/log/[id]/+page.server.ts" "src/routes/log/[id]/+page.svelte"
git commit -m "feat: start rest timer on logged and cloned sets"
```

---

## Task 10: Per-equipment rest target field in AddEquipmentSheet

**Files:**

- Modify: `src/lib/components/AddEquipmentSheet.svelte`

The sheet handles both create (`mode !== 'edit'`) and edit (`mode === 'edit'`), builds a create payload (~line 220) and an edit diff (~line 290+). Add a rest field to both.

- [ ] **Step 1: Add reactive state for the field**

Near the other `$state` declarations (e.g. by `inputMode` ~line 62), add:

```ts
// Rest target in seconds. null = inherit the user's global default;
// 0 = no timer on this machine; >0 = explicit per-equipment rest.
let restTargetSec = $state<number | null>(
	mode === 'edit' ? ((editTarget!.restTargetSec as number | null) ?? null) : null
);
```

(`editTarget` is the existing edit-source object in this component; if the prop is named `equipment`, use that — match the existing `editTarget!.inputMode` references in the file.)

- [ ] **Step 2: Add the UI control**

In the form markup, after the input-mode control, add a small rest selector. Use a native select for the three-way (Inherit / Off / custom) plus a number input for the custom value:

```svelte
<label class="flex flex-col gap-1">
	<span class="text-[10px] font-bold tracking-[0.16em] uppercase" style="color: var(--color-text-dim-2);">
		Rest timer
	</span>
	<select
		value={restTargetSec === null ? 'inherit' : restTargetSec === 0 ? 'off' : 'custom'}
		onchange={(e) => {
			const v = (e.currentTarget as HTMLSelectElement).value;
			restTargetSec = v === 'inherit' ? null : v === 'off' ? 0 : Math.max(1, restTargetSec ?? 90);
		}}
		class="rounded-xl border px-3 py-2"
		style="background: var(--color-surface); border-color: var(--color-line); color: var(--color-text);"
	>
		<option value="inherit">Use default</option>
		<option value="off">Off</option>
		<option value="custom">Custom…</option>
	</select>
	{#if restTargetSec !== null && restTargetSec !== 0}
		<input
			type="number"
			min="1"
			max="3600"
			step="5"
			value={restTargetSec}
			oninput={(e) => (restTargetSec = Math.min(3600, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1)))}
			class="rounded-xl border px-3 py-2 tabular-nums"
			style="background: var(--color-surface); border-color: var(--color-line); color: var(--color-text);"
			aria-label="Rest seconds"
		/>
	{/if}
</label>
```

- [ ] **Step 3: Include `restTargetSec` in the create payload**

In the create payload object (the `mutate('equipment.create', {...})` call, ~line 220), add:

```ts
				restTargetSec,
```

- [ ] **Step 4: Include `restTargetSec` in the edit diff**

In the edit branch where the `diff` object is built (~line 296, alongside `if (inputMode !== initial.inputMode) diff.inputMode = inputMode;`), add:

```ts
if (restTargetSec !== (initial.restTargetSec ?? null)) {
	diff.restTargetSec = restTargetSec;
}
```

Also add `restTargetSec` to the `initial` snapshot object (the one with `inputMode`, ~line 86–87), reading from the edit source:

```ts
			restTargetSec: mode === 'edit' ? ((editTarget!.restTargetSec as number | null) ?? null) : null,
```

- [ ] **Step 5: Type-check**

Run: `pnpm check`
Expected: no errors. (The setup loader uses `.select()` full-row, so `restTargetSec` is already present on the edit source object.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/AddEquipmentSheet.svelte
git commit -m "feat: per-equipment rest target field"
```

---

## Task 11: Global rest settings on the Profile screen

**Files:**

- Modify: `src/routes/profile/+page.server.ts`
- Modify: `src/routes/profile/+page.svelte`

- [ ] **Step 1: Load the settings**

In `src/routes/profile/+page.server.ts`, extend the `.select({...})` to include the new columns:

```ts
			.select({
				bodyWeightKg: user.bodyWeightKg,
				restDefaultSec: user.restDefaultSec,
				restTimerEnabled: user.restTimerEnabled,
				restSoundEnabled: user.restSoundEnabled,
				restVibrateEnabled: user.restVibrateEnabled
			})
```

And add to the returned object:

```ts
		restDefaultSec: profile?.restDefaultSec ?? 90,
		restTimerEnabled: profile?.restTimerEnabled ?? true,
		restSoundEnabled: profile?.restSoundEnabled ?? true,
		restVibrateEnabled: profile?.restVibrateEnabled ?? true,
```

- [ ] **Step 2: Add the settings UI + save handlers**

In `src/routes/profile/+page.svelte`:

Ensure `mutate` is imported (it is used for the body-weight save; reuse it). Add reactive state seeded from `data`:

```ts
let restDefaultSec = $state(data.restDefaultSec);
let restTimerEnabled = $state(data.restTimerEnabled);
let restSoundEnabled = $state(data.restSoundEnabled);
let restVibrateEnabled = $state(data.restVibrateEnabled);

async function saveRest(patch: Record<string, number | boolean>) {
	await mutate('user.update', patch);
}
```

Add a "Rest timer" section to the markup (place it near the body-weight editor), following the screen's existing label/control styling:

```svelte
<section class="flex flex-col gap-3">
	<h2 class="text-[11px] font-bold tracking-[0.16em] uppercase" style="color: var(--color-text-dim-2);">
		Rest timer
	</h2>

	<label class="flex items-center justify-between">
		<span style="color: var(--color-text);">Enabled</span>
		<input
			type="checkbox"
			checked={restTimerEnabled}
			onchange={(e) => {
				restTimerEnabled = (e.currentTarget as HTMLInputElement).checked;
				saveRest({ restTimerEnabled });
			}}
		/>
	</label>

	<label class="flex items-center justify-between">
		<span style="color: var(--color-text);">Default rest (seconds)</span>
		<input
			type="number"
			min="0"
			max="3600"
			step="5"
			value={restDefaultSec}
			onchange={(e) => {
				restDefaultSec = Math.min(3600, Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0));
				saveRest({ restDefaultSec });
			}}
			class="w-24 rounded-xl border px-3 py-2 text-right tabular-nums"
			style="background: var(--color-surface); border-color: var(--color-line); color: var(--color-text);"
		/>
	</label>

	<label class="flex items-center justify-between">
		<span style="color: var(--color-text);">Sound</span>
		<input
			type="checkbox"
			checked={restSoundEnabled}
			onchange={(e) => {
				restSoundEnabled = (e.currentTarget as HTMLInputElement).checked;
				saveRest({ restSoundEnabled });
			}}
		/>
	</label>

	<label class="flex items-center justify-between">
		<span style="color: var(--color-text);">Vibration</span>
		<input
			type="checkbox"
			checked={restVibrateEnabled}
			onchange={(e) => {
				restVibrateEnabled = (e.currentTarget as HTMLInputElement).checked;
				saveRest({ restVibrateEnabled });
			}}
		/>
	</label>
</section>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/profile/+page.server.ts src/routes/profile/+page.svelte
git commit -m "feat: rest timer settings on profile screen"
```

---

## Task 12: Remove the duplicate rest readout from SessionBar

**Files:**

- Modify: `src/lib/components/SessionBar.svelte`

The global overlay now owns rest display. Strip SessionBar's inline 90s math so there aren't two competing timers.

- [ ] **Step 1: Remove the `restRemaining` derived + its `fmtRest`**

Delete the `restRemaining` `$derived` block (lines ~42-44) and the `fmtRest` function (lines ~46-50).

- [ ] **Step 2: Remove the rest markup**

Delete the `{#if restRemaining != null && restRemaining > 0} ... {/if}` block (lines ~106-114) inside the anchor.

- [ ] **Step 3: Remove the now-unused `lastSetTs` prop if nothing else uses it**

Search the component for `lastSetTs`. If the only remaining references were the ones just deleted, remove `lastSetTs` from the `$props()` destructure and its type. Then check the caller `src/routes/+page.svelte:469` (`<SessionBar ... />`) and remove the `lastSetTs={...}` attribute if present.

Run: `grep -n "lastSetTs" src/lib/components/SessionBar.svelte src/routes/+page.svelte`
Expected: no matches after the edits.

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SessionBar.svelte src/routes/+page.svelte
git commit -m "refactor: drop SessionBar's inline rest readout"
```

---

## Task 13: Server-contract smoke test + full browser verification

**Files:**

- Modify: `tests/smoke.mjs`

- [ ] **Step 1: Read the existing smoke test to match its style**

Run: `sed -n '1,80p' tests/smoke.mjs`
Goal: find how it authenticates, how it posts to `/api/mutate` (envelope: `{ clientId, mutationId, op, payload }` with ULID ids), and the assertion helper it uses.

- [ ] **Step 2: Add an equipment `restTargetSec` round-trip assertion**

Mirror the existing `equipment.update` case: update an equipment with `{ restTargetSec: 120 }`, then read it back (via the same GET/loader the file already uses for equipment) and assert the value persisted. Then send `{ restTargetSec: null }` and assert it clears, and `{ restTargetSec: -1 }` and assert a 400.

- [ ] **Step 3: Add a `user.update` rest-settings assertion**

Post `user.update` with `{ restDefaultSec: 75, restTimerEnabled: false, restSoundEnabled: false, restVibrateEnabled: true }` and assert a 200; post `{ restDefaultSec: 99999 }` and assert a 400.

- [ ] **Step 4: Run the smoke test**

Run: `pnpm test:smoke`
Expected: all assertions pass (the harness boots/points at a running server per the file's existing setup).

- [ ] **Step 5: Run the full unit suite + checks**

```bash
pnpm test:unit && pnpm check && pnpm lint
```

Expected: all green.

- [ ] **Step 6: Browser verification (per CLAUDE.md)**

Boot in Docker (`docker compose up`), then drive via chrome-devtools MCP as `admin@trajectory.local` / `change-me-on-first-login`:

1. Profile → set default rest to 5s, ensure enabled, sound + vibration on.
2. Equipment setup → edit a machine → set rest to "Custom" 4s; save.
3. Start a session, log a set on that machine → overlay appears counting down from 0:04.
4. Confirm `−15`/`+15` adjust the count and `✕` clears it.
5. Let it reach 0 → green pulse + audible beep; confirm console is clean.
6. Navigate Home mid-rest on a _different_ machine's 5s default → overlay persists and keeps counting.
7. Reload mid-rest → timer resumes (rehydrate); reload after it finished → no beep.
8. Profile → toggle "Enabled" off → log a set → no timer.

Fix any failures and re-run before the final commit.

- [ ] **Step 7: Commit**

```bash
git add tests/smoke.mjs
git commit -m "test: rest timer server-contract assertions"
```

---

## Self-review notes

- **Spec coverage:** data model (Task 5), resolution (Task 2), engine + fire-once + rehydrate (Task 3), trigger/`afterSetLogged` + backdate guard + audio prime (Task 9), overlay component + layout mount (Task 8), SessionBar dedupe (Task 12), per-equipment config (Task 10), global settings (Task 11), alerts (Task 4), validators (Task 6), layout data (Task 7), all testing tiers (Tasks 1–3 unit, Task 13 smoke + browser). All spec sections map to a task.
- **Type consistency:** `RestSettings { enabled, defaultSec, sound, vibrate }`, `RestState { setId, startTs, baseSec, adjustSec, equipmentId, equipmentName }`, and `openRest { setId, ts, equipmentId, equipmentName, restTargetSec }` are used identically across `resolve.ts`, `timer.ts`, `+layout.server.ts`, `+layout.svelte`, and the log page. Function names (`resolveRestSec`, `startRest`, `adjustRest`, `skipRest`, `shouldFireAlert`, `remainingSec`, `hydrateRest`, `primeAudio`, `playRestDone`) are consistent between definitions, tests, and call sites.
- **Open item for the implementer:** in Task 10, match the existing edit-source prop/var name in `AddEquipmentSheet.svelte` (`editTarget` vs `equipment`) — both appear in the file's current code; use whichever the surrounding edit-mode code already reads from.
