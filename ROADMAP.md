# Trajectory — v0.1 Roadmap

Twelve milestones from empty repo to "Johnny and Alina log a workout end-to-end on their phones, CSV export works."

Each milestone has a clear **Done** definition. Don't mark complete until every bullet under Done is verifiable.

Milestones are sequenced by dependency. Sub-bullets within a milestone are not strictly ordered.

Every milestone ends with a commit + push to `origin/main` (or merge of a feature branch). After M1, work happens on feature branches like `m4-setup-screen` that merge to `main` when the milestone closes.

---

## M1 — Docker dev environment + SvelteKit hello world

Foundation milestone. Defined explicitly in the kickoff prompt.

**Work:**
- `pnpm create svelte@latest` scaffold (TypeScript, Svelte 5, ESLint + Prettier).
- Tailwind CSS 4 set up with a `theme.css` exporting the locked design tokens (focus mood + standard density + amber accent).
- `Dockerfile` with `dev` target (Node 22 alpine, `pnpm install`, `pnpm dev` on `0.0.0.0:5173` with Vite `usePolling: true`).
- `docker-compose.yml` bind-mounting `./` to `/app` (dev), exposing port 5173, creating `data/` directory bind-mounted to `/app/data`.
- A single `+page.svelte` that says "Trajectory" in the design's amber-on-dark style.
- A trivial server-side touch on first load that creates `data/.placeholder` to verify the bind mount works.
- README at repo root with a single `docker compose up` instruction and the localhost URL.

