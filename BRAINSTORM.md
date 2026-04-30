# Trajectory — Brainstorm Notes

Captures the live brainstorming session that turned the kickoff prompt + design handoff into the v0.1 specification. Each decision shows the question that prompted it, the option chosen, and the reasoning. Future sessions should read this before changing any of the listed conclusions.

Date: 2026-04-29
Phase: 2 of kickoff workflow (brainstorming).
Next: Phase 3 (grilling).

---

## Q1 — Multi-user shape

**Decision: shared equipment, per-user sessions and sets.**

- Equipment list is gym-wide. When one user adds "Cable Row #3 by the mirror," the other sees it. Equipment is a property of the gym, not of the lifter.
- Sessions and sets are per-user. Johnny's bench numbers and Alina's bench numbers never mix in a chart.
- Cross-user "peek at partner's last set" overlay is deferred to FUTURE.md.

Schema implication: `equipment.gymId` only (no `userId`); `session.userId`; `set.userId`.

---

## Q2 — The dumbbell / barbell-rack problem

**Decision: equipment is the physical object; exercises are children.**

- A piece of equipment (e.g. "Adjustable Dumbbells", "Power Rack") has one or more child `exercise` rows.
- Machines and cables auto-create a single hidden exercise (`isHidden=true`) named after the equipment. The user never sees the extra layer for the 80% machine case.
- Free-weight stations expose an exercise picker before the weight stepper. Adding a new exercise pulls from a curated list (see Q9).
- All sets always FK to an exercise. No special-case for "machines have no exercise."

Schema implication: `exercise(id, equipmentId, name, isHidden, sortOrder)`; `set.exerciseId` is the FK target (not `equipmentId`).

---

## Q3 — Session boundary

**Decision: implicit sessions by inactivity, 90-minute window, 6-hour safety auto-close.**

- No "Start workout" button anywhere.
- First set logged after >90 min of inactivity creates a new session. `session.gymId` is captured at that moment from the active gym.
- Subsequent sets within 90 min of the last set extend the session.
- Safety: any open session whose last set is >6 h old gets auto-closed (server-side check on next request, plus client-side check on app open).
- "Split session here" affordance on History → FUTURE.md.

Why 90 min: real lifting includes 3–5 min rests on heavy compounds. 60 min would split leg days. The only failure mode (training twice in 90 min) essentially never happens.

---

## Q4 — Offline-first sync strategy

**Decision: best-effort offline with last-write-wins.**

Concrete shape:
- IndexedDB mirror of `set`, `session`, `equipment`, `exercise`. User profile and auth stay online-only.
- Mutations write local first, then POST to `/api/mutate`.
- Endpoint is idempotent on `(clientId, mutationId)` — replays are no-ops. `mutation_log` table enforces this.
- All mutable rows carry `updatedAt`. Conflicts resolve latest-wins.
- Soft delete via `deletedAt`. Sync replays tombstones.
- On reconnect: queue drains FIFO, failures retry with exponential backoff.
- No CRDTs, no version vectors, no merge UI.

Why LWW is enough: two users with separate set IDs can never conflict on sets. The only conflict surface is equipment edits (rare, intentional, last-write-wins is fine).

---

## Q5 — Multi-gym in v0.1

**Decision: ship multi-gym as designed.**

- `equipment.gymId`, GymChip on Home, GymSheet switcher, gym filter on History, multi-gym Setup hierarchy — all in v0.1.
- First-run flow creates one default gym ("Home Gym" or whatever the user names it) so empty state isn't broken.
- The work is already done in the prototype. Stripping multi-gym now would mean doing it twice (you and Alina realistically travel; the seed already imagined SATS Sandefjord and Home Garage).

---

## Q6 — Equipment imagery

**Decision: glyph default + optional photo.**

- `equipment.glyph`: text, one of 11 keys (`bench`, `cable`, `pulldown`, `smith`, `squat`, `legpress`, `preacher`, `chestpress`, `treadmill`, `bike`, `rower`). Required, default `bench`.
- `equipment.tint`: text hex, default `#1c2026`.
- `equipment.photoPath`: text, nullable. Path under `data/uploads/equipment/`.
- Tile renders photo if present, else glyph + tint gradient.
- Setup wizard's photo step is optional; glyph picker is the primary control.
- Photos written via `sharp` (resize to 1080px max, strip EXIF, encode as webp).

---

## Q7 — Cardio scope in v0.1

