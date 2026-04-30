---
date: 2026-04-30
topic: history heatmap readability
status: approved-design
---

# History heatmap readability

## Problem

The Workout-frequency heatmap on `/history` is unreadable on first glance. It renders 12 weeks × 7 days as a grid of amber squares with no row labels, no column labels, no date context, and only a tiny `less ▢▢▣▢ more` gradient legend. A user looking at it cannot answer:

- Which row is which day of the week?
- Which column is which week (or month)?
- What does an amber-shaded cell actually mean — is it 1 session, an intensity score, or something else?
- Where is "today"?

The fix is signage, not metrics. The underlying data (`heatmapDays[0..83]`, oldest-to-newest, sessions-per-day count) is correct.

## Goals

1. A user landing on `/history` for the first time can name what every cell on the grid represents without reading docs.
2. They can locate "today" without counting cells from the right.
3. They can map any column back to a real-world calendar week (at least to the month).

## Non-goals

- Tap-to-inspect popover on individual cells. The recent-sessions list below the heatmap already provides drill-in.
- Redesigning the metric itself (binary "did you train" vs counted sessions, etc.). The current sessions-per-day bucketing stays.
- Animations, transitions, dark/light theming variants. Out of scope.

## Design

### Layout

Inside the existing `WORKOUT FREQUENCY` card, the heatmap grows three new pieces of signage and a marker:

```
WORKOUT FREQUENCY                                            N sessions
                  Apr     May
              ┌─────────────────────────────────────────────┐
        Mon   │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢                    │
        Tue   │ ▢ ▣ ▢ ▢ ▣ ▢ ▢ ▢ ▣ ▢ ▢ ▢                    │
        Wed   │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▣ ▢ ▢                    │
        Thu   │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢                    │
        Fri   │ ▢ ▢ ▣ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▣                    │
        Sat   │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢                    │
        Sun   │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢◉ ←today            │
              └─────────────────────────────────────────────┘
N-day streak       Hh Mm total                0   1   2   3+ sessions
                                              ▢   ▣   ▣   ▣
```

### Pieces

**1. Day-of-week labels (left column).**
Three-letter caps (`Mon Tue Wed Thu Fri Sat Sun`) at 10 px, color `--color-text-dim-2`, fixed-width column. Aligned vertically with the cell rows. Always visible — no Mon/Wed/Fri-only abbreviation.

**2. Month axis (top).**
Small caps month labels (`Apr`, `May`, …) at 10 px, color `--color-text-dim-2`, positioned above the first column whose week contains the 1st of that month (or, equivalently, above the leftmost column whose Monday belongs to that month). Edge cases: if a month appears in only one column at either end of the 12-week window, the label is dropped to avoid clutter; if two adjacent months would label the same column, only the later one is shown.

**3. Today marker.**
The cell whose date equals "today" (local time, midnight-anchored) gains a 1 px outline in `var(--color-amber)`. Outline is drawn outside the cell so it doesn't change the fill or shrink the colored area. Visible regardless of session count — even on a zero-cell.

**4. Explicit-count legend (bottom right).**
Replaces the `less ▢▢▣▢ more` gradient. Renders four labeled swatches: `0`, `1`, `2`, `3+` (in caps, 10 px) with the corresponding `colorFor(n)` swatch directly underneath. Trailing label `sessions` to the right. Sits on the same row as the streak / total-time stats, right-aligned via `ml-auto`.

### Cell sizing + viewport math

Cells stay at 18 × 18 px with 4 px gaps. Day labels add ~28 px on the left (24 px text + 4 px right-pad). Total grid width: `28 + 12·(18+4) − 4 = 288 px`. The card sits inside `max-w-[480px]` with `p-4` outer + `p-4` inner = `448 − 32 = 416 px` available, comfortably > 288 px. No layout regression on Galaxy S24 Ultra (412 CSS px viewport).

The grid section keeps `overflow-x-auto` as a safety net for unusually narrow viewports.

### Color + accessibility

The four buckets keep their existing values (`colorFor(0..3+)` in the component). The legend's swatches reuse the same function so a future tweak to thresholds propagates everywhere.

`title` attributes remain on each cell as a desktop-only nicety; phone users ignore them. No tap interaction is added (per non-goals).

The today-cell outline uses `outline` (not `border`) to avoid shifting the cell box. Outline width 1 px, color `var(--color-amber)`, offset 1 px so it sits visibly outside the rounded cell without overlapping neighbors.

## Data flow

No server-side changes. The page-load function in `src/routes/history/+page.server.ts` returns the same `heatmap` (keyed by day-offset 0..83 from today) and `sessions` arrays it does today.

The client-side `weeks` derivation, however, **must change**. Today's grid lays out rows as rolling 7-day offsets (row 0 of the rightmost column = today, row 1 = yesterday, …). Adding `Mon Tue Wed …` labels on top of that would lie about most rows. We re-anchor the grid to ISO weeks before labelling:

