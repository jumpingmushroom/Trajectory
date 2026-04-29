# Trajectory

Self-hosted, equipment-first workout tracker for two people.

**Status:** v0.1.0 (shipped). All twelve milestones from `ROADMAP.md` are done. Open `CLAUDE.md` for the project context every future session reads first.

## What it is

A web app where the user's specific gym and its specific machines are the primary objects, not a generic exercise library. You walk up to "the cable row near the mirror," tap it, log a set. Two users (Johnny + Alina) on one shared gym (multi-gym supported in schema and UI for travel). Self-hosted on a public HTTPS domain. PWA-installable on iOS + Android. Offline-first writes via IndexedDB queue.

## Quickstart (development)

```sh
docker compose up
# → http://localhost:5173
```

That's the entire dev workflow. The container handles `pnpm install`, runs Vite with HMR (polling-based so host edits trigger browser updates inside the container without a restart), and writes persistent state to `./data` on the host via a bind mount.

The only supported way to run Trajectory locally is inside the container — there is no `pnpm dev` workflow on the host.

Default seed users (overridable in `.env`):

```
johnny / changeme
alina  / changeme
```

Both are forced to change their password on first sign-in.

## Environment

Copy `.env.example` to `.env` before booting. Trajectory boots fine without any env vars (defaults are dev-friendly), but in production you must set:

```
NODE_ENV=production
PUBLIC_BASE_URL=https://your-trajectory-domain
BETTER_AUTH_SECRET=<random 32+ char string>
SEED_USERS=johnny:strongpassword,alina:strongpassword
```

`SEED_USERS` is consumed only when the user table is empty — once seeded, changes to the env var have no effect.

## Production deployment

Trajectory is designed to live on a **public HTTPS domain** (per `DECISIONS.md` D7). iOS Safari requires HTTPS for full PWA install (Add to Home Screen + offline cache + standalone launcher), and Better Auth's secure cookies need HTTPS in production.

Recommended shape:

1. Build the prod image: `docker compose build --target prod` (or use the `prod` target in your compose file).
2. Bind-mount `./data` to a persistent host path: `/srv/trajectory/data`.
3. Front the container with a reverse proxy (Caddy / Traefik / Nginx) that terminates TLS and forwards to port 3000 inside the container.
4. Restart policy `unless-stopped` so the container survives reboots.
5. Migrations apply automatically on container start; pre-migration snapshot lands at `data/db.sqlite.pre-migration-<ISO timestamp>` (per D9).

## Backup

**Use SQLite's `.backup` API, never `cp`** (per D6 — `cp` of a live SQLite file can copy a torn page).

```sh
docker exec trajectory sqlite3 /app/data/db.sqlite \
  ".backup /app/data/backup-$(date -Iseconds).sqlite"
```

For automated backups, schedule that command via cron on the host. Restic / borg / rsync over the entire `data/` directory (which includes equipment photos under `data/uploads/`) is `FUTURE.md` territory.

You can also export everything as CSV from inside the app: Stats screen → "Export everyone's data as CSV". Useful for portability + spreadsheet analysis; not a substitute for binary backups (the CSV doesn't include equipment photos or DB-internal state like the mutation_log).

## Smoke test

A node-fetch smoke test runs the full server-side contract against the dev container:

```sh
pnpm test:smoke
```

Hits the running app at http://localhost:5173 (default — override with `TRAJECTORY_URL=...`). Signs in as the seeded user (`SMOKE_USER=…`, `SMOKE_PASS=…`, defaults `johnny`/whatever fresh password got set), then exercises gym.create → equipment.create → set.create×3 → /api/export.csv and asserts that the CSV contains the new rows.

The test is deliberately small and contract-focused — no Playwright, no UI assertions. It's the safety net that catches "I broke `/api/mutate` while refactoring." UI testing belongs in v0.2 if it earns the lift.

## Where everything lives

- `BRAINSTORM.md` — every design decision and the option chosen.
- `DECISIONS.md` — every adversarial pressure point and the surviving decision.
- `ROADMAP.md` — M1 through M12 with explicit Done criteria. Useful for code archaeology.
- `FUTURE.md` — every idea deliberately deferred (programs, Tweaks panel, supersets, drop sets, PR detection, RPE, multi-tenancy, …).
- `CLAUDE.md` — canonical project context. Every future Claude Code session reads this first.
- `handoff/` — original Claude Design React/JSX prototype (visual reference, do not port code line-by-line).
- `src/` — SvelteKit app source.
  - `routes/` — pages + API routes.
  - `lib/components/` — Svelte UI primitives.
  - `lib/server/` — DB schema, auth config, mutation router, ULID utils.
  - `lib/sync/` — IndexedDB mutation queue + drainer + status store.
- `data/` — host-bind-mounted persistent state. SQLite DB + WAL/SHM + pre-migration snapshots + equipment photos under `uploads/`. Gitignored.
- `drizzle/` — generated SQL migrations. Checked in.
- `scripts/gen-icons.mjs` — regenerates PWA icons from `static/icons/source.svg`.

## Stopping

```sh
docker compose down
```

`docker compose down -v` removes the named volumes for `node_modules` and `.svelte-kit` (forcing a reinstall on next boot) but never touches `./data`.
