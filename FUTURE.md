# Trajectory — Future Ideas

Parking lot for ideas deliberately out-of-scope for v0.1. Items are roughly ordered by how likely they are to become real work.

When in doubt about whether to add a feature: it goes here. Promoting from FUTURE.md to ROADMAP.md requires a separate brainstorm + decision pass.

---

## Likely soon (v0.2 candidates)

- **Cross-user "peek at partner's last set"** — small subdued line on Detail under your last-set indicator: *"Alina · 32.5 kg × 10 · 2 days ago."* Only feature that crosses the user boundary.
- **Split session affordance** — tap any set in History → "Split session here." Fixes the rare misjoined session.
- **Walk order sort on Home** — manual ordering of equipment per gym; `equipment.sortOrder` column already in schema, just needs a drag handle in Setup and a toggle on Home.
- **Session notes** — free-text per session ("good day, lower back tight") on SessionDetail. New `session.note` text column.
- **Set-level notes** — quick text field per set ("dropped from rack on rep 7"). New `set.note` text column.
- **Edit a logged set** — currently swipe-delete + re-log. v0.2 lets you tap-to-edit weight/reps in place.
- **Equipment delete: "moved" vs "removed" distinction** — moving equipment between gyms keeps history; removing soft-deletes. v0.1 only has soft-delete.
- **Replace `derivedExerciseId` with `equipment.hiddenExerciseId` FK column** — current scheme encodes the hidden-exercise PK as `equipmentId.slice(0,25)+'X'`. Works, but a real ULID happening to share 25 chars + ending in 'X' would collide silently on `onConflictDoNothing`. Also blocks future per-equipment multi-hidden-exercises (warm-up, drop). Migration: add nullable column, backfill from `derivedExerciseId(eq.id)`, switch reads, drop the convention.
- **Denormalize `equipment.lastSet*` to avoid scanning all sets on every Home load** — `+page.server.ts`, `equipment/[id]/+page.server.ts`, `history/+page.server.ts` all pull every set the user has logged. Cheap now (low row count) but linear in lifetime sets. Update from `set.create` / `set.update` / `set.delete`. Until then leave the comment in place.
- **Backup / restore UI** — schedule, last-run timestamp, manual trigger. v0.1 is a manual `.backup` shell command.
- **"Your edit was overwritten" notifications** — surface silent-loss conflicts from sync (per D8) in a per-user mailbox.
- **Reassign session gym** — admin action to fix a session that was logged with the wrong active gym.

## Mid-term (v0.3 / v0.4)

- **Tweaks panel from the prototype** — mood (calm/focus/gym), accent hue, density. Per-user preference, stored in `user.preferences` JSON.
- **Programs / templates** — "Push day" template that pre-fills target sets per machine. Big feature, separate spec.
- **Supersets** — group two exercises into one logical "set" with shared rest timer. Schema: nullable `set.setGroupId` + new `set_group(id, sessionId)`.
- **Drop sets** — same shape as supersets, or stuff into `set.extras`.
- **PR detection** — visual nudge when current set beats best historical for that exercise.
- **1RM estimates** — Epley or Brzycki formula on Detail. Spec ruled out for v0.1; revisit only if explicitly asked.
- **Volume metric on Stats** — weight × reps × sets across exercises, daily/weekly rollups.
- **RPE / RIR** — 1–10 effort rating per set. Goes in `set.extras` or new column.
- **Rest timer customization** — per-exercise default rest (60s for accessories, 180s for compounds), instead of global 90s.
- **User-customizable cardio templates** — define your own optional fields per cardio kind, instead of the hardcoded set.
- **Promote curated exercise list to a real DB table** — currently hardcoded in `src/lib/exercises.ts`. Move to `exercise_library` for user-extensible canonical names.
- **Audit log table** — record every change (who, when, what changed) for forensic / overwrite-recovery purposes.
- **Soft-delete recovery UI** — "Trash" view of `deletedAt IS NOT NULL` rows with restore action.
- **Equipment photo cropping/rotation** — in-app crop tool for the upload step.
- **Multi-tenancy: admin UI for adding/removing users** — currently 2 users seeded via env var.

## Long-term / probably never

- **Programs with periodization** (5/3/1, conjugate, RP).
- **AI suggestions** ("you should try 75 kg today").
- **Social features, leaderboards, sharing.**
- **Home Assistant integration** — exposing workout state/history as HA entities.
- **Native mobile apps** (Capacitor) — only if PWA story breaks down.
- **Public REST API for third parties.**
- **Apple Watch / Wear OS companion apps.**
- **Nutrition tracking** — separate `meal` table, macros, daily targets. Out of scope for "workout tracker."
- **Body measurements / weigh-ins** — separate `body_entry` table.
- **Plate calculator** — "Bench is 72.5 kg, that's 20 + 15 + 1.25 per side."
- **Photo annotations / coaching marks on equipment photos.**
- **Multi-gym discovery / sharing** — public catalog of gyms others have set up. Privacy disaster, hard pass.

## Operational / deferred ops work

- **Restic / borg / rsync backup automation** — scheduled, off-host backup of `data/`.
- **mutation_log retention policy** — currently grows forever. At 2 users × ~1000 mutations/year ≈ 10k rows in 5 years. Not actually a problem at this scale, but worth a periodic cleanup script (older than 90 days, drop).
- **Pre-migration snapshot cleanup** — `data/db.sqlite.pre-migration-*` accumulates. Cron to keep last 10.
- **Health-check endpoint** for the reverse proxy.
- **Structured logging** — currently console-level. Move to JSON logs with request IDs.
- **Metrics export** — Prometheus endpoint for response times, DB query counts.
- **Rate limiting** on `/api/mutate` — currently absent. 2 users, low risk; add if ever exposed beyond Tailscale.

## Stack-evolution candidates

- **Migrate to Phoenix LiveView** if SvelteKit + IndexedDB sync ever feels overengineered for the use case. LiveView gives real-time multi-user for free; would mean rewriting in Elixir. Multi-month pivot, only if pain becomes real.
- **Switch from SQLite to libSQL/Turso** for cross-region sync. Only relevant if you and Alina ever live apart and the homelab can't reach you both reliably.
- **Replace Better Auth with Lucia** if Better Auth's SvelteKit story regresses. Risk noted in D3.

## Things explicitly NOT going in this list

- "Make it work for commercial gyms" / "Sell this to coaches" / "SaaS-ify it" — Trajectory is a 2-user homelab app. Period.
- "Add a friends-can-follow-each-other social graph" — see above.
- Anything that requires a third-party API (Strava, Garmin Connect, Apple Health) — external integrations are not in the project's scope.
