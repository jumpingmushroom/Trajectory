# Rest Timer — design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Summary

Upgrade the existing hardcoded 90-second rest readout into a real, configurable
rest timer. Today `SessionBar.svelte:42-44` derives a fixed 90s countdown from
the last set's `ts` and shows it only on the Home screen, with no alert. This
feature makes the duration per-equipment (with a global fallback), shows the
countdown as a global overlay that survives navigation, and alerts the user with
a beep, vibration, and a visual pulse when rest is up.

The timer is **client-only**. It is modeled as a pure function of data
(Approach A), consistent with the codebase's recent move toward "PRs/achievements
as a pure function of data": the countdown value is derived each tick from the
triggering set plus ephemeral overrides, not stored as a ticking counter.

## Locked decisions

- **Duration source:** per-equipment `restTargetSec` with a user-wide global fallback.
- **Trigger:** auto-start on every logged set (live sessions only).
- **Alerts:** Web Audio beep + `navigator.vibrate` + visual flash. **No** system
  notifications (no service-worker push, no permission flow).
- **Placement:** single app-level overlay (Svelte store) visible on the Log
  screen and Home; survives navigation between equipment.
- **Controls:** skip/dismiss, ±15s on the fly, master on/off in settings
  (plus independent sound and vibration toggles).

## Data model

New persisted fields. Both `equipment.update`/`equipment.create` and `user.update`
mutation ops already exist and flow through `/api/mutate`, so the new fields ride
the offline-safe sync path for free.

| Field | Table | Type / default | Via | Meaning |
|---|---|---|---|---|
| `restTargetSec` | `equipment` | `integer`, nullable | `equipment.create` / `.update` | This machine's rest target. `null` = inherit global. `0` = explicitly no timer. |
| `restDefaultSec` | `user` | `integer`, default `90` | `user.update` | Global fallback when equipment's value is null. |
| `restTimerEnabled` | `user` | `boolean`, default `true` | `user.update` | Master on/off. |
| `restSoundEnabled` | `user` | `boolean`, default `true` | `user.update` | Beep toggle. |
| `restVibrateEnabled` | `user` | `boolean`, default `true` | `user.update` | Vibration toggle. |

App columns on the Better Auth `user` table follow the existing `bodyWeightKg`
precedent. Two Drizzle migrations (one per table), generated via
`pnpm db:generate` and checked in. Server-side `equipment.update` and
`user.update` validators must accept the new fields and reject negatives /
non-integers.

## Resolution

`resolveRestSec(equipment, user): number`

1. If `!user.restTimerEnabled` → return `0` (timer off entirely).
2. `target = equipment.restTargetSec ?? user.restDefaultSec`.
3. Return `target`.

The timer fires whenever the resolved value is `> 0` — including cardio and
timed modes, per the "every logged set" decision. The escape hatch to silence a
machine where rest is meaningless (e.g. a treadmill) is setting that equipment's
`restTargetSec = 0`. `0` means "off", `null` means "inherit global".

## Timer engine (Approach A)

Store module `src/lib/rest/timer.ts`. The store holds a descriptor of the
*triggering set*, not a ticking counter:

```ts
restTimer = {
  setId: string,
  startTs: number,        // = the set's ts (ms)
  baseSec: number,        // resolveRestSec() snapshot at log time
  adjustSec: number,      // ephemeral ±15 accumulator
  equipmentId: string,
  equipmentName: string
} | null
```

- `remaining(now) = max(0, startTs/1000 + baseSec + adjustSec − now/1000)` —
  pure, derived each tick. No interval-counting, so no drift; accurate after
  backgrounding.
- Module-level `firedFor: string | null` tracks the set whose alert has already
  played, so the alert fires **exactly once** when `remaining` first reaches 0.
