# Achievement System — Design

## Context

PR detection just shipped (`set.is_pr` column + server evaluator + optimistic toast on Log). This builds on it: a static badge collection that broadens the motivational surface beyond per-set PRs — milestones, consistency, easter eggs. Goal is to make Trajectory a place you *want* to open, not just where you log work.

Decisions from the brainstorm:

- **Style:** static badge collection (one-time unlocks, no tiers, no rotating challenges).
- **Categories:** PR-style hit-a-target badges + consistency/streak badges. Streaks framed by session-density (3-4×/week reality), not consecutive days.
- **Discovery:** mixed — most badges visible-but-locked, a handful are hidden easter eggs.
- **Gallery location:** new section on `/stats` (existing tab, no new TabBar entry).
- **Unlock UX:** full-screen modal celebration, dismiss-to-continue.
- **Scope:** per-user (matches sessions/sets ownership).
- **Backfill:** going-forward only (consistent with how `set.is_pr` shipped).
- **Architecture:** server-side evaluator runs inside relevant mutation transactions, persisted unread queue, modal driven by layout-load poll.

Out-of-scope for v1 (parking lot for follow-up): tiered/ladder progression, dynamic challenges, volume/cumulative metrics, couple/shared badges, progress bars on locked badges, badge sharing, configurable user badges.

## Data model

One new table: `achievement`.

```ts
achievement {
  id:               text PK              // ULID, server-minted on award
  userId:           text FK user.id       (ON DELETE CASCADE)
  badgeKey:         text NOT NULL         // e.g. 'strength.plate_club'
  unlockedAt:       integer ms NOT NULL
  seenAt:           integer ms NULL       // null = not yet shown via modal
  sourceSetId:      text NULL FK set.id   (ON DELETE SET NULL)
  sourceSessionId:  text NULL FK workout_session.id (ON DELETE SET NULL)
  createdAt / updatedAt: integer ms       // standard footer
}
UNIQUE  (userId, badgeKey)                 // one award per user per badge
INDEX   (userId, seenAt)                   // unread lookup
```

Definitions live in code at `src/lib/achievements/definitions.ts`. Each badge:

```ts
interface BadgeDefinition {
  key: string;                   // 'strength.plate_club'
  category: 'pr' | 'streak' | 'easter';
  hidden: boolean;               // gallery-hidden until earned
  title: string;                 // 'Plate Club'
  description: string;           // 'Hit 100 kg on any lift'
  icon: string;                  // glyph key
  triggers: ('set.created' | 'session.ended')[];
  predicate: Predicate;
}

type Predicate =
  | { kind: 'pr-strength-min'; minKg: number }
  | { kind: 'pr-cardio-distance'; cardioKind?: CardioKind; km: number }
  | { kind: 'pr-cardio-duration'; durationMin: number }
  | { kind: 'cardio-first' }
  | { kind: 'session-density'; sessionsPerWeek: number; weeks: number }
  | { kind: 'comeback-after-gap'; gapDays: number }
  | { kind: 'variety-cardio-kinds-all' }
  | { kind: 'variety-equipment-in-week'; minDistinct: number }
  | { kind: 'variety-groups-in-week'; groups: ('push'|'pull'|'legs'|'core')[] }
  | { kind: 'easter-time-window'; startHour: number; endHour: number; weekdayOnly?: boolean }
  | { kind: 'easter-session-duration-min'; minutes: number }
  | { kind: 'easter-session-set-density'; minSets: number; maxMinutes: number }
  | { kind: 'easter-five-by-five' }
  | { kind: 'easter-pr-day'; minPrs: number }
  | { kind: 'easter-calendar-day'; month: number; day: number };
```

Predicate kinds are data; SQL is built per-`kind` in the evaluator. No DSL design needed.

The `pr-cardio-distance` predicate compares `extras.distance` directly. Rower distances are stored in metres; treadmill/bike/generic in km. The predicate's `km` field is interpreted in km by default; for rower-targeted badges, supply `cardioKind: 'rower'` and the threshold value `km` is multiplied by 1000 (m). Implementation detail; transparent to badge authors.

## Evaluator

Single entry point:

```ts
// src/lib/server/achievements/evaluator.ts
function evaluateAchievements(
  tx: Tx,
  userId: string,
  trigger: 'set.created' | 'session.ended',
  ctx: { setId?: string; sessionId?: string }
): void
```

Filters definitions by trigger, runs each predicate as one indexed query, and for any newly satisfied:

```sql
INSERT INTO achievement (id, user_id, badge_key, unlocked_at, source_set_id, source_session_id)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (user_id, badge_key) DO NOTHING
```

`ON CONFLICT DO NOTHING` keeps it idempotent against the queue replaying the same mutation. Award lives in the same transaction as the parent mutation (sync transaction, see `69804ef`), so the badge can never land if the parent rolls back.

**Wiring:** two call sites in `src/lib/server/mutations.ts`:

1. Inside `setCreate`'s sync transaction, after the `setTable` insert.
2. Inside `sessionEnd` and `resolveSession`'s stale-session close path, before the transaction returns.

