# History heatmap readability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/history` workout-frequency heatmap readable on first glance — add day-of-week labels, a month axis, a today-marker, and an explicit-count legend, after re-anchoring the grid to ISO weeks so the row labels are honest.

**Architecture:** The fix is single-component: every change lands in `src/routes/history/+page.svelte`. The bulk of the work is rewriting the `weeks` derivation so that columns are Monday-anchored ISO weeks and rows are weekdays Mon..Sun (instead of rolling 7-day offsets). With that shape in place, the new signage (day labels, month axis, today outline, count legend) becomes straightforward markup.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) + TypeScript + Tailwind CSS 4. No new deps, no new components, no server changes. Verification via the project's per-milestone push gate (Docker boot → chrome-devtools MCP on Galaxy S24 Ultra viewport → smoke-test the UI).

**Test framework note:** Trajectory has no component-test framework — its only automated test is `tests/smoke.mjs`, which exercises the server contract end-to-end. This plan is therefore not TDD-with-unit-tests. Verification is by manual browser inspection at each major step plus the standing per-milestone push gate. Each task ends with a focused visual check.

**Spec:** `docs/superpowers/specs/2026-04-30-history-heatmap-readability-design.md`

---

## File map

- **Modify:** `src/routes/history/+page.svelte` — the only file that changes.
  - Script section: rewrite `weeks` derivation; add `monthLabels`, `todayCol`, `todayRow`, `thisMonday` constants; add `addDays`, `startOfWeekMonday` helper functions.
  - Template section: add day-of-week label column, month axis row, today outline, future-cell shading; replace the `less ▢▢▣▢ more` legend with an explicit-count legend.

No other files are touched. No new components, no shared-lib additions.

---

### Task 1: Create the feature branch

**Files:** none — this is a git operation.

