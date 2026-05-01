# Trajectory — Claude Code Context

Read this first in every session. Then `BRAINSTORM.md` (design decisions), `DECISIONS.md` (grilling outcomes), and `ROADMAP.md` (milestones). `FUTURE.md` lists out-of-scope ideas.

## What it is

A self-hosted, multi-user, web-based workout tracker for strength + cardio. Single shared gym (multi-gym supported in schema and UI for travel). Two users: Johnny + Alina. Self-hosted on a public HTTPS domain.

The differentiator is **equipment-first** data modeling: the user's specific gym and its specific machines are the primary objects, not a generic exercise library. Reflects the reality that 99% of training happens at the same gym; people walk up to "the cable row near the mirror," not to "seated cable row" as an abstract exercise.

## Stack

- **SvelteKit 2 + Svelte 5 + TypeScript** — web framework.
- **Drizzle ORM + better-sqlite3 + SQLite** — persistence. Single DB file at `data/db.sqlite`.
- **Better Auth** — username/password, session cookies. Two seeded users via env var on first run.
- **Tailwind CSS 4** — styling. Design tokens in `src/lib/theme.css`.
- **`@vite-pwa/sveltekit`** — PWA (service worker, manifest, offline cache).
- **`sharp`** — image resize for equipment photos.
- **Single Docker container** — Node 22 alpine. `docker compose up` is the only command to bring up dev. Host bind mounts for `data/db.sqlite` and `data/uploads/`.

## MVP scope (v0.1)

The app must do exactly the following:

1. Set up your gym(s): add equipment (name, photo, type, default exercise).
2. Two users with separate accounts and separate sessions/sets. Equipment is shared across users (gym-wide, not per-user).
3. Log a set: tap equipment → adjust weight via stepper → adjust reps/sets → save.
4. Pre-fill last-used values per user × exercise.
5. Session view: see what's been logged in the current session. Sessions form implicitly: a 90-min gap since the last set starts a new session; 6h gap auto-closes the open one.
6. History view: 12-week heatmap, list of past sessions, drill into any session.
7. One progression chart per equipment (top set over time). Plus muscle-group distribution + per-machine sparkline list on Stats.
8. CSV export of all data.

Cardio is in scope. Templates per cardio kind (treadmill / bike / rower / generic). See BRAINSTORM.md Q7 for exact field set.

Anything not in the above list lives in `FUTURE.md`. Resist scope creep.

## File layout

```
.
├── BRAINSTORM.md            ← design decisions from Phase 2
├── DECISIONS.md             ← grilling outcomes from Phase 3
├── ROADMAP.md               ← v0.1 milestones (M1–M12)
├── FUTURE.md                ← out-of-scope parking lot
├── CLAUDE.md                ← you are here
├── README.md                ← user-facing setup
├── Dockerfile               ← multi-stage (dev + prod)
├── docker-compose.yml       ← dev + prod compose configs
├── package.json
├── pnpm-lock.yaml
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── drizzle.config.ts
├── tailwind.config.ts
├── drizzle/                 ← generated migrations (checked in)
├── src/
│   ├── app.html
│   ├── app.css
│   ├── hooks.server.ts      ← auth guard, db connection setup
│   ├── lib/
│   │   ├── theme.css        ← design tokens (locked: focus + standard + amber)
│   │   ├── exercises.ts     ← curated exercise list (free-weight stations)
│   │   ├── components/      ← Stepper, Chip, EquipmentTile, etc.
│   │   ├── icons/           ← SVG glyphs (11 equipment kinds + lucide-style icons)
│   │   ├── server/
│   │   │   ├── db/          ← Drizzle schema + migrations runner + helpers
│   │   │   ├── auth.ts      ← Better Auth config
│   │   │   ├── ulid.ts      ← ULID generator + validator
│   │   │   └── sync/        ← /api/mutate idempotency layer
│   │   └── stores/          ← Svelte stores (active gym, session, theme)
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte                     ← Home
│       ├── login/+page.svelte
│       ├── setup/
│       │   ├── +page.svelte                 ← Setup
│       │   └── first-run/+page.svelte       ← First-run wizard
│       ├── log/[eqId]/+page.svelte          ← Log (strength or cardio branch)
│       ├── equipment/[eqId]/+page.svelte    ← Detail
│       ├── history/+page.svelte
│       ├── sessions/[id]/+page.svelte       ← SessionDetail
│       ├── stats/+page.svelte
│       └── api/
│           ├── mutate/+server.ts            ← idempotent write endpoint
│           ├── export.csv/+server.ts
│           └── equipment/[id]/photo/+server.ts
├── handoff/                 ← original Claude Design React/JSX prototype (read-only reference)
├── Trajectory-handoff.zip   ← original handoff archive
└── data/                    ← bind-mounted at runtime; gitignored
    ├── db.sqlite
    ├── db.sqlite-wal
    ├── db.sqlite-shm
    ├── db.sqlite.pre-migration-<ts>     ← snapshots taken on auto-migrate
    └── uploads/
        └── equipment/<ulid>.webp
```