**Done when:**
- Fresh clone of the repo + `docker compose up` brings up the app with no manual steps.
- Browser at `http://localhost:5173` shows "Trajectory" styled per the design.
- Editing `src/routes/+page.svelte` triggers HMR within the container — browser updates without container restart.
- `data/.placeholder` appears on the host filesystem after first request and survives `docker compose down && docker compose up`.
- `docker compose down -v` does NOT delete `data/` (because it's a bind mount, not a named volume).

---

## M2 — Better Auth + 2 seeded users + first-run flow

Auth and identity. Everything after this is per-user.

**Work:**
- Verify Better Auth + SvelteKit + PWA combination has a working reference example before committing (Context7 lookup on Better Auth docs). If story is broken, fall back to Lucia.
- Better Auth installed; SQLite adapter configured to share the app's database file.
- Seed mechanism: env var `SEED_USERS=johnny:initialpw,alina:initialpw` consumed at boot. If users don't exist in the `user` table, create them with the provided passwords.
- Force password change on first login (Better Auth supports a `mustChangePassword` flag or equivalent — verify during implementation; otherwise add a `user.mustChangePassword` boolean column).
- Login screen: minimal centered card, dark/amber idiom. Email + password + Sign In.
- Logged-out routing: every route except `/login` redirects to `/login`.
- Profile pane: gear icon top-right of Setup screen → bottom sheet with name, email, change password, sign out, "Trajectory v0.1.0 (build <sha>)".
- First-run gym wizard: when `user` exists but no `gym` rows exist, redirect to `/setup/first-run` after login. Asks for gym name + city. Creates the row, lands on Home.

**Done when:**
- Booting a fresh container with `SEED_USERS=test:testpw` creates the user.
- Logging in as `test/testpw` requires changing the password before reaching Home.
- After password change, second login works with the new password.
- Reaching `/` without a session redirects to `/login`.
- After login with no gym, lands on first-run wizard; after creating a gym, lands on Home.
- Profile pane reachable via gear icon, shows correct name/email, sign-out works.

---

## M3 — Drizzle schema + migrations + SQLite operational profile

The data layer. Everything else writes through this.

**Work:**
- Drizzle schema for all tables in BRAINSTORM.md: `gym`, `equipment`, `exercise`, `session`, `set`, `mutation_log`. (`user` is Better Auth's; just reference it.)
- Indexes per BRAINSTORM.md.
- `drizzle-kit generate` produces SQL migrations; checked into `drizzle/`.
- Boot script: take SQLite snapshot via `.backup` to `data/db.sqlite.pre-migration-<ISO timestamp>`, then run pending migrations.
- `PRAGMA journal_mode=WAL; synchronous=NORMAL; foreign_keys=ON;` set on every connection.
- `SIGTERM` handler in the SvelteKit Node server that calls `db.close()` cleanly.
- ULID generation utility (`src/lib/server/ulid.ts`).
- Server-side ULID validation helper used by every mutation endpoint.
- Drizzle relational query helpers that default to `WHERE deletedAt IS NULL` (small wrapper, ~50 LOC).

**Done when:**
- `docker compose up` on a fresh `data/` runs all migrations cleanly.
- A subsequent `docker compose up` (existing DB) runs zero migrations and creates a snapshot only if there are migrations to run.
- A failing migration (test by hand-editing a generated SQL to be invalid) leaves the snapshot intact and the container surfaces the error.
- `pragma journal_mode` returns `wal` on a live connection.
- `kill -TERM` on the container produces graceful shutdown logs (no truncated WAL on next boot).

---

## M4 — Setup screen + equipment + exercise CRUD + photo upload

The first user-facing data-entry screen. Equipment-first foundation.

**Work:**
- Port `SetupScreen` from `screens.jsx` to `+page.svelte`. Gym cards, expand/collapse, "Add another gym" form.
- Port `AddEquipmentSheet` to a Svelte modal. 3 steps: photo/glyph chooser → name + type (+ cardioKind if cardio) → muscle group.
- Glyph chooser shows all 11 glyphs as a grid; default `bench`.
- Photo upload: drag/select file → POST to `/api/equipment/<id>/photo` → server runs `sharp` (resize to 1080px max long edge, strip EXIF, encode webp) → write to `data/uploads/equipment/<id>.webp` → DB updates `equipment.photoPath`.
- Static route `/uploads/*` serves files from `data/uploads/` (read-only).
- Exercise CRUD for free-weight stations: tap equipment → exercise list → "+ Add exercise" → curated picker grouped by `equipment.type` + "+ Custom" text input.
- Curated exercise list as `src/lib/exercises.ts` constant.
- Edit-in-place rename for both equipment and exercise (per D5).
- Delete with set-count confirmation when sets exist.
- Auto-creation of hidden exercise on equipment create for `type ∈ {machine, cable}`.
- All writes go through `/api/mutate` endpoints (idempotent on `(clientId, mutationId)`) — even though we're online-only until M10, the API contract is sync-ready.

**Done when:**
- Can create a new gym via the UI; appears in Setup tree.
- Can add equipment of every type (`barbell`, `machine`, `cable`, `freeweight`, `cardio`) with each cardioKind for cardio.
- Can upload a photo; the resized webp appears in `data/uploads/equipment/`; tile renders the photo.
- Without a photo, tile renders the glyph + tint gradient.
- Can add a child exercise to a freeweight station via the curated picker.
- Can add a custom-named exercise via "+ Custom".
- Renaming equipment or exercise preserves the row's id (verifiable via DB query).
- Deleting equipment with logged sets shows the count + confirmation dialog.

---

## M5 — Home screen + Detail screen + chart primitives

The two most-viewed screens. Where users land and where they drill in.

**Work:**
- Port `HomeScreen`: header with eyebrow + "Today" + GymChip, filter chips row, sort toggle (Recent only — Walk order deferred), equipment grid via `HomeGrid`.
- Port `EquipmentTile` (photo-or-glyph rendering, last-meta footer).
- Port `GymChip` + `GymSheet` (active-gym selector).
- Port `DetailScreen`: equipment header, meta tiles (PR/Sessions/Sets logged), top-set progression `LineChart`, "Weights you actually use" chips, Notes (free text, per-equipment, shared across users — write through `/api/mutate`).
- Port chart primitives: `Sparkline`, `LineChart`, `BarChart` (the last for Stats screen later).
- "Last lifted" indicator on Detail shows current user's last set only (no cross-user peek in v0.1).
- Equipment query layer that joins last-set-per-user-per-exercise efficiently.
- Common-weights query: top 4 distinct weights for `(userId, exerciseId)` ordered by `MAX(ts) DESC`.

**Done when:**
- Home shows equipment for the active gym, filtered by selected group chip.
- Tapping an equipment tile navigates to its Log screen (M6/M7).
- Tapping the GymChip opens the GymSheet; switching gyms updates the grid.
- Detail screen for a strength equipment shows the LineChart (with the user's actual top-set series) and meta tiles populated from real data.
- Notes text is editable and persists across reloads.
- Empty states render correctly: no equipment in gym → friendly empty state; no sets logged → "No history yet" on Detail.

---

## M6 — Log screen (strength path)

The single most-used screen. Optimized for one-tap weight changes mid-set.

**Work:**
- Port `LogScreen` strength branch. Header with equipment name + back + ellipsis-to-detail.
- Equipment header tile with photo/glyph + sparkline overlay (last 10 top sets) + previous-indicator.
- Weight `Stepper` (2.5 kg increments, hold-to-scroll behavior).
- "Your usual" chips: top 4 distinct weights for current user × exercise.
- Reps + Target Sets `SmallStepper`s.
- Set-progress dots showing logged-vs-planned.
- In-session set list with swipe-to-clone and swipe-to-delete (Svelte action for swipe gesture).
- Primary action button: "Log set N of M · X kg × Y" with mood-aware glow.
- "Just saved" pulse via teal flash on the action button (700 ms).
- Rest timer: 90 s default, started on each log, displayed as `rest 1:04` in section header.
- All writes via `/api/mutate` with client-minted ULID for the new set row.

**Done when:**
- Tapping equipment from Home opens Log with weight prefilled to user's last weight on that exercise.
- Stepper changes weight in 2.5 kg increments.
- Tapping "Your usual" chip sets weight to that value.
- Tapping primary action logs a set; row appears in the session list within ~100 ms.
- Swipe right on a logged set clones it (creates a new set with same weight/reps).
- Swipe left on a logged set soft-deletes it (sets `deletedAt`); row disappears from the list.
- Rest timer counts down from 1:30 after each log.

---

## M7 — Log screen (cardio path) + cardio templates

Cardio-specific Log UI. Branches off the same screen by `equipment.type`.

**Work:**
- Cardio branch of `LogScreen`. Duration `Stepper` (1 min increments).
- Optional-fields grid per `equipment.cardioKind`. Field set per D9 of grilling decisions:
  - **treadmill:** distance (km, 0.1), incline (%, 0.5), calories (kcal, 5), avg HR (bpm, 1)
  - **bike:** distance (km, 0.1), level (1), avg RPM (1), calories (kcal, 5), avg HR (bpm, 1)
  - **rower:** distance (m, 50), 500m split (s, 1), avg SPM (1), calories (kcal, 5), avg HR (bpm, 1)
  - **generic:** distance (km, 0.1), calories (kcal, 5), avg HR (bpm, 1)
- Each optional field starts as a dashed "+ field-name" chip; tapping expands into a mini-stepper card with current value + −/+ buttons + close (×).
- Derived stats card for treadmill: avg speed (km/h) + pace (min/km), computed at render time when distance + duration are both > 0.
- All extras serialized to `set.extras` JSON. `set.weight` and `set.reps` stay null for cardio.

**Done when:**
- Logging a treadmill session with duration + distance shows derived avg-speed + pace.
- All four cardio kinds render the correct field set.
- Closing an optional field removes it from `extras`; saved sets only persist non-default fields.
- The shared header (equipment glyph + previous-indicator) and shared session list both work in cardio mode.

---

## M8 — Implicit sessions + History screen + SessionDetail

Session boundary logic + reading the past.

**Work:**
- Server-side session resolution: on every set-write, look up the user's most recent open session. If `now - lastSet.ts > 90 min` or no open session exists, create a new `session` row with `gymId = activeGym`. Otherwise reuse.
- Server-side safety auto-close: on every API request, close any of the user's open sessions whose last set is > 6 h ago.
- Active-session detection on client (used by Home's SessionBar): query `session WHERE userId=? AND endedAt IS NULL`.
- Port `HistoryScreen`: header with "Last 12 weeks", gym scope chips ("All gyms" + each gym), heatmap grid (12 weeks × 7 days), recent-sessions list.
- `heatmapFor` query: count sessions per day per user over last 84 days, optionally filtered by `gymId`.
- Streak calculation: count consecutive days from today backward with at least one session.
- Recent sessions list: title is comma-joined first-words of equipment names, subtitle is gym + machine count + duration + total volume.
- Port `SessionDetailScreen`: meta tiles (Duration / Machines / Volume), per-machine breakdown of sets.
- Tap any equipment tile in SessionDetail → DetailScreen for that equipment.

**Done when:**
- Logging a set after >90 min of inactivity creates a new session (verifiable in DB).
- Logging within 90 min of last set extends the existing session.
- A session whose last set is > 6 h ago is closed automatically on next request.
- History heatmap renders the user's actual session density.
- "All gyms" filter shows everything; per-gym filter restricts both heatmap and session list.
- SessionDetail correctly groups sets by equipment.

---

## M9 — Stats screen + CSV export

Progression visualization across all equipment + data portability.

**Work:**
- Port `StatsScreen`: muscle-group distribution bars (last 30 days, current user, summed by `equipment.group`), per-machine sparkline cards.
- Per-machine progression query: for each exercise the user has logged, build a series of `(session.startedAt, MAX(set.weight))` over the last 15 sessions.
- Delta indicator: difference between first and last point of the series.
- Tapping a per-machine card → DetailScreen for that equipment.
- CSV export endpoint: `/api/export.csv?scope=all|user`. Streams a flat rollup with columns: `setId, userId, userName, sessionId, sessionStartedAt, gymId, gymName, equipmentId, equipmentName, equipmentType, equipmentGroup, exerciseId, exerciseName, weightKg, reps, durationMin, distanceKm, calories, avgHR, otherExtrasJson, ts`.
- "Export all data as CSV" button on Stats triggers a download.
- CSV download header sets a sensible filename: `trajectory-export-<userName>-<ISO date>.csv`.

**Done when:**
- Stats screen renders with real data for both users.
- Distribution bars correctly sum sets per group over last 30 days.
- Per-machine sparklines and deltas reflect actual top-set series.
- Tapping CSV export downloads a file that opens cleanly in a spreadsheet.
- CSV `scope=all` includes both users' data; `scope=user` (default for the per-user button) includes only the requesting user.

---

## M10 — IndexedDB sync mirror + offline-first writes

The offline plumbing. Layer over the existing API; no API contract changes.

**Work:**
- IndexedDB schema mirroring server tables: `set`, `session`, `equipment`, `exercise`. (User stays online-only.)
- Local-first write helper: every mutation writes IndexedDB first with optimistic UI update, queues a POST to `/api/mutate` with the same payload + a client-minted `mutationId`.
- `mutation_log` table on server (already in schema from M3) enforces `(clientId, mutationId)` UNIQUE; replays are no-ops.
- Mutation queue: FIFO drain on reconnect. Failed POSTs retry with exponential backoff (1s, 2s, 4s, 8s, 16s, then every 30s).
- Conflict resolution: server-side `updatedAt` comparison; latest wins; silent loss accepted (per D8).
- Soft-delete via `deletedAt` propagates correctly through the mirror.
- Offline detection banner: small subdued strip at the top of every screen when navigator.onLine is false ("Offline · 3 changes pending").
- App startup: hydrate IndexedDB from server snapshot if last sync > 24 h.

**Done when:**
- Logging a set with the network disabled writes to IndexedDB and updates the UI within ~50 ms.
- Re-enabling the network drains the queue; the set appears in `data/db.sqlite` within seconds.
- Killing the browser tab between IndexedDB write and successful POST does not lose the set on next open.
- Offline banner appears within 1 s of network loss, disappears within 1 s of recovery.
- Logging the same set twice (manually replayed mutationId) does not create two rows.

---

## M11 — PWA installability + service worker + app shell precache

Make the app a real first-class home-screen icon.

**Work:**
- `@vite-pwa/sveltekit` configured with manifest (name, short_name "Trajectory", icons in 192 + 512 + maskable, theme color, start_url, display "standalone").
- App shell precache: HTML, CSS, JS bundles, font files.
- Runtime caching strategy:
  - `/api/*`: NetworkFirst with 3 s timeout, fallback to cache.
  - `/uploads/*`: CacheFirst, max age 30 days.
  - Same-origin static assets: StaleWhileRevalidate.
- Install prompt: on Home screen, show a small "Install Trajectory" banner if `beforeinstallprompt` fires and the user hasn't dismissed it.
- iOS-specific install instructions for Safari (since iOS doesn't fire `beforeinstallprompt`): a one-time hint banner with "Tap Share → Add to Home Screen".
- Icon set + splash screens generated with a one-shot script (`pnpm gen:icons`) reading from a single source SVG.

**Done when:**
- Chrome / Edge: install prompt appears on Home; installing creates a real OS-level app icon.
- iOS Safari: "Add to Home Screen" produces a full-screen launcher (verifiable with the manifest properties).
- Lighthouse PWA score is at least "installable" (don't chase 100; just installable).
- Killing the app and re-opening it from the home-screen icon launches without a network request for the shell.

---

## M12 — Polish + integration test + final hand-off

Everything still rough gets fixed. End-to-end smoke test.

**Work:**
- Login screen visual polish to match dark/amber idiom.
- Profile pane visual polish.
- First-run wizard visual polish.
- Empty states across every screen (Home with no equipment, History with no sessions, Stats with no data, Detail with no progression yet).
- Error states: failed POSTs surface a small inline toast; auth errors return to /login with a banner.
- Set-row swipe affordance hint that disappears after first use (`localStorage` flag).
- Equipment delete confirmation per D5: count of sets, default Cancel.
- Documented backup workflow in CLAUDE.md (use `.backup` API, not `cp`).
- A single end-to-end test (Playwright or vitest+playwright-core) that:
  - Seeds a user.
  - Logs in.
  - Creates a gym.
  - Adds a strength equipment.
  - Logs three sets at different weights.
  - Verifies the sparkline appears on Detail.
  - Exports CSV and parses it.
- Tag the v0.1.0 release: `git tag v0.1.0 && git push --tags`.
- README updated: setup, environment vars, backup, deployment.

**Done when (and the project is shipped):**
- Both Johnny and Alina log into the deployed instance from their phones.
- Both create or sign into accounts and reach Home.
- Both add at least one piece of equipment via the deployed UI.
- Both log a real workout end-to-end (multiple sets across multiple equipment).
- Both view their workout in History.
- CSV export downloads on a phone and opens cleanly on a desktop.
- The end-to-end test passes in CI (or on `pnpm test:e2e` locally).
- `v0.1.0` tag pushed.
- README has the full deployment instructions.

---

## Cross-milestone conventions

- **Branches:** `m4-setup-screen`, `m6-log-strength`, etc. Merge to `main` on milestone close. M1's commits go directly to `main` since the repo doesn't yet have anything to merge into.
- **Commits:** small and frequent, present-tense imperative ("add equipment glyph chooser"), no co-author trailer.
- **Per-milestone push gate (mandatory):** before any push that closes a milestone, the work must be verified in a real running browser. The full sequence is non-negotiable:
  1. `docker compose up` from a clean state. Tail the container logs and watch the full startup. Confirm zero errors, zero missing-env warnings, all migrations apply cleanly.
  2. Connect to the running app via the **chrome-devtools MCP** (navigate to the documented localhost URL, take a screenshot of the landing screen, list console messages and confirm no errors).
  3. Smoke-test the milestone's deliverable end-to-end — every bullet under that milestone's "Done when" must be confirmed by clicking through the actual UI in chrome-devtools, not by reading source.
  4. Smoke-test one obvious adjacent edge case (empty state, error path, page reload, navigate-back).
  5. If anything fails, fix it and re-run from step 1. **No commit + push of "should work" code.**
  6. Only after the full verification passes do you merge the feature branch and push to `origin/main`.
- **Per-milestone test:** even M1 has a manual smoke test in its Done list. M12 adds an automated end-to-end. The chrome-devtools MCP smoke-test is in addition to (not a substitute for) any automated tests written for the milestone.
- **Schema changes always via Drizzle migrations** generated from `pnpm db:generate`. Never hand-edit a migration file after it's been applied to a database that exists outside this repo (i.e. once you've shipped to prod, that migration is immutable).
- **No `cp` of the live SQLite file** for backups — use `.backup` API.
- **Photos in `data/uploads/`** only. Never check images into the repo (other than design assets like icons).