1. **ISO-week column model.** Compute the Monday of the current week (`thisMonday`). The 12 columns represent the Mondays of `thisMonday − 11×7`, `thisMonday − 10×7`, …, `thisMonday`. The leftmost column is the oldest week; the rightmost is the current (in-progress) week.

2. **Day-row mapping.** Each cell in column `c`, row `r` (with `r=0` for Monday … `r=6` for Sunday) maps to a calendar date `monday(c) + r`. The day-offset back to today is `daysBetween(today, that date)`, and the cell's session count is `heatmapDays[offset]` if `0 ≤ offset ≤ 83`, else 0.

3. **Future-cell handling.** Cells whose calendar date is *after* today (e.g. Sat/Sun of the current week when today is Thursday) get a distinct "not-yet" rendering: same shape and size as a zero-cell but at lower opacity (~50% of `colorFor(0)`), so the eye reads them as outside the bound rather than mistaking them for "didn't train". No outline.

4. **Today's grid index.** `todayCol = 11`, `todayRow = (today.getDay() + 6) % 7` (JS `getDay()` returns 0=Sun..6=Sat; the `+6 % 7` rotates to 0=Mon..6=Sun, matching row order).

5. **Month boundaries.** Derived list `monthLabels: { col: number; label: string }[]` walks the 12 columns left-to-right, taking each column's Monday date, and pushes a label whenever its month differs from the previous column's month (and for the first column always). Month names use the user's locale via `Intl.DateTimeFormat(undefined, { month: 'short' })`. If two months end up labelling the same column due to the boundary collision rule (a month that occupies only one column at either end), the later one wins.

All derivations run inside `$derived.by` and are cheap (O(84) once per filter change).

The "current streak" calculation (lines 40–47 of the current component) keeps its existing `heatmapDays`-offset-based logic — it's day-offset semantics, not grid-position semantics, and stays correct.

## Components

All changes land inside `src/routes/history/+page.svelte`. No new components, no shared-lib additions.

The existing `heatmapDays` derivation stays. The `weeks` derivation is rewritten to the ISO-week / weekday-row model described above and now yields `{ value: number; date: Date; isFuture: boolean }[]` per cell rather than just `number[]`. New constants: `monthLabels`, `todayCol`, `todayRow`, `thisMonday` (memoized at the top of the script). The legend swatches replace lines 181–188 of the current file. The streak calculation is untouched.

## Error handling

This is a presentational change against existing data. Failure modes:

- **Empty heatmap (no sessions in 12 weeks):** the grid renders all-zero cells (with the future-cell variant for cells past today) and the today-outline still visible on its assigned cell. The legend still shows `0 / 1 / 2 / 3+`. No special-case copy needed; the design is honest about an empty history.
- **Locale lookup fails / `Intl` unavailable:** fall back to English short month names (`Jan Feb Mar …`). In practice every modern runtime supports `Intl.DateTimeFormat`; this is belt-and-braces.
- **Clock skew / timezone / DST:** the `today`, `thisMonday`, and per-cell dates are all computed from `new Date()` on the client at midnight (`setHours(0,0,0,0)`). Day arithmetic uses `+ 86_400_000` only between same-time anchors, so DST transitions don't corrupt the column boundaries. Server-rendered HTML may briefly show the previous day's outline if the user crosses midnight while the page is in cache; the outline rerenders on hydration. Acceptable.

## Testing

Manual verification on the staging deploy at `https://trajectory.apps.jumpingmushroom.com` after deploy:

1. Header on the heatmap section reads `WORKOUT FREQUENCY` and the count chip on the right matches the recent-sessions list filter.
2. Seven day-of-week labels appear, in Monday-first order, vertically aligned with the rows.
3. At least one month label appears above the grid, positioned over a column that begins that month.
4. Today's cell has a visible 1 px amber outline, even with 0 sessions logged today.
5. The legend reads `0 1 2 3+ sessions` with four matching swatches and is right-aligned on the same row as the streak / total-time stats.
6. Layout fits cleanly at the Galaxy S24 Ultra viewport (412 × 915 CSS px) without horizontal scrolling.
7. Filter chip switching (All gyms ↔ a single gym) updates the cell fills but doesn't disturb the today outline, the future-cell shading, or the month labels.
8. Cells whose date is after today (the remainder of the current week) render at lower opacity than zero-cells. Logging a set on one of those days "lights up" the correct cell on next reload.

No automated test is added. The smoke test (`tests/smoke.mjs`) does not assert UI; the rendered DOM is exercised by hand per the project's per-milestone push gate (boot in Docker → drive via chrome-devtools MCP → smoke-test through the UI before push).