## How to run locally

```bash
docker compose up
# → http://localhost:5173
```

That's it. First boot creates `data/db.sqlite`, runs migrations, and seeds users from `SEED_USERS` env var.

Required env vars (set in `.env` at repo root, gitignored):

```
SEED_USERS=johnny:initialpw,alina:initialpw   # only consumed if user table is empty
BETTER_AUTH_SECRET=<random 32-char string>
PUBLIC_BASE_URL=http://localhost:5173         # for absolute URLs in PWA manifest
```

For production, additionally:

```
NODE_ENV=production
PUBLIC_BASE_URL=https://your-trajectory-domain
```

Hot reload works inside the container via Vite + chokidar polling. Editing any `src/*` file triggers an HMR update without container restart.

## How to deploy

Trajectory is hosted on a **public HTTPS domain** (per D7). This is non-negotiable: iOS Safari requires HTTPS for full PWA install, and Better Auth needs HTTPS for secure cookies.

Deployment shape:
- Reverse proxy (Caddy / Traefik / Nginx) terminates TLS, forwards to the container on port 5173.
- Container runs as `node build` after `pnpm build` (prod target in Dockerfile).
- `data/` directory bind-mounted to a persistent host path (e.g. `/srv/trajectory/data`).
- Container restart policy: `unless-stopped`.
- Migrations apply automatically on container boot (per D9). Pre-migration snapshot at `data/db.sqlite.pre-migration-<ISO timestamp>`.

## Backup

**Always use SQLite's `.backup` API, never `cp`** (per D6 — `cp` of a live file can copy a torn page).

`scripts/backup.sh` is the entry point. Invokes `better-sqlite3.backup()` inside the running container, writes to `data/backups/db-<ts>.sqlite`, prunes to 14 dailies + 8 weeklies (plus the 5 most-recent pre-migration snapshots).

```bash
./scripts/backup.sh
# host crontab:
# 0 4 * * * /srv/trajectory/scripts/backup.sh >> /var/log/trajectory-backup.log 2>&1
```

This protects against in-app corruption only — snapshots live in the same `data/` volume. Off-host protection (restic / borg / rsync of the whole `data/` directory) is FUTURE and must be configured separately.

## Conventions

- **No `Co-Authored-By: Claude` trailer in commits or PRs.** Ever. Saved as a global preference.
- **Branches per milestone:** `m4-setup-screen`, etc. Merge to `main` on milestone close.
- **Commit style:** small, frequent, present-tense imperative ("add equipment glyph chooser"). Conventional Commits prefix optional but encouraged (`feat:`, `fix:`, `docs:`, `chore:`).
- **Schema changes always via Drizzle migrations.** Never hand-edit an applied migration file. Run `pnpm db:generate` after schema changes; commit the generated SQL.
- **Photos go to `data/uploads/`**, never into the repo.
- **Per-milestone push gate (mandatory):** before any push that closes a milestone:
  1. `docker compose up` from clean. Tail logs. Confirm no errors, no missing-env warnings, migrations clean.
  2. Connect via **chrome-devtools MCP**, take screenshots, check console for errors.
  3. Smoke-test every "Done when" bullet by clicking through the actual UI.
  4. Smoke-test one obvious adjacent edge case.
  5. If anything fails, fix and re-run from step 1.
  6. Only then commit + push.

  This is non-negotiable. See `ROADMAP.md` cross-milestone conventions and the persistent feedback memory for the full rule.

- **No scope cuts framed as "saves N days."** Build effort isn't the user's cost. Cuts must justify themselves on maintenance / validation / lock-in grounds, not calendar.

## Common gotchas

- **`equipment` is shared, sessions/sets are per-user.** Don't add `userId` to `equipment` — see Q1 in BRAINSTORM.md.
- **All sets FK to an `exercise`, even on machines.** Machines auto-create one hidden exercise (`isHidden=true`) so the FK chain is uniform.
- **`session.gymId` is captured at first set, immutable after.** If you need to model a "wrong gym" fix, that's a manual DB action for v0.1.
- **`set.extras` is JSON.** Schema doesn't enforce keys — the UI does. Don't try to add per-extra columns; that's how you get 30-column tables full of nulls.
- **ULIDs are client-generated.** Server validates format on every mutation. Assume malformed IDs are the most common bug class to defend against.
- **Soft-delete via `deletedAt`** on equipment, exercise, set. Every read query needs `WHERE deletedAt IS NULL`. Use the helper layer in `src/lib/server/db/`; don't write raw queries that forget this.
- **Renaming preserves history; delete-and-recreate doesn't.** Setup must offer edit-in-place (per D5). Deleting equipment with logged sets requires confirmation.

## Pointers

- `BRAINSTORM.md` — every design decision and the option chosen.
- `DECISIONS.md` — every adversarial pressure point and the surviving decision.
- `ROADMAP.md` — M1 through M12 with explicit Done criteria.
- `FUTURE.md` — every idea deliberately deferred.
- `handoff/trajectory/project/` — original React/JSX design prototype. Read it for visual reference; do not port code line-by-line.
