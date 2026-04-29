# Trajectory — Decisions

Decisions that survived the Phase 3 grilling. Each one names what we chose, the pressure that was applied, and the reasoning. Companion to `BRAINSTORM.md` (which captures the design choices) — `DECISIONS.md` records the *adversarial* defenses of those choices.

Date: 2026-04-29
Phase: 3 of kickoff workflow (grilling).
Next: Phase 4 (roadmap + project docs).

---

## D1 — Build vs. fork wger or OpenLift

**Decision:** Build Trajectory.

**Pressure:** Both alternatives exist, are self-hostable, and are maintained.

**Why we still build:**
- wger is exercise-library-first. Its public exercise list (`https://wger.de/en/exercise/overview/`) has no commercial gym machines — no "Lat Pulldown machine," no "Cable Row," no "Treadmill #3." Their model assumes a global library of named exercises that users adopt; ours assumes the gym's specific machines are the primary objects.
- OpenLift is single-user.
- The equipment-first thesis is the entire reason for the project. Forking wger and bolting equipment-first onto an exercise-first schema is more work than building from scratch.
- Visual design (the Claude Design handoff) is deliberately personal; ports cleanly to a clean-slate codebase, not to wger's Django templates.

**Maintenance posture:** This is a 2-user homelab app. Acceptable to let it sit for 12+ months between dependency bumps. No external community, no users to support, no SLA.

---

## D2 — Full v0.1 scope, no time-based cuts

**Decision:** Build the entirety of the v0.1 scope as specified in BRAINSTORM.md, including the IndexedDB sync layer, per-kind cardio templates, full Login + Profile pane styling, and the multi-gym UI.

**Pressure:** Initial grilling proposed cuts (online-required, simplified cardio, ugly Login) framed as "saves ~7-9 days."

**Why we keep everything:** Build effort is not a cost the user is paying. Cuts must be justified by *non-time* reasons — maintenance surface, validation order, dead-code risk, schema lock-in — not by calendar. None of the proposed cuts cleared that bar.

**Implication:** ROADMAP must include all the surface area, not a "minimum viable" subset.

---

## D3 — SvelteKit 2 + Svelte 5

**Decision:** Stick with SvelteKit 2 + Svelte 5 + TypeScript.

**Pressure considered:** Next.js + React (largest ecosystem, best AI tool support), Phoenix LiveView (real-time multi-user for free), plain Express + HTMX (smallest surface).

**Why SvelteKit:**
- Filesystem routing + `+page.svelte` / `+page.server.ts` matches the screen/loader/action shape this app wants.
- `@vite-pwa/sveltekit` makes PWA setup a 30-min task, not a saga.
- Drizzle has first-class SvelteKit examples.
- Svelte 5's runes give the React mental model with smaller runtime overhead.
- The handoff is React/JSX but the components are small and the porting tax is manageable.

**Acknowledged costs:**
- Smaller talent pool than React (irrelevant — solo project).
- Slightly worse AI agent autocomplete vs. React (acceptable).
- Svelte 5 + SvelteKit 2 are recent rewrites; not battle-tested at 4-year horizons (acceptable for a 2-user app).

**Open verification:** Confirm Better Auth + SvelteKit + PWA combination has a working reference example during M2 (auth setup) before locking it. If the Better Auth + SvelteKit story is still beta-quality, fall back to Lucia or roll-our-own session cookies — but not switch frameworks.

---

## D4 — Schema trade-offs all accepted

**Decision:** Accept all seven trade-offs in the BRAINSTORM.md schema as priced.

| # | Trade-off | Cost | Mitigation |
|---|---|---|---|
| 1 | `set.extras` JSON is unindexable | Slow `json_extract` queries at scale | Acceptable at 2 users × ~1000 sets/year. SQLite JSON1 is fine. |
| 2 | Soft-delete via `deletedAt` everywhere | Every query needs `WHERE deletedAt IS NULL` | Use Drizzle's relational query API + helper layer. Hard-delete breaks LWW tombstones for sync. |
| 3 | `session.gymId` immutable after first set | Can't reassign mid-session | Real frequency ≈ never. FUTURE: admin reassignment action. |
| 4 | `equipment.gymId` mutable but historically lossy | Old sessions retain old gym; correct behavior but worth knowing | Document in CLAUDE.md. |
| 5 | `equipment` has no `userId` (shared) | Either user can rename/delete equipment | See D5 below. |
| 6 | ULID PKs are client-generated | Risk of malformed/duplicate IDs from a buggy client | Server validates ULID format on every mutation. UNIQUE constraint catches dupes. |
| 7 | `weight` as REAL (no DECIMAL in SQLite) | Float drift — invisible at gym precision | Acceptable. 2.5 + 60 = 62.5 exactly in IEEE-754 binary64. |