## Surfacing

### Unlock modal

`+layout.server.ts` queries unread achievements on every page load:

```sql
SELECT id, badge_key FROM achievement
WHERE user_id = ? AND seen_at IS NULL
ORDER BY unlocked_at ASC
```

Pushed into a Svelte store (`src/lib/stores/achievementQueue.ts`). New component `<AchievementHost />` mounted in `+layout.svelte` reads the store and renders a full-screen modal for the head of the queue:

- centered badge glyph with tint
- title (e.g. `PLATE CLUB`)
- description (`Hit 100 kg on any lift`)
- footer: `tap anywhere to dismiss`
- on dismiss → POST `/api/achievement/[id]/seen` → store removes head → next badge renders or modal closes.

Why a dedicated endpoint and not the `mutate` router: this is a UI-state ack, not a domain mutation. The endpoint is a single `UPDATE achievement SET seen_at = ? WHERE id = ? AND user_id = ? AND seen_at IS NULL`. The `WHERE seen_at IS NULL` guard is enough — no idempotency dance.

### Stats gallery

New section at the top of `/stats`:

```
RECENT ACHIEVEMENTS                       see all →
[badge] [badge] [badge] [+12 locked]
```

"See all" → `/stats/achievements` (or modal sheet — pick at implementation time, both fine). Full grid of every visible badge, sorted earned-first then locked. Earned: full color, `unlockedAt` date. Locked-visible: dimmed glyph + title + criteria text. Locked-hidden (easter eggs): not rendered until earned. Once earned, easter eggs appear with a `★ secret` tag.

No progress bars in v1.

### Offline / queue replay

Mutation queues offline → server eventually evaluates on drain → unread row exists → next `invalidateAll()` (already fires after drain in `src/lib/sync/sync.ts` ~line 187) refreshes `+layout.server.ts` → modal pops. No separate plumbing.

## v1 badge roster

26 badges — 18 visible + 8 secret.

### Visible — strength PRs (6)

| key | title | criteria |
|---|---|---|
| `strength.first_pr` | First PR | First-ever set with `is_pr=1` for the user |
| `strength.single_plate` | Single Plate | First 60 kg lift on any equipment |
| `strength.plate_club` | Plate Club | First 100 kg lift |
| `strength.two_plates` | Two Plates | First 140 kg lift |
| `strength.triple_plates` | Triple Plates | First 180 kg lift |
| `strength.four_plates` | Four Plates | First 220 kg lift |

### Visible — cardio PRs (5)

| key | title | criteria |
|---|---|---|
| `cardio.first_cardio` | First Cardio | First cardio set ever logged |
| `cardio.5k_club` | 5K Club | First cardio set with distance ≥ 5 km (5000 m on rower) |
| `cardio.10k_club` | 10K Club | First cardio set with distance ≥ 10 km (10000 m on rower) |
| `cardio.half_hour` | Half Hour | First cardio set with `durationMin ≥ 30` |
| `cardio.hour_hero` | Hour Hero | First cardio set with `durationMin ≥ 60` |

### Visible — streaks / consistency (4)

| key | title | criteria |
|---|---|---|
| `streak.steady_three` | Steady Three | ≥3 sessions/week for 4 consecutive ISO weeks |
| `streak.locked_in` | Locked In | ≥3 sessions/week for 8 consecutive ISO weeks |
| `streak.habit_six_months` | Half-Year Habit | ≥3 sessions/week for 26 consecutive ISO weeks |
| `streak.comeback` | Comeback | First session logged after a ≥ 30-day gap |

### Visible — variety (3)

| key | title | criteria |
|---|---|---|
| `variety.polyglot` | Polyglot | At least one set on each of the four cardio kinds |
| `variety.five_faces` | Five Faces | Sets on 5 different equipment within a single ISO week |
| `variety.full_body` | Full Body | Push + pull + legs + core groups within a single ISO week |

### Hidden — easter eggs (8)

| key | title | criteria |
|---|---|---|
| `easter.night_owl` | Night Owl | Set with local hour ∈ [22, 04) |
| `easter.early_bird` | Early Bird | Set with local hour ∈ [04, 06) |
| `easter.lunch_break` | Lunch Break | Set with local hour ∈ [12, 13) on a weekday |
| `easter.marathon` | Marathon | Session > 120 min |
| `easter.speed_run` | Speed Run | Session with ≥5 sets in <20 min |
| `easter.five_by_five` | Five by Five | One session contains 5 sets of 5 reps at the same weight on the same exercise |
| `easter.pr_day` | PR Day | 3 sets with `is_pr=1` within a single session |
| `easter.new_year` | New Year, New PR | Any `is_pr=1` set logged on Jan 1 (local time) |

## Edge cases

