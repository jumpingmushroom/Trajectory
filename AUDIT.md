# Trajectory — code-health audit

Read-only audit. Scope: correctness bugs, performance, dead code. No code changed.
Idioms cross-checked against installed versions via Context7 (Drizzle better-sqlite3
sync transactions + `onConflictDoNothing`; Svelte 5 `$derived`/`$effect`) — current
patterns confirmed, no stale-API suggestions below.

Sorted by impact within each category. "Behavior change" = does the fix alter
observable output for correct inputs.

---

## Correctness

### C1 — Idempotency log is written _before_ the mutation runs → silent data loss on transient errors ⚠ HIGH

**Where:** `src/lib/server/mutations.ts:1420` (in `applyMutation`), helper `logMutation` at `:216`.

**What's wrong:** `applyMutation` calls `logMutation(...)` first — a standalone
`INSERT INTO mutation_log` that auto-commits immediately — and _then_ runs the op
handler:

```
const fresh = logMutation(envelope.clientId, envelope.mutationId, userId); // committed now
if (!fresh) return { replayed: true, result: null };
... await gymCreate(payload, userId) // may throw AFTER the log row exists
```

If a handler throws a 5xx (DB busy, disk full, an unexpected exception — anything
that isn't a `badRequest`/`notFound`), the `mutation_log` row is already committed.
The client's sync drainer (`src/lib/sync/sync.ts:171-180`) treats 5xx as retryable
and re-POSTs the **same** `(clientId, mutationId)`. On retry, `logMutation` hits the
composite-PK conflict, returns `false`, and `applyMutation` returns
`{ replayed: true }` with HTTP 200 → the drainer calls `complete()` and deletes the
mutation from IndexedDB. **The write is now lost permanently** while both client and
server believe it synced.

**Why it matters:** This defeats the project's core guarantee — _"a network blip at
the gym doesn't drop a logged set"_ (`mutate.ts:2`). A **server**-side blip drops it
silently, with no error surfaced to the user. It's the worst failure mode for this app.

**Proposed fix (low-risk):** Keep log-first (it's what serializes concurrent
duplicates), but on a handler throw, best-effort `DELETE` the just-inserted
`mutation_log` row before rethrowing, so a retry re-applies cleanly:

```
const fresh = logMutation(...);
if (!fresh) return { replayed: true, result: null };
try {
  // ... existing switch ...
} catch (err) {
  db.$client.prepare(
    `DELETE FROM mutation_log WHERE client_id = ? AND mutation_id = ?`
  ).run(envelope.clientId, envelope.mutationId);
  throw err;
}
```

Alternative: log _after_ the handler succeeds. Re-apply on a crash-between-apply-and-log
is safe because every handler is already idempotent (ULID PKs + `onConflictDoNothing`),
but it weakens the concurrent-duplicate guard, so the compensating-delete is preferred.

**Risk:** med (touches the central write path; needs a test for the throw→retry path).
**Behavior change:** yes — failed-then-retried mutations now apply instead of vanishing.

---

### C2 — PR evaluation runs outside the transaction, contradicting its own comment · LOW–MED

**Status:** ✅ Implemented in this PR — `evaluatePr` is now synchronous (`tx` + `.get()`) and called inside the set-create transaction.

**Where:** `src/lib/server/mutations.ts:1073` (call), comment at `:1070-1072`, `evaluatePr` at `:819`.

**What's wrong:** The comment says _"Computed inside the transaction below so a
concurrent set.create … can't both see the same prior max and both flag PR."_ But
`evaluatePr` is `await`-ed **before** `db.transaction(...)` opens, and it issues its
own top-level `await db.select(...)`. Two concurrent `set.create`s for the same
exercise can both resolve their `MAX(...)` against the pre-insert state and **both
persist `isPr = true`**. (Single-writer SQLite serializes the _inserts_, but the async
`await` points in `evaluatePr` interleave before either transaction begins.)

**Why it matters:** Spurious double-PR flags → duplicate/incorrect PR-based achievements
and a wrong "PR" badge on the History/Stats rows. Low frequency (needs near-simultaneous
sets on one exercise, e.g. a double queue-drain), but the comment asserts a guarantee
the code doesn't provide.

**Proposed fix:** Move the PR computation inside the `db.transaction` block, reading via
`tx … .get()` (sync, like the rest of that transaction), so the `MAX` and the insert are
atomic. If left as-is, at minimum correct the misleading comment.
**Risk:** med (transaction body is sync-only — must convert the three `evaluatePr`
queries to `.get()`). **Behavior change:** yes (fixes over-counted PRs).

---

### C3 — Achievement "variety" queries count sets from soft-deleted equipment · LOW

**Where:** `src/lib/server/achievements/evaluator.ts:246-321` (`variety-cardio-kinds-all`,
`variety-input-modes-all`, `variety-equipment-in-week`, `variety-groups-in-week`).

**What's wrong:** These join `set → exercise → equipment` and `countDistinct(...)` but
filter only `isNull(setTable.deletedAt)` — never `equipment.deletedAt` /
`exercise.deletedAt` / `gym.deletedAt`. `equipmentDelete` (`mutations.ts:598`) soft-deletes
the equipment **and** its exercises but **not** the sets. So sets belonging to deleted
equipment still join and inflate the distinct counts.

**Why it matters:** Users can unlock variety badges from gear they've since deleted.
Cosmetic (achievements only), but inconsistent with every other read path, which honors
the tombstone (CLAUDE.md: _"every read query needs `WHERE deletedAt IS NULL`"_).

**Proposed fix:** Add `isNull(equipment.deletedAt)` (and `isNull(exercise.deletedAt)`)
to these four predicates. **Risk:** low. **Behavior change:** yes (slightly stricter
achievement gating).

### C4 — `derivedExerciseId` can collide for two equipment sharing a 25-char ULID prefix · LOW

**Where:** `src/lib/server/mutations.ts:1400-1403`.

**What's wrong:** The hidden-exercise PK is `equipmentId.slice(0, 25) + 'X'` — i.e. two
equipment whose ULIDs differ only in the last character map to the **same** hidden
exercise id. The insert uses `onConflictDoNothing`, so on collision the second machine
silently gets **no** hidden exercise and its sets would FK to the first machine's.

**Why it matters:** Astronomically unlikely (last ULID char is part of the random
component), but it's a real latent uniqueness bug with a silent, hard-to-debug failure
(cross-machine set attribution). **Proposed fix:** derive the id deterministically with
no information loss (e.g. hash `equipmentId` → ULID-shaped string) or mint a fresh ULID
and store the mapping. **Risk:** med (PK scheme is load-bearing for rename cascades — would
need a migration if changed for existing rows). **Behavior change:** no for new installs.
Flagging for a decision rather than recommending an immediate change.

### C5 — `mutate()` reports success when a queued mutation was discarded as a permanent 4xx · LOW

**Where:** `src/lib/mutate.ts:34`; discard path `src/lib/sync/sync.ts:164-170`.

**What's wrong:** On a permanent 4xx the drainer logs, toasts "change discarded", and
`complete()`s the entry — but does **not** increment `drained`. `mutate()` then sees
`drained === 0 && remaining === 0` and returns `{ queued: false }`, indistinguishable from
a real success. Callers awaiting `mutate()` can't tell the write was dropped.

**Why it matters:** Optimistic UI may show the change as saved while it was rejected (the
toast is the only signal). **Proposed fix:** have the drainer report discards, or have
`mutate()` surface a `discarded` flag. **Risk:** low. **Behavior change:** yes (callers
gain a new signal).

---

## Performance

### P1 — Stats loader fetches the user's entire set history regardless of range · MED

**Where:** `src/routes/stats/+page.server.ts:80-107` (query), filtered in JS at `:136`, `:157`, `:219`.

**What's wrong:** The query has no `ts` predicate — it pulls **every** non-deleted set
for the user, then drops anything older than `cutoff` in JS loops. Viewing "7d" on a
multi-year account still loads the full history into memory on every render.

**Why it matters:** Unbounded growth on the most-visited analytics page; memory + CPU
scale with lifetime data, not the selected window.

**Proposed fix:** When `range !== 'all'`, push `gte(setTable.ts, new Date(cutoff))` into
the `WHERE`. The existing `set_user_ts_idx (userId, ts)` already supports it.
**Risk:** low. **Behavior change:** none (identical results; `all` unchanged).

### P2 — Home loader fetches all of the user's sets to compute last-set-per-equipment · MED

**Where:** `src/routes/+page.server.ts:82-110`.

**What's wrong:** `lastSetsRaw` selects every non-deleted set for the user (no `LIMIT`),
ordered by `ts desc`, then a JS `Map` keeps the first row per `equipmentId`. Only the
newest set per tile is needed, but the whole history is transferred and walked on every
home-screen load (the app's landing page).

**Why it matters:** Home is the hottest route; cost grows with total sets logged.

**Proposed fix:** Restrict to the active gym's equipment and/or use a per-equipment
"latest row" query (correlated subquery or `row_number()` window) so the DB returns ~N
rows (one per tile) instead of the full history. **Risk:** med (query rewrite — verify
prefill values are unchanged). **Behavior change:** none if done correctly.

### P3 — History loader scans all sessions + all sets with no window · LOW–MED

**Where:** `src/routes/history/+page.server.ts:34-71`.

**What's wrong:** Loads every session and every set for the user to build summaries,
though the heatmap only consumes the last 84 days (`:153`). The session _list_ is a
genuine full-history view, but the per-set summary scan grows unbounded.

**Why it matters:** Scaling concern on a long-lived account; not wrong today.

**Proposed fix:** If/when the session list is paginated, scope the set scan to the
visible page; otherwise note as accepted. **Risk:** med. **Behavior change:** depends on
pagination decision — flagging, not recommending blindly.

### P4 — `sharp` image processing on the request thread · LOW (note only)

**Where:** `src/routes/api/equipment/[id]/photo/+server.ts:51`, `src/routes/api/profile/avatar/+server.ts:34`.

CPU-bound resize/encode runs inline (`await sharp(...).toBuffer()`), blocking the event
loop ~100-500ms per upload. Acceptable for a single-user homelab with rare uploads;
documented here only. No change recommended.

---

## Dead code

### DC1 — `effectiveLoadSql` exported, never used · remove

`src/lib/server/db/effective-load.ts:27`. Grep finds only the definition. Aggregate
queries inline the equivalent `COALESCE(...) + COALESCE(json_extract(...))` SQL directly
(e.g. `mutations.ts:878`). **Risk:** none. **Behavior:** none.

### DC2 — `notDeleted` helper exported, never used (whole file is dead) · remove or adopt

`src/lib/server/db/queries.ts:17`. The only references are in its own doc-comment. No
query uses it despite CLAUDE.md pointing at "the helper layer in `src/lib/server/db/`".
Either delete `queries.ts` or adopt it where soft-delete filters are currently inline.
**Risk:** none (delete) / med (adopt — touches many queries). **Behavior:** none.

### DC3 — `pendingMatching` exported, never imported · remove

`src/lib/sync/status.ts:52`. Comment claims the Log screen uses it for optimistic rows;
grep shows no importer. **Risk:** none. **Behavior:** none.

### DC4 — `listPendingByOp` exported, never imported · remove

`src/lib/sync/queue.ts:77`. No callers. **Risk:** none. **Behavior:** none.

### DC5 — `src/lib/index.ts` is the empty SvelteKit scaffold · leave

Contains only the default placeholder comment. Conventional; harmless. No action.

---

## Checked and clean (no action)

- **Tenancy scoping:** all `equipment`/`exercise`/`set`/`gym`/`workout_session` reads are
  scoped by `userId` (directly or transitively via the gym join). `assertGymOwned` /
  `assertEquipmentOwned` / `assertExerciseOwned` guard every mutation. The admin user list
  (`admin/users/+page.server.ts`) intentionally lists all users — gated by the role check
  in `hooks.server.ts`, correct for single-tenant.
- **Indexes:** composite indexes cover the hot filters/sorts — `set_user_ts_idx`,
  `set_exercise_ts_idx`, `workout_session_open_idx (userId, endedAt)`,
  `equipment_gym_id_deleted_at_idx`, `achievement_user_badge_unq`. No missing index found
  for the queries reviewed.
- **Transactions:** sync-body requirement for better-sqlite3 12.x is correctly observed
  (`set.create`, `session.end`, `equipment.delete`); confirmed current via Context7.
- **Timers/listeners:** sync runtime, `holdRepeat`, `swipe`, and the Log clock tick all
  clean up (`onDestroy` / action `destroy`).
- **Svelte effects:** `AchievementHost` and the Log seeding effects read `$page.data`/
  selection and write _form_ state — a legitimate prop→input sync, guarded against
  re-entry; not the "effect that derives state" anti-pattern. No infinite-loop risk found.
- **Boot:** `ensureBoot` singleton-promise resets on failure so a transient migration
  error doesn't brick the server; pre-migration snapshot taken before applying.
  </content>
  </invoke>
