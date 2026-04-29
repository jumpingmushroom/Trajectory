# Trajectory

A self-hosted, equipment-first workout tracker for two people.

Status: **v0.1.0-dev**, Milestone 1 of 12 (foundation only — Docker dev environment + SvelteKit hello world).

## Quickstart

```sh
docker compose up
```

→ http://localhost:5173

That's the entire dev workflow. The container handles `pnpm install`, the Vite dev server runs with HMR (polling-based, so file edits on the host trigger browser updates inside the container without a restart), and persistent state lives under `./data` on the host via a bind mount.

The **only** supported way to run Trajectory locally is inside the container — there is no `pnpm dev` workflow on the host.

## What's where

- `BRAINSTORM.md` — design decisions for v0.1.
- `DECISIONS.md` — outcomes of the adversarial grilling pass.
- `ROADMAP.md` — twelve milestones with explicit "Done when" criteria.
- `FUTURE.md` — out-of-scope ideas, deliberately deferred.
- `CLAUDE.md` — project context for AI sessions (stack, conventions, gotchas).
- `handoff/` — original Claude Design HTML/JSX prototype (visual reference, not ported code).
- `src/` — SvelteKit app source.
- `data/` — host-bind-mounted persistent state (gitignored). SQLite DB and equipment photos live here once M3+ lands.

## Stack

SvelteKit 2 + Svelte 5 + TypeScript · Drizzle + SQLite (M3) · Better Auth (M2) · Tailwind CSS 4 · `@vite-pwa/sveltekit` (M11) · single Docker container with host bind mounts.

## Environment

Copy `.env.example` to `.env` before first run. M1 doesn't require any env vars to boot, but the file documents what's coming in M2+.

## Verifying M1

After `docker compose up`:

1. Browser at http://localhost:5173 shows "Hello, gym." in the dark/amber design idiom.
2. `data/.placeholder` appears on the host filesystem after the first page load.
3. Editing `src/routes/+page.svelte` triggers a hot reload in the browser without restarting the container.
4. `docker compose down && docker compose up` preserves the contents of `data/`.

## Stopping

```sh
docker compose down
```

`docker compose down -v` removes the named volumes for `node_modules` and `.svelte-kit` (forcing a reinstall on next boot) but never touches `./data`.