- `start(desc)` overwrites the store, resets `adjustSec` to 0, clears `firedFor`.
- `adjust(±15)` mutates `adjustSec` (does not change any saved default).
- `skip()` sets the store to `null`.
- **Rehydrate on app load:** if an open session exists, seed the store from its
  last set. If that rest is already past-due at hydration, set `firedFor` to that
  set's id so a long-finished timer does not beep on reload; a still-running one
  will beep normally when it crosses zero.

### Trigger

After each successful `mutate('set.create')` in the Log page, call
`restTimer.start(...)`. There are ~8 `set.create` call sites
(`src/routes/log/[id]/+page.svelte`); funnel them through one local
`afterSetLogged()` helper that:

- guards on `asOfTs == null` so **backdated edits to closed sessions never start
  a timer**;
- computes `baseSec = resolveRestSec(equipment, user)` and only starts when
  `baseSec > 0`.

## Components

- **`src/lib/components/RestTimer.svelte`** — the global overlay pill. Rendered
  once in `+layout.svelte` so it survives navigation. Shows `m:ss`, `−15` / `+15`
  buttons, and a skip (✕) button. A single 1s `setInterval` in this component
  drives a local `now` used for the derived `remaining`. At 0 it shows a green
  "Rest done" pulse and auto-clears on the next set or after ~5s.
- **Dedupe with SessionBar:** remove the inline rest math from
  `SessionBar.svelte` (lines 42-44 and 106-114). SessionBar keeps session elapsed
  time + set count only. The global overlay is the single rest UI.
- **`src/lib/rest/alert.ts`** — alert helpers:
  - Web Audio two-tone beep via a lazily-created `AudioContext`, unlocked by the
    set-log user gesture (so it works on iOS); silently no-ops if not yet
    unlocked.
  - `navigator.vibrate([200, 100, 200])` when supported.
  - Each gated by its user toggle. Visual pulse is handled by the component and
    always shows.

## Configuration UI

- **Per-equipment `restTargetSec`** — a stepper in `AddEquipmentSheet`
  (create + edit) with an "Inherit (90s)" default position and an "Off" (0)
  position.
- **Global `restDefaultSec` + toggles** — on the Profile screen, alongside the
  existing `bodyWeightKg` editor (persists via `user.update`): default-rest
  stepper, master on/off, sound toggle, vibration toggle.

## Edge cases

- **Session ends / set deleted / equipment switch mid-rest:** `session.end` and
  `set.delete` clear the timer via `skip()`. Logging on different equipment calls
  `start()` again (overwrite). Navigation alone does nothing — the store is
  app-level.
- **Backdated / historical edits:** the `asOfTs != null` path must not start a
  timer (guarded in `afterSetLogged()`).
- **Cardio / timed / no body weight:** timer still fires when resolved `> 0`;
  per-equipment `0` disables it.
- **Master toggle off:** `resolveRestSec` returns 0 → `start()` is a no-op and
  any running timer is hidden.
- **iOS audio not yet unlocked:** beep no-ops; vibration + visual still fire; the
  next set-log tap unlocks audio for subsequent rests.
- **Offline / clock skew:** all math is local `Date.now()` vs the set's local
  `ts`. No server round-trip; works fully offline.

## Testing

- **Unit (Vitest):** `resolveRestSec` truth table (enabled/disabled,
  null-inherit, 0-off); `remaining()` math; fired-once invariant; rehydrate sets
  `firedFor` correctly for past-due vs running.
- **Server contract (`tests/smoke.mjs`):** `equipment.update` accepts
  `restTargetSec`; `user.update` accepts the four new fields; validator rejects
  negatives / non-integers.
- **e2e (Playwright, optional):** log a set → overlay appears → counts down →
  skip clears it.
- **Browser verify before commit** (per CLAUDE.md): Docker boot + chrome-devtools
  — log a real set, watch the countdown, confirm the beep, reach 0, confirm a
  clean console.

## Out of scope

- System/background notifications and service-worker push.
- "Long-press timer to save as the equipment's new default" (overlaps with the
  equipment-screen editor; deferred).
- Per-set-index rest variation.
- Auto-advance to next exercise / superset flow.
