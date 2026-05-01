# Trajectory — project context

A self-hosted, multi-user, equipment-first workout tracker. Each user owns their own gyms, equipment, sessions, and sets; account creation is admin-issued. PWA-installable, offline-first writes via IndexedDB queue. Single SQLite DB, single Docker container.

The differentiator is **equipment-first** data modeling: a user's specific gym and its specific machines are the primary objects, not a generic exercise library. Reflects the reality that most training happens at the same gym; people walk up to "the cable row near the mirror," not to "seated cable row" as an abstract exercise.

## Stack

- **SvelteKit 2 + Svelte 5 + TypeScript** — web framework.
- **Drizzle ORM + better-sqlite3 + SQLite** — persistence. Single DB file at `data/db.sqlite`.
- **Better Auth** — email + password, session cookies, admin-issued accounts, self-service password reset.
- **Tailwind CSS 4** — styling. Design tokens in `src/lib/theme.css`.
- **`@vite-pwa/sveltekit`** — PWA (service worker, manifest, offline cache).
- **`sharp`** — image resize for equipment photos.
- **Single Docker container** — Node 22 alpine. `docker compose up` is the only supported dev workflow. Host bind mounts for `data/db.sqlite` and `data/uploads/`.

## File layout

```
.
├── CLAUDE.md                ← you are here
├── README.md                ← user-facing setup + screenshots
├── CHANGELOG.md             ← Keep-a-Changelog; tagged release notes
├── CONTRIBUTING.md          ← contribution guidelines
├── SECURITY.md              ← vulnerability reporting
├── LICENSE                  ← AGPL-3.0
├── Dockerfile               ← multi-stage (dev + prod)
├── docker-compose.yml
├── docker-compose.dokploy.yml
├── package.json
├── svelte.config.js
├── vite.config.ts
├── drizzle.config.ts
├── drizzle/                 ← generated migrations (checked in)
├── e2e/                     ← Playwright e2e (manual safety net)
├── tests/smoke.mjs          ← server-contract smoke test (`pnpm test:smoke`)
├── scripts/
│   ├── backup.sh            ← SQLite .backup API + retention
│   ├── seed-demo.mjs        ← demo account seeding
│   ├── gen-icons.mjs        ← regenerates PWA icons
│   └── snapshot.mjs
├── src/
│   ├── app.html
│   ├── app.css
│   ├── hooks.server.ts      ← auth guard, db connection setup
│   ├── lib/
│   │   ├── theme.css        ← design tokens
│   │   ├── exercises.ts     ← curated exercise list
│   │   ├── components/      ← Stepper, Chip, EquipmentTile, etc.
│   │   ├── icons/           ← SVG glyphs
│   │   ├── server/
│   │   │   ├── db/          ← Drizzle schema + migrations runner + helpers
│   │   │   ├── auth.ts      ← Better Auth config
│   │   │   ├── ulid.ts      ← ULID generator + validator
│   │   │   ├── achievements/evaluator.ts
│   │   │   └── sync/        ← /api/mutate idempotency layer
│   │   └── stores/          ← Svelte stores
│   └── routes/              ← pages + /api routes
├── docs/screenshots/        ← README assets
└── data/                    ← bind-mounted at runtime; gitignored
    ├── db.sqlite
    ├── db.sqlite.pre-migration-<ts>
    ├── backups/db-<ts>.sqlite
    └── uploads/equipment/<ulid>.webp
```

## Common gotchas

- **`equipment` is per-user.** Every read needs to scope by `userId`.
- **All sets FK to an `exercise`, even on machines.** Machines auto-create one hidden exercise (`isHidden=true`) so the FK chain is uniform.
- **`session.gymId` is captured at first set, immutable after.** Modeling a "wrong gym" fix is a manual DB action.
- **`set.extras` is JSON.** Schema doesn't enforce keys — the UI does. Don't try to add per-extra columns.
- **ULIDs are client-generated.** Server validates format on every mutation. Malformed IDs are the most common bug class to defend against.
- **Soft-delete via `deletedAt`** on equipment, exercise, set. Every read query needs `WHERE deletedAt IS NULL`. Use the helper layer in `src/lib/server/db/`.
- **Renaming preserves history; delete-and-recreate doesn't.** Setup offers edit-in-place. Deleting equipment with logged sets requires confirmation.

## Conventions

- **Branches per feature:** `feat-foo`, `fix-bar`. Merge to `main` on completion.
- **Commit style:** small, frequent, present-tense imperative ("add equipment glyph chooser"). Conventional Commits prefix encouraged (`feat:`, `fix:`, `docs:`, `chore:`).
- **Schema changes always via Drizzle migrations.** Never hand-edit an applied migration file. Run `pnpm db:generate` after schema changes; commit the generated SQL.
- **Photos go to `data/uploads/`**, never into the repo.
- **Verify in a real browser before pushing.** Boot in Docker, drive via chrome-devtools MCP, smoke-test the feature, check the console. Fix any failures and re-run before commit + push.
- **No scope cuts framed as "saves N days."** Build effort isn't a cost worth optimizing against; cuts must justify themselves on maintenance, validation, or lock-in grounds.
