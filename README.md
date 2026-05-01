# Trajectory

Self-hosted, equipment-first workout tracker.

**Status:** v0.2 multiuser (in development). v0.1 shipped per `ROADMAP.md`; v0.2 converts the two-user-shared-gym model into a public multi-user instance with admin-issued accounts. Open `CLAUDE.md` for the project context every future session reads first.

## What it is

A web app where each user's specific gym and its specific machines are the primary objects, not a generic exercise library. You walk up to "the cable row near the mirror," tap it, log a set. Per-user tenancy: each account owns its own gyms, equipment, sessions, and sets. Self-hosted on a public HTTPS domain. PWA-installable on iOS + Android. Offline-first writes via IndexedDB queue.

## Quickstart (development)

```sh
docker compose up
# → http://localhost:5173
```

That's the entire dev workflow. The container handles `pnpm install`, runs Vite with HMR (polling-based so host edits trigger browser updates inside the container without a restart), and writes persistent state to `./data` on the host via a bind mount.

The only supported way to run Trajectory locally is inside the container — there is no `pnpm dev` workflow on the host.

## Accounts

v0.2 instances are admin-issued: there is no public sign-up. On first boot
of an empty database, Trajectory seeds a single admin from
`ADMIN_EMAIL` / `ADMIN_PASSWORD`. After signing in, the admin invites users
from `/admin/users`; recipients receive an email link that lets them set
their own password. Self-service password reset (`/login/reset`) is
available to anyone with a valid account.

## Environment

Copy `.env.example` to `.env` before booting. Trajectory boots fine in
development without any env vars (the mailer falls back to logging
"would-send" messages to stdout); in production you must set:

```
NODE_ENV=production
PUBLIC_BASE_URL=https://your-trajectory-domain
BETTER_AUTH_SECRET=<random 32+ char string>

ADMIN_EMAIL=<admin email>            # only consumed when user table is empty
ADMIN_PASSWORD=<initial password>    # admin should change this from /profile

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Trajectory <noreply@your-domain>"
SMTP_SECURE=false                    # true for port 465
```

`ADMIN_EMAIL` / `ADMIN_PASSWORD` are consumed only when the user table is
empty — once seeded, changes to those vars have no effect. SMTP is required
in production; missing config throws on boot rather than silently disabling
invites or password reset.

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

`scripts/backup.sh` takes a snapshot via the running container (uses `better-sqlite3`'s online backup API, no `sqlite3` CLI required), drops it under `data/backups/db-<ts>.sqlite`, and prunes old snapshots. Retention: every snapshot from the last 14 days, plus the newest snapshot per ISO week for the 8 most recent weeks beyond. Pre-migration snapshots (`data/db.sqlite.pre-migration-*`) trim to the 5 most recent.

```sh
# one-shot
./scripts/backup.sh

# daily 04:00 UTC via host crontab
0 4 * * * /srv/trajectory/scripts/backup.sh >> /var/log/trajectory-backup.log 2>&1
```

Override the defaults via env vars: `TRAJECTORY_CONTAINER` (default `trajectory`), `TRAJECTORY_DATA_DIR` (default `<repo>/data`).

This script writes snapshots **inside the same `data/` volume** — it protects against in-app data corruption (bad migration, bad write) but NOT against host disk loss. For off-host protection, schedule restic / borg / rsync of the whole `data/` directory separately. That covers `db.sqlite`, the snapshots under `data/backups/`, and equipment photos under `data/uploads/`.

You can also export your own data as CSV from inside the app: Stats screen → "Export my data as CSV". Useful for portability + spreadsheet analysis; not a substitute for binary backups (the CSV doesn't include equipment photos or DB-internal state like the mutation_log). Under v0.2 multiuser, the export is always scoped to the calling user; cross-account export is intentionally not supported.

## Smoke test

A node-fetch smoke test runs the full server-side contract against the dev container:

```sh
pnpm test:smoke
```

Hits the running app at http://localhost:5173 (default — override with `TRAJECTORY_URL=...`). Signs in as the seeded admin (`SMOKE_USER=$ADMIN_EMAIL`, `SMOKE_PASS=$ADMIN_PASSWORD`), then exercises gym.create → equipment.create → set.create×3 → /api/export.csv and asserts that the CSV contains the new rows.

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