- **Soft-deleted source set:** badge stays awarded. `sourceSetId` becomes null via `ON DELETE SET NULL`. Awards don't retroactively un-unlock.
- **Replayed mutation:** unique `(userId, badgeKey)` + `ON CONFLICT DO NOTHING` makes the evaluator idempotent.
- **Streak predicate cost:** session-density runs a `GROUP BY week` query over the last `weeks*7+14` days. Indexed on `(userId, startedAt)` (already exists per `workout_session_user_started_idx`). Cheap.
- **Local-time easter eggs:** stored `set.ts` is UTC. Evaluator computes local hour using the server's TZ (single-deploy assumption). Documented in the file.
- **Backdated sets:** evaluator runs on every `set.create` regardless of `ts`. A backdated set CAN earn a badge if its content matches. Matches "going-forward from deploy" — only post-deploy `set.create` events trigger evaluation, even if the `ts` is in the past.
- **First-deploy state:** no backfill. Existing history shows zero achievements until the next set is logged. Acknowledged.
- **Modal during workout:** the modal is interruptive by design. Tap-to-dismiss is large; the next render returns the user to wherever they were.

## Critical files to modify

- `src/lib/server/db/schema.ts` — add `achievement` table.
- `drizzle/` — generated migration via `pnpm exec drizzle-kit generate`.
- `src/lib/achievements/types.ts` — **new**, `BadgeDefinition` + `Predicate` shared types.
- `src/lib/achievements/definitions.ts` — **new**, the 26-badge roster.
- `src/lib/server/achievements/evaluator.ts` — **new**, `evaluateAchievements` + per-`kind` query builders.
- `src/lib/server/mutations.ts` — wire evaluator into `setCreate` and `sessionEnd`.
- `src/routes/+layout.server.ts` — unread-achievement query, return as `data.achievementQueue`.
- `src/routes/+layout.svelte` — mount `<AchievementHost />`.
- `src/lib/stores/achievementQueue.ts` — **new**.
- `src/lib/components/AchievementHost.svelte` — **new**.
- `src/lib/components/AchievementBadge.svelte` — **new**, earned/locked variants.
- `src/routes/api/achievement/[id]/seen/+server.ts` — **new**, single-purpose POST.
- `src/routes/stats/+page.server.ts` — load earned + locked-visible for gallery.
- `src/routes/stats/+page.svelte` — render the new section.
- `src/routes/stats/achievements/+page.svelte` — **new**, full grid (or sheet inside `/stats`).
- Glyph extension — add achievement-specific icons alongside `src/lib/components/glyph-kinds.ts`.

## Existing functions / utilities to reuse

- `newUlid()` from `src/lib/server/ulid.ts` — for `achievement.id`.
- `Tx` type alias in `src/lib/server/mutations.ts` — pass straight into the evaluator.
- Sync transaction pattern (`69804ef`) — async tx bodies are forbidden under better-sqlite3 12.x.
- `EquipmentGlyph` rendering pattern (`src/lib/components/EquipmentGlyph.svelte`) for the badge glyph component.
- `invalidateAll()` already fires post queue-drain (`src/lib/sync/sync.ts` ~line 187) — reuse, don't add another hook.
- `set.is_pr` (just shipped) — `strength.first_pr` and `easter.pr_day` read it directly.
- ISO-week aggregation pattern from `src/routes/stats/+page.server.ts` — reuse for streak predicates.

## Verification

- **Server unit-level (drive via DB-direct test or smoke extension):**
  - In a fresh DB, fire one `set.create` at 100 kg → row in `achievement` with `badgeKey='strength.plate_club'`, `seenAt IS NULL`.
  - Fire a second 100 kg set → no second row (unique constraint).
  - Soft-delete the source set → `sourceSetId` becomes null, award row remains.
  - Fire a `set.create` at 22:30 local → `easter.night_owl` row.
  - Fire a `session.ended` after 130 minutes elapsed → `easter.marathon` row.
- **Streak predicate:** synthesize 4 ISO weeks × 3 sessions each → `streak.steady_three` awards on the 12th session.
- **Browser flow (chrome-devtools MCP):** log a 100 kg set → modal pops within 2 s of queue drain. Tap dismiss → modal closes, `seenAt` set in DB. Reload → modal does not re-pop. Open `/stats` → "Recent achievements" shows the new badge in full color.
- **Offline:** disable network, log a 100 kg set, no modal. Re-enable → queue drains → modal pops on next render.
- **Smoke test:** extend `tests/smoke.mjs` — after `set.create` at 100 kg, assert the unlocked badge is visible (read endpoint or DB peek).
- **Type-check + lint:** `pnpm exec svelte-check` and `pnpm lint` clean.
- **Push gate:** per CLAUDE.md — `docker compose up` from clean, drive the modal via chrome-devtools, smoke test, then commit + push.

## Implementation order

Each step ships independently and leaves the app in a working state.

1. Schema + migration (`achievement` table). One commit.
2. Definitions + types + evaluator (no UI yet). One commit.
3. Wire evaluator into `setCreate` + `sessionEnd`. One commit.
4. Layout-load unread query + store + modal component + dismiss endpoint. One commit.
5. Stats gallery section + badge component + glyphs + (optional) full-grid route. One commit.
6. Smoke-test extension + verification. One commit.