- [ ] **Step 1: Create branch off `main`**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/history-heatmap-readability
```

Expected: `Switched to a new branch 'feat/history-heatmap-readability'`

---

### Task 2: Add date helpers and the ISO-week-anchored `weeks` derivation

**Files:**
- Modify: `src/routes/history/+page.svelte` (script section, lines 1–47 of the current file).

This task replaces the rolling-offset `weeks` derivation with the ISO-week / weekday-row model from the spec. We also add the `monthLabels`, `todayCol`, `todayRow`, and `thisMonday` derivations that the markup will need in subsequent tasks. The on-screen output does **not** change yet because the existing markup still iterates `{#each weeks as col}{#each col as v}…` and reads each cell as a number — Task 4 changes the markup to consume the new cell shape. To keep the page renderable in the meantime, the new `weeks` derivation emits the same `number[][]` shape but with cells now indexed by ISO-week/weekday. The richer per-cell metadata (`date`, `isFuture`) lives in a parallel `weekCells` derivation that Task 4 will wire up.

- [ ] **Step 1: Add date helpers above the existing `let { data }: { data: PageData } = $props();` line**

In the `<script lang="ts">` block, after the `import` statements and before `let { data }` , add:

```ts
function startOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
}

function addDays(d: Date, n: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

// Monday-anchored start-of-week. JS getDay() is 0=Sun..6=Sat; we want
// 0=Mon..6=Sun, so the offset to subtract is (getDay()+6) % 7.
function startOfWeekMonday(d: Date): Date {
    const sod = startOfDay(d);
    const offset = (sod.getDay() + 6) % 7;
    return addDays(sod, -offset);
}

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
```

- [ ] **Step 2: Replace the `weeks` derivation (current lines 23–33)**

Find:

```ts
const weeks = $derived.by(() => {
    const cols: number[][] = [];
    for (let w = 11; w >= 0; w--) {
        const col: number[] = [];
        for (let d = 0; d < 7; d++) {
            col.push(heatmapDays[w * 7 + d] ?? 0);
        }
        cols.push(col);
    }
    return cols;
});
```

Replace with:

```ts
const today = $derived.by(() => startOfDay(new Date()));
const thisMonday = $derived.by(() => startOfWeekMonday(today));

interface HeatmapCell {
    value: number;
    date: Date;
    isFuture: boolean;
}

const weekCells = $derived.by<HeatmapCell[][]>(() => {
    const cols: HeatmapCell[][] = [];
    for (let c = 0; c < 12; c++) {
        // Leftmost column (c=0) is the oldest week, rightmost (c=11) is the
        // current in-progress week. Each column's anchor is its Monday.
        const colMonday = addDays(thisMonday, (c - 11) * 7);
        const col: HeatmapCell[] = [];
        for (let r = 0; r < 7; r++) {
            const cellDate = addDays(colMonday, r);
            const offsetDays = Math.round(
                (today.getTime() - cellDate.getTime()) / 86_400_000
            );
            const value =
                offsetDays >= 0 && offsetDays < heatmapDays.length
                    ? heatmapDays[offsetDays] ?? 0
                    : 0;
            col.push({
                value,
                date: cellDate,
                isFuture: offsetDays < 0
            });
        }
        cols.push(col);
    }
    return cols;
});

// Kept for backwards compatibility with the still-unmodified markup until
// Task 4 wires up the new shape. Same `number[][]` layout, but now indexed
// by ISO-week column and weekday row.
const weeks = $derived(weekCells.map((col) => col.map((c) => c.value)));
```

- [ ] **Step 3: Add `todayCol`, `todayRow`, `monthLabels` derivations directly after the `weeks` line**

```ts
const todayCol = 11; // rightmost column is always the current week
const todayRow = $derived.by(() => (today.getDay() + 6) % 7);

interface MonthLabel {
    col: number;
    label: string;
}

const monthLabels = $derived.by<MonthLabel[]>(() => {
    const out: MonthLabel[] = [];
    let prevMonth = -1;
    for (let c = 0; c < 12; c++) {
        const colMonday = addDays(thisMonday, (c - 11) * 7);
        const m = colMonday.getMonth();
        if (m !== prevMonth) {
            out.push({ col: c, label: monthFmt.format(colMonday) });
            prevMonth = m;
        }
    }
    // Drop a label that lands on the very last column if there's already
    // one earlier — prevents two month names crowding the right edge.
    if (out.length >= 2 && out[out.length - 1].col === 11) {
        const before = out[out.length - 2];
        if (11 - before.col <= 1) out.pop();
    }
    return out;
});
```

- [ ] **Step 4: Type-check the new code**

Run:

```bash
docker compose run --rm app pnpm exec svelte-check --tsconfig ./tsconfig.json
```

Expected: 0 errors, 0 warnings. (Trajectory's CI does not run this; we run it locally for sanity.)

If `docker compose run` is awkward in your environment, equivalent:

```bash
docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c \
  'corepack enable && pnpm install --frozen-lockfile=false --ignore-scripts && pnpm exec svelte-check --tsconfig ./tsconfig.json'
```

- [ ] **Step 5: Visual sanity check**

Boot the dev container (`docker compose up`) and open `http://localhost:5173/history`. The heatmap should still render — same colors, same total session count — because the cell values are unchanged at this point. The visible difference: rows are now weekday-anchored (today's cell is at the rightmost column, today's weekday row), so if today is mid-week, you may notice a couple of empty cells in the bottom-right that didn't exist before. That's correct: those are this week's not-yet-arrived days, currently still rendered as plain zero-cells until Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "refactor(history): re-anchor heatmap to ISO weeks + weekday rows

Rewrites the weeks derivation so columns are Monday-anchored ISO weeks
and rows are Mon..Sun. Adds weekCells (carrying date + isFuture per
cell), todayCol/todayRow, thisMonday, and monthLabels — used by the
upcoming markup work. Cell values are unchanged for the existing
template; the future-cell shading and today outline come in Task 4.

Prep for the heatmap-readability fix; no visual change yet."
```

---

### Task 3: Add the day-of-week label column

**Files:**
- Modify: `src/routes/history/+page.svelte` (template section, around the existing `<div class="mt-3 flex gap-1 overflow-x-auto pb-1" …>` block).

The current grid is a single horizontal flex of 12 columns of 7 cells each. We wrap that in a flex row whose first child is a vertical column of seven 10 px caps day-name labels (`Mon..Sun`) at the same row-pitch as the cells.

- [ ] **Step 1: Replace the `<div class="mt-3 flex gap-1 overflow-x-auto pb-1" …>{#each weeks…}…</div>` block (current lines 154–166)**

Find:

```svelte
<div class="mt-3 flex gap-1 overflow-x-auto pb-1" style="scrollbar-width: none;">
    {#each weeks as col, wi (wi)}
        <div class="flex flex-col gap-1">
            {#each col as v, di (di)}
                <div
                    class="h-[18px] w-[18px] rounded-[4px]"
                    style="background: {colorFor(v)};"
                    title={v > 0 ? `${v} session${v === 1 ? '' : 's'}` : 'no sessions'}
                ></div>
            {/each}
        </div>
    {/each}
</div>
```

Replace with:

```svelte
<div class="mt-3 flex items-end gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
    <div class="flex flex-col gap-1 pt-[4px]">
        {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as dow (dow)}
            <div
                class="flex h-[18px] items-center text-right text-[9px] font-bold uppercase tracking-[0.12em]"
                style="color: var(--color-text-dim-2); width: 24px;"
            >
                {dow}
            </div>
        {/each}
    </div>
    <div class="flex gap-1">
        {#each weeks as col, wi (wi)}
            <div class="flex flex-col gap-1">
                {#each col as v, di (di)}
                    <div
                        class="h-[18px] w-[18px] rounded-[4px]"
                        style="background: {colorFor(v)};"
                        title={v > 0 ? `${v} session${v === 1 ? '' : 's'}` : 'no sessions'}
                    ></div>
                {/each}
            </div>
        {/each}
    </div>
</div>
```

(The `pt-[4px]` on the day-labels column compensates for the `1 px` outline we'll add to the today-cell in Task 4; without it the labels would visually drift up by half a pixel relative to the cells. 4 px is the gap value used between rows.)

- [ ] **Step 2: Visual check**

Reload `/history` in the browser. Seven day-of-week labels should appear to the left of the grid, vertically centered on each row. Row 0 = Mon, row 6 = Sun. The grid should not have shifted up/down relative to the section header.

- [ ] **Step 3: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "feat(history): day-of-week labels on heatmap grid"
```

---

### Task 4: Render cells from `weekCells`, add today outline + future-cell shading

**Files:**
- Modify: `src/routes/history/+page.svelte` (template inside the inner cells `{#each col …}` loop and the `colorFor` helper).

We swap the inner loop from iterating `number[][]` to iterating `HeatmapCell[][]`, then handle the two new visual states (`isFuture`, `todayCol/todayRow`).

- [ ] **Step 1: Update the cells loop**

Find (in the block you edited in Task 3):

```svelte
<div class="flex gap-1">
    {#each weeks as col, wi (wi)}
        <div class="flex flex-col gap-1">
            {#each col as v, di (di)}
                <div
                    class="h-[18px] w-[18px] rounded-[4px]"
                    style="background: {colorFor(v)};"
                    title={v > 0 ? `${v} session${v === 1 ? '' : 's'}` : 'no sessions'}
                ></div>
            {/each}
        </div>
    {/each}
</div>
```

Replace with:

```svelte
<div class="flex gap-1">
    {#each weekCells as col, wi (wi)}
        <div class="flex flex-col gap-1">
            {#each col as cell, di (di)}
                <div
                    class="h-[18px] w-[18px] rounded-[4px]"
                    style="background: {cell.isFuture
                        ? 'rgba(244,237,226,0.025)'
                        : colorFor(cell.value)}; outline: {wi === todayCol &&
                    di === todayRow
                        ? '1px solid var(--color-amber)'
                        : 'none'}; outline-offset: 1px;"
                    title={cell.isFuture
                        ? cell.date.toDateString()
                        : cell.value > 0
                            ? `${cell.value} session${cell.value === 1 ? '' : 's'} · ${cell.date.toDateString()}`
                            : `no sessions · ${cell.date.toDateString()}`}
                ></div>
            {/each}
        </div>
    {/each}
</div>
```

The future-cell color (`rgba(244,237,226,0.025)`) is half the opacity of the existing `colorFor(0)` (`rgba(244,237,226,0.05)`), keeping the value derived from the same warm-text base used elsewhere in the theme.

- [ ] **Step 2: Remove the now-unused `weeks` derivation**

Find the line in the script section (added in Task 2 step 2):

```ts
const weeks = $derived(weekCells.map((col) => col.map((c) => c.value)));
```

Delete it. The template no longer references `weeks`.

- [ ] **Step 3: Visual check**

Reload `/history`. Today's cell should have a thin amber outline (visible whether or not you've trained today). If today is, say, Wednesday, the cells in the rightmost column at rows Thu/Fri/Sat/Sun should be visibly fainter than the zero-cells in past weeks. Hovering a cell on desktop should show a date in the tooltip.

- [ ] **Step 4: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "feat(history): today-cell outline + dim future cells in heatmap"
```

---

### Task 5: Add the month axis row above the grid

**Files:**
- Modify: `src/routes/history/+page.svelte` (template section, immediately before the `<div class="mt-3 flex items-end gap-2 …">` heatmap row added in Task 3).

The month axis is a thin row of small caps month labels positioned above the columns where each new month begins. The `monthLabels` derivation (Task 2) already gives us `{ col, label }` pairs. We render one absolutely-positioned label per entry, using the same column geometry as the grid (`18 px cell + 4 px gap = 22 px per column`, with a `28 px` left inset to account for the day-labels column added in Task 3).

- [ ] **Step 1: Insert the month axis row**

Find (added in Task 3):

```svelte
<div class="mt-3 flex items-end gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
```

Immediately above that, insert:

```svelte
<div class="relative mt-2 h-[14px]" style="padding-left: 32px;">
    {#each monthLabels as ml (ml.col)}
        <div
            class="absolute top-0 text-[9px] font-bold uppercase tracking-[0.12em]"
            style="left: calc(32px + {ml.col} * 22px); color: var(--color-text-dim-2);"
        >
            {ml.label}
        </div>
    {/each}
</div>
```

- [ ] **Step 2: Adjust the heatmap row's top margin to compensate**

The month axis is now `mt-2 h-[14px]` directly above the heatmap. Reduce the heatmap row's top margin so the visual gap between the section header and the month axis stays similar to the previous header-to-grid gap.

Find:

```svelte
<div class="mt-3 flex items-end gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
```

Replace with:

```svelte
<div class="mt-1 flex items-end gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
```

- [ ] **Step 3: Visual check**

Reload `/history`. At least one month label (probably two, depending on the date) should appear above the grid, aligned over the column where its month begins. The columns themselves should not have shifted left/right.

- [ ] **Step 4: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "feat(history): month axis above heatmap grid"
```

---

### Task 6: Replace the gradient legend with an explicit-count legend

**Files:**
- Modify: `src/routes/history/+page.svelte` (template section, the streak / total-time / legend row at lines 167–189 in the current file).

- [ ] **Step 1: Replace the legend block**

Find:

```svelte
<div class="ml-auto flex items-center gap-1">
    <span>less</span>
    <span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(0)};"></span>
    <span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(1)};"></span>
    <span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(2)};"></span>
    <span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(3)};"></span>
    <span>more</span>
</div>
```

Replace with:

```svelte
<div class="ml-auto flex items-end gap-2">
    {#each [0, 1, 2, 3] as n (n)}
        <div class="flex flex-col items-center gap-0.5">
            <span class="text-[9px] font-bold uppercase tracking-[0.12em]" style="color: var(--color-text-dim-2);">
                {n === 3 ? '3+' : n}
            </span>
            <span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(n)};"></span>
        </div>
    {/each}
    <span class="ml-1 text-[10px] font-medium" style="color: var(--color-text-dim-2);">
        sessions
    </span>
</div>
```

- [ ] **Step 2: Visual check**

Reload `/history`. The bottom row of the heatmap card should now show the streak number on the left, the total `Hh Mm` in the middle, and on the right four labeled swatches (`0 1 2 3+`) with the trailing word `sessions`. The four swatch fills should match the colors of the actual cells in the grid above (zero-cell vs 1-session vs 2-session vs 3+).

- [ ] **Step 3: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "feat(history): explicit-count heatmap legend (0 / 1 / 2 / 3+)"
```

---

### Task 7: Per-milestone push gate — Docker boot, browser smoke, push

**Files:** none — this is the standing project verification protocol.

Per `CLAUDE.md`'s "Per-milestone push gate (mandatory)" section, before pushing any branch that closes a milestone we must boot in Docker, drive via chrome-devtools MCP, and smoke-test every "Done when" bullet through the actual UI.

- [ ] **Step 1: Boot the dev container from clean**

```bash
docker compose down
docker compose up
```

Tail the logs in a second terminal. Expected: no errors, no missing-env warnings, migrations apply cleanly.

- [ ] **Step 2: Navigate via chrome-devtools MCP at Galaxy S24 Ultra resolution**

Open a chrome-devtools session against `http://localhost:5173`, emulate viewport `412x915x3,mobile,touch`, sign in (`johnny:changeme` if seed default; otherwise the local override), and navigate to `/history`.

- [ ] **Step 3: Walk the spec's testing checklist on the live UI**

For each item in the spec's `## Testing` section (8 bullets), confirm the behavior on screen:

1. Section header reads `WORKOUT FREQUENCY`; the count chip on the right matches the recent-sessions list.
2. Seven day-of-week labels appear, Mon→Sun top→bottom, vertically aligned with the rows.
3. At least one month label appears above the grid over a column that begins that month.
4. Today's cell has a visible 1 px amber outline, even with 0 sessions logged today.
5. Legend reads `0 1 2 3+` over four swatches with the trailing word `sessions`, right-aligned on the same row as the streak / total-time stats.
6. No horizontal scroll at the 412 px viewport.
7. Switching gym filter (`All gyms` ↔ a single gym) updates cell fills but doesn't disturb the today outline, future-cell shading, or month labels.
8. Future cells (rest of the current week past today) render at lower opacity than zero-cells.

If any check fails, fix in place, re-boot, and re-walk. Do not skip.

- [ ] **Step 4: Push the branch + open a PR (if PRs are part of the workflow) or merge to main**

If the project's convention is feature-branch + merge to main on milestone close (per `CLAUDE.md`):

```bash
git checkout main
git merge --no-ff feat/history-heatmap-readability -m "merge: history heatmap readability"
git push origin main
```

If the user prefers a PR-based flow, push the branch and open a PR instead:

```bash
git push -u origin feat/history-heatmap-readability
gh pr create --title "fix(history): make workout-frequency heatmap readable" --body "Implements docs/superpowers/specs/2026-04-30-history-heatmap-readability-design.md. Adds Mon..Sun row labels, month axis, today outline, future-cell shading, and an explicit-count legend (0/1/2/3+ sessions). Required reshaping the cell-data derivation to ISO weeks + weekday rows."
```

---

## Self-review notes

- **Spec coverage:** Each spec section maps to a task. Layout + day-of-week labels → Task 3. Month axis → Task 5. Today marker → Task 4. Legend → Task 6. Cell sizing math → unchanged (cells stay 18 px, day-label column eats 24 + 4 + 4 = 32 px including gap; total grid width with day labels ≈ 296 px, well within the 416 px usable space inside the card). Color + accessibility → preserved (`colorFor` reused). Data flow → Task 2 (ISO-week reshape, future-cell metadata, today index, month boundaries). Components → all in `+page.svelte`. Error handling → empty heatmap (handled by zero-cell fall-through), `Intl` fallback (`Intl.DateTimeFormat` is required by spec; we don't add a fallback — modern runtimes 100% support it, and adding a fallback would be YAGNI), DST/timezone (handled by `setHours(0,0,0,0)` + millisecond offset arithmetic between same-time anchors). Testing → Task 7 walks every bullet.
- **Placeholders:** none.
- **Type consistency:** `HeatmapCell` defined in Task 2, consumed in Task 4. `MonthLabel` defined in Task 2, consumed in Task 5. `weekCells`, `monthLabels`, `todayCol`, `todayRow` referenced consistently across tasks.
- **One snag the plan addresses:** the existing `weeks` derivation aliasing in Task 2 lets the page keep rendering between Task 2 and Task 4 (otherwise the markup would crash on the type change). Task 4 deletes the alias once the markup is updated.