**Decision: full cardio templates, baked-in per `equipment.cardioKind`.**

- `equipment.cardioKind` enum: `treadmill | bike | rower | generic`. Required when `equipment.type='cardio'`, null otherwise.
- Optional-field set per kind is hardcoded in the Svelte component (matching the design):

| Kind | Required | Optional |
|---|---|---|
| treadmill | duration | distance, incline, calories, avg HR |
| bike | duration | distance, level, avg RPM, calories, avg HR |
| rower | duration | distance, 500m split, avg SPM, calories, avg HR |
| generic | duration | distance, calories, avg HR |

- Logged data: `set.durationMin` + `set.extras` (JSON).
- Derived metrics (avg speed, pace) computed at render time, not stored.
- User-customizable cardio templates → FUTURE.md.

Notes from discussion:
- Calories everywhere because it's the universal metric people balance against food.
- HR everywhere including treadmill (smart-watch-tracked, treadmill grips ignored).
- Watts on bike/rower deliberately cut from v0.1 to keep surface tight.

---

## Q8 — Stats screen scope

**Decision: per-machine top-set sparkline list + muscle-group distribution + CSV export.**

Kept from handoff:
- Per-machine cards with top-set sparkline + delta indicator.
- Muscle-group distribution bars (push/pull/legs/core strength sets last 30 days; cardio gets its own summary section).
- CSV export button.
- History heatmap (it's a frequency view, not progression).

Cut from handoff:
- Top set / Est. 1RM / Volume metric segmented control. Spec explicitly excludes 1RM. Volume is borderline and adds rollup ambiguity, so cut for v0.1.

---

## Q9 — Exercise picker for free-weight stations

**Decision: curated picker grouped by `equipment.type`, with free-text custom escape hatch.**

- Picker only fires for free-weight stations (machines/cables auto-create their hidden exercise from `equipment.name`).
- Curated list ships as a hardcoded constant (~30 entries) grouped by station type:
  - Dumbbells: DB Bench, DB Row, DB Curl, DB OHP, DB Lateral Raise, DB Lunge, …
  - Power Rack / Barbell: Squat, Deadlift, OHP, Bent Row, Front Squat, Romanian Deadlift, …
  - Plate-loaded freeweight: similar curated list.
- "+ Custom" at bottom of picker → text input. Custom names are persisted as exercises and can be reused.
- v1 may promote the curated list to a real `exerciseLibrary` table.

Solves the drift problem ("DB Bench" vs "DB Bench Press" vs "Dumbbell Bench" become three distinct exercises with three separate progressions) for the 95% case while keeping the door open.

---

## Resulting design summary (one-page version)

**Stack**: SvelteKit 2 + Svelte 5 + TypeScript · Drizzle + better-sqlite3 + SQLite · Better Auth · Tailwind CSS 4 · `@vite-pwa/sveltekit` for PWA · single Docker container (Node 22 alpine) · host bind-mounts for `data/db.sqlite` and `data/uploads/`.

**Schema** (all PKs ULIDs, all mutable rows have `updatedAt`, soft-delete via `deletedAt`):
- `user` (Better Auth managed)
- `gym` (id, name, city, tint, isPrimary)
- `equipment` (id, gymId, name, type, group, glyph, tint, photoPath?, cardioKind?, sortOrder)
- `exercise` (id, equipmentId, name, isHidden, sortOrder)
- `session` (id, userId, gymId, startedAt, endedAt?)
- `set` (id, userId, sessionId, exerciseId, weight?, reps?, durationMin?, extras JSON?, ts)
- `mutation_log` (clientId, mutationId, userId, appliedAt) — sync idempotency

**Screens** (port React → Svelte): Home, Log (strength + cardio variants), Detail, History, SessionDetail, Stats, Setup. New: Login, First-run setup, Profile pane.

**Seeded users**: two via env var on first run, password reset on first login.

**MVP boundary**: see kickoff prompt's "v0.1 must do exactly this and no more" list. Everything else lives in FUTURE.md.

---

## Open items not yet decided

- Login screen visual design — agreed to sketch in same dark/amber idiom during Milestone 4/5; no upfront mock needed.
- Profile pane visual design — same as Login.
- Whether to ship a default starter equipment kit on first-run (e.g., "Add common gym machines"?). Probably no — Setup is fast enough.
- "Walk order" sort on Home — deferred but `equipment.sortOrder` column exists in schema for future activation.

These are flagged in ROADMAP.md once Phase 4 runs.