---

## D5 — Edit-in-place rename, not delete-and-recreate

**Decision:** Setup screen must offer **edit-in-place** for equipment and exercise names. Renaming preserves history. Delete-and-recreate is allowed but requires confirmation when the row has logged sets.

**Why:** If a user deletes "DB Curl" and creates "Dumbbell Curl," the new exercise has zero history; the old chart is orphaned. Renaming via UPDATE preserves the FK chain and the chart stays continuous.

**Implementation note:** When delete is invoked on equipment or exercise with attached sets, show a count + confirmation: *"This equipment has 47 logged sets across 2 users. Really delete?"* Defaults to Cancel. ~30 min of UI work; ships in M3 (Setup screen).

---

## D6 — SQLite operational profile

**Decision:** WAL mode, `synchronous=NORMAL`, `SIGTERM` graceful shutdown, hot backups via `.backup` API not `cp`.

**Why:** WAL gives reader/writer parallelism (writers still serialize, but there's only ever one writer at a time anyway). `synchronous=NORMAL` is durable across process kill, fast enough that no one notices. `cp` of a live SQLite file can copy a torn page; `.backup` uses SQLite's online backup API.

**Implementation notes:**
- App startup: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;`.
- Register `SIGTERM` handler in SvelteKit Node server: call `db.close()` cleanly. ~5 lines.
- Document the `.backup` workflow in CLAUDE.md so future-you doesn't `cp` a live file.

---

## D7 — Hosted on public HTTPS

**Decision:** Trajectory is served from a public DNS name with a valid TLS certificate (Let's Encrypt or equivalent). Not LAN-only, not Tailscale-only.

**Why this matters technically:**
- iOS Safari requires HTTPS for full PWA install (offline cache, "Add to Home Screen" full-screen mode, install prompt). Plain HTTP gets a degraded experience.
- Better Auth's secure cookies need HTTPS in production.
- Reaching the app from the gym (which is *not* on the homelab LAN) is necessary for the use case.

**Implementation notes:**
- Better Auth cookie config: `secure: true`, `sameSite: 'lax'`, domain matches the public hostname.
- Reverse proxy (Caddy / Traefik / Nginx) handles TLS termination; container speaks plain HTTP internally.
- CSP and security headers configured in SvelteKit hooks.

---

## D8 — Last-write-wins sync with silent loss

**Decision:** When two devices edit the same equipment row offline and reconnect, the latest `updatedAt` wins. The losing edit is silently overwritten with no UI notification.

**Pressure:** A "your edit was overwritten" notification could be queued per user.

**Why we accept silent loss:**
- Two users renaming the same equipment within the same offline window is vanishingly rare in a 2-user homelab app.
- The notification UX would be its own design surface (per-user mailbox, dismissal, replay action).
- For sets (the high-volume data), conflicts are *impossible* — each set has a unique `set.userId` and a unique ULID, so two phones writing in parallel never collide on the same row.

**FUTURE:** If the silent loss ever bites, add an `audit_log` table that records who-changed-what-when, surface a "Recently overwritten edits" section in Settings.

---

## D9 — Auto-migrate on container boot with pre-migration snapshot

**Decision:** Drizzle migrations run automatically on container start. Before any migration runs, the startup script copies `data/db.sqlite` to `data/db.sqlite.pre-migration-<ISO timestamp>`.

**Pressure:** Manual `pnpm migrate` step would be safer (a bad migration would fail loudly outside the boot path, container would still come up).

**Why auto-on-boot:**
- 2 users, no zero-downtime requirement worth engineering for.
- Snapshot makes rollback trivial: stop container, copy snapshot back, fix migration, restart.
- One fewer step in the deploy workflow.

**Implementation notes:**
- Snapshot uses SQLite `.backup` API (see D6), not `cp`.
- Migration script logs each migration applied, with timestamp and SHA of the SQL file.
- Snapshots accumulate in `data/`; document a periodic cleanup in CLAUDE.md.

---

## Open items deferred to ROADMAP

- mutation_log retention policy (will grow forever otherwise; 2 users × 1000 mutations/year ≈ 10k rows in 5 years — not actually a problem at this scale, but worth a note).
- Concrete Better Auth seeding flow (env var format, password reset on first login UX).
- Backup automation beyond manual file copy → FUTURE.md.
- "Reassign session gym" admin action → FUTURE.md.
