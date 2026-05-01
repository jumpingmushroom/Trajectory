# Changelog

All notable changes to Trajectory are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-01

Initial public release.

### Added

- **Per-user tenancy.** Each account owns its own gyms, equipment, sessions, and sets. Equipment is no longer shared across accounts.
- **Admin-issued accounts.** No public sign-up. The first admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first boot of an empty database; subsequent users are invited by email from `/admin/users`. Self-service password reset (`/login/reset`) is available to anyone with a valid account.
- **Achievement system.** Server-side evaluator (`src/lib/server/achievements/evaluator.ts`) that fires on `setCreate` and `sessionEnd`, an unlock modal, a Stats gallery view, and a `/api/achievement` read endpoint.
- **PR detection.** Server-side evaluator that tags a `set` as a personal record per equipment, surfaced in the log flow with an optimistic toast.
- **Stats time-range selector.** Global 7-day / 30-day / 3-month / 6-month / 1-year / All toggle.
- **Manual session start/end** with undo, plus an empty-session lifecycle.
- **Backdated sessions** via the Today chip on Home and Log.
- **Backup tooling.** `scripts/backup.sh` invokes `better-sqlite3`'s online backup API and prunes old snapshots (14 dailies + 8 weeklies; 5 most recent pre-migration snapshots).
- **CSV export** scoped per user (`/api/export.csv`).
- **Playwright e2e scaffold** (`e2e/full-flow.spec.ts`) as a manual safety net alongside the existing smoke test.

### Changed

- Setup glyph picker: tap-to-edit, glyph tap auto-advances, pre-fills type/group from glyph, search + category sections, expanded glyph library through tier 3.
- Stats screen split into strength and cardio sections.
- History and session detail use cardio duration when longer than wall-clock time.
- Sessions render each set by its own shape rather than the equipment's type, so historical sets remain consistent if equipment is later edited.
- Mutation API enforces the `cardioKind` ↔ `type` invariant on `equipment.update`.

### Fixed

- Offline banner stops trusting `navigator.onLine` and instead probes `/api/mutate`.
- 19 UX audit findings across home, log, history, stats, setup, and sessions.
- Equipment photo URLs cache-bust against `updatedAt`.
- Session bar clears the tab bar instead of overlapping it.
- Stats delta computation on single-point series no longer divides by zero.

[0.2.0]: https://github.com/jumpingmushroom/Trajectory/releases/tag/v0.2.0
