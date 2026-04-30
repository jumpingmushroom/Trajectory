# Edit Equipment — Design

**Date:** 2026-04-30
**Status:** Approved (brainstorm → ready for implementation plan)

## Problem

Once equipment is added, the Setup screen only allows inline-renaming. There is no way to:

- Replace or remove a photo (e.g. retake the cable-row photo with better lighting).
- Change the glyph or tint.
- Fix a wrong equipment type, muscle group, or cardio kind chosen during the Add wizard.
- Edit notes.

The backend is already capable: `equipment.update` mutation in `src/lib/server/mutations.ts` accepts name/type/group/glyph/tint/cardioKind/notes, and `POST /api/equipment/[id]/photo` plus `DELETE /api/equipment/[id]/photo` already handle photo replace/remove. The gap is purely frontend.

While wiring the edit UI we also need to fix three latent bugs that are exposed once equipment becomes mutable:

1. **History display branches on current `equipment.type`** — switching cardio↔strength after sets are logged makes past sets render with the wrong shape ("— kg × —" or "— min").
2. **`cardioKind` invariant unenforced server-side** — `equipmentUpdate` only touches `cardioKind` if it appears in the payload, so a careless type change leaves stale or null values.
3. **Photo URL cache** — `/uploads/equipment/<id>.webp` is the same path forever, so replaced photos don't refresh in the browser.

## Approach

One sheet, two modes. Reuse `AddEquipmentSheet.svelte` for both Add (existing wizard) and Edit (new flat single-screen form) by extracting the three section bodies into snippets and switching layout on a `mode` prop. This avoids a parallel `EditEquipmentSheet.svelte` that would duplicate the photo picker, glyph grid, type chips, group chips, and cardio-kind chips.

Trigger from Setup: tap the glyph/photo tile on an equipment row → open sheet in edit mode. Inline-rename, manage-exercises chevron, and trash button on the row stay unchanged. The glyph tile gains a subtle press state so it reads as tappable.

Saving in edit mode is queue-on-save: photo and field changes are diffed against the initial values and only the dirty parts hit the server. Cancel = no side effects.

Type-change semantics: the UI imposes no locks. Instead, we fix the underlying bug — history rendering becomes shape-driven (read each set's own columns) so a type change never breaks past sets. The server enforces the `cardioKind` ↔ `type` invariant so any client (now or future) cannot create an inconsistent row.

## UI

### Setup row (`src/routes/setup/+page.svelte`)

The glyph tile (`<div class="h-9 w-9 ... rounded-lg border p-1.5">`) becomes a `<button>` with the same visual styling plus a press state. `aria-label="Edit equipment"`. Tapping sets `editingEq = eq` which mounts the sheet.

All other row affordances stay as-is:
- Inline-edit on the name (rapid name-only fix).
- Manage-exercises chevron for free-weight-like equipment.
- Trash icon for soft-delete.

### Edit sheet layout

`AddEquipmentSheet.svelte` is extended:

- New props:
  - `mode: 'add' | 'edit'` (default `'add'`).
  - `equipment?: Equipment` — required when `mode === 'edit'`.
- The bodies of the three current steps become snippets: `{#snippet photoAndGlyphBody()}`, `{#snippet nameAndTypeBody()}`, `{#snippet groupBody()}`.
- Header in edit mode: drops "Step N of 3"; title is **Edit equipment**.
- Body in edit mode: all three snippets stack vertically inside the existing scrollable container, separated by section headers ("Photo & glyph", "Name & type", "Muscle group").
- Footer in edit mode: single **Save** button (replaces Next/Back). Cancel = the existing X in the header.
- Initial state in edit mode is preloaded from `equipment`:
  - `name`, `type`, `group`, `glyph`, `tint`, `cardioKind`, `notes` — direct from the row.
  - `photoPreview` — initialized to the existing photo URL (`/uploads/${equipment.photoPath}?v=${equipment.updatedAt.getTime()}`) when `photoPath` is set, else null.
  - `photoFile` stays null until user picks a new file.
- New transient state:
  - `removePhoto: boolean` — true if the user pressed Remove photo without picking a replacement.
  - `initial` — captured snapshot of the loaded values, used to compute the dirty diff at save.

### Photo controls (edit mode, step 0 section)

The existing **Replace photo** / **Add photo** label-button stays. When a photo is present (existing OR newly picked), an additional **Remove photo** button appears next to it. Behavior:

- Picking a file: clears `removePhoto`, sets `photoFile`, updates `photoPreview` via `URL.createObjectURL`.
- Pressing Remove photo: revokes any `photoPreview` object URL, sets `photoPreview = null`, sets `photoFile = null`, sets `removePhoto = true`.
- If `removePhoto` is true and the user then picks a file, `removePhoto` resets to false (replace wins).

In add mode, the Remove button is hidden (the existing "Clear" button handles unpicking, since no server-side photo exists yet).

## Save flow (edit mode)

1. Compute `diff` against `initial`:
   - For each of `name`, `type`, `group`, `glyph`, `tint`, `cardioKind`, `notes`: include if changed.
   - Apply client-side invariant on the diff (defense-in-depth; server enforces too):
     - If the resulting type (post-diff) is not `'cardio'`, set `cardioKind: null` in the diff.
     - If the resulting type is `'cardio'` and the resulting `cardioKind` would be null, set `cardioKind: 'generic'` in the diff.
2. If `photoFile` is set: `POST /api/equipment/{id}/photo` with `multipart/form-data` (field `photo`). Wait for 200.
3. Else if `removePhoto` is true and `equipment.photoPath != null`: `DELETE /api/equipment/{id}/photo`. Wait for 200.
4. If `Object.keys(diff).length > 0`: `await mutate('equipment.update', { id: equipment.id, ...diff })`.
5. If steps 2–4 all no-op (nothing dirty): close without any network calls.
6. On any error: keep sheet open, surface the message in the existing inline error spot, do not reset form state. User can retry or fix.
7. On success: `await invalidateAll()`, then close the sheet.

Photo upload happens before the JSON mutation deliberately. If the photo upload succeeds and the JSON mutation fails, the photo is updated but other fields aren't — the user retries and the photo POST will overwrite the file again (idempotent for our purposes since the path is `<id>.webp`). If we did the JSON first and the photo upload failed, the user would see fields updated but their photo replacement lost without an obvious reason.

## Display fix (shape-driven set rendering)

The bug: `src/routes/sessions/[id]/+page.svelte` and `src/routes/equipment/[id]/+page.svelte` decide cardio-vs-strength rendering from `equipment.type`. After any cardio↔strength type change, history rows get re-interpreted under the new type and their data displays as `null`.

The fix: render each `set` row based on its own columns.

A set is **cardio-shaped** when `set.durationMin != null`. A set is **strength-shaped** when `set.weight != null`. The shapes are mutually exclusive at insert time (set.create branches on `eqRow.type` to populate one column or the other and leaves the other null).

### `src/routes/sessions/[id]/+page.svelte` (around line 184)

Replace `{#if block.equipment.type === 'cardio'}` with `{#if set.durationMin != null}`. The two render branches keep working with each individual set's data. The block-level header (which still shows `block.equipment.type · cardioKind`) reflects the equipment's current type — that's fine for the header, but per-set rows must respect their own shape.

### `src/routes/equipment/[id]/+page.svelte` and `+page.server.ts`

The "top set" computation in the `+page.server.ts` (line 98 of `routes/log/[id]/+page.server.ts` for the related `recencyByWeight` / sparkline) uses `eqRow.type === 'cardio' ? durationMin : weight`. This is fine for **prefill** purposes (it's about what the next set will look like, which uses current type). But the equipment detail's headline metric and any past-set listing should be shape-driven so historical data displays correctly. Apply the same `set.durationMin != null` switch in the rendering.

The principle: anything that summarizes history reads each set's columns. Anything that prepares the *next* logging interaction reads `equipment.type`.

### Cardio summary helpers

`cardioSummary(set.extras)` and `fmtNum(set.durationMin)` already work per-set. No change needed there.

## Server invariants (`src/lib/server/mutations.ts`, `equipmentUpdate`)

After computing `updates`, before the `db.update(equipment).set(updates)` call, apply:

```ts
const finalType = updates.type ?? existingRow.type;
if (finalType === 'cardio') {
  // If we're transitioning to cardio (or already cardio) and cardioKind would
  // end up null, default to 'generic' rather than letting the row drift into
  // an inconsistent state.
  const finalCardioKind = updates.cardioKind !== undefined
    ? updates.cardioKind
    : existingRow.cardioKind;
  if (finalCardioKind == null) updates.cardioKind = 'generic';
} else {
  // Non-cardio types must not have a cardioKind. Clear it regardless of payload.
  updates.cardioKind = null;
}
```

This requires fetching `existingRow` before computing `updates` (or selecting type+cardioKind early). Add the select up-front; reuse it for the existing post-update select if convenient.

The `equipmentUpdate` function then naturally returns the row with the corrected `cardioKind`. The validator at line 301 (`if (Object.keys(updates).length === 1) badRequest(...)`) needs to be aware that the invariant might add a field — the rule should be "at least one *user-meaningful* field". Simplest: track a boolean `hasUserField` set when any of name/type/group/glyph/tint/cardioKind/sortOrder/notes is provided in the payload, and bad-request only when that's false.

## Photo cache-bust

Three call sites compute `photoSrc`:
- `src/routes/log/[id]/+page.svelte:19`
- `src/routes/equipment/[id]/+page.svelte:13`
- `src/lib/components/EquipmentTile.svelte:29`

Replace each `eq.photoPath ? \`/uploads/${eq.photoPath}\` : null` with `eq.photoPath ? \`/uploads/${eq.photoPath}?v=${eq.updatedAt.getTime()}\` : null`.

`equipment.updatedAt` is a Drizzle `timestamp_ms` with `$onUpdate(() => new Date())`, and the photo POST/DELETE handlers explicitly set `updatedAt: new Date()` on the row. So the query string changes whenever the photo changes, defeating the browser cache without disabling caching for users who haven't changed anything.

The edit sheet's preloaded `photoPreview` URL also uses this pattern.

## Files touched

| File | Change |
|------|--------|
| `src/lib/components/AddEquipmentSheet.svelte` | Add `mode`/`equipment` props; refactor 3 step bodies into snippets; edit-mode flat layout; preload state; save-with-diff; Remove photo button. |
| `src/routes/setup/+page.svelte` | Glyph tile becomes a button; add `editingEq` state; mount sheet in edit mode. |
| `src/lib/server/mutations.ts` | `cardioKind` invariant in `equipmentUpdate`; tweak the "at least one field" guard. |
| `src/routes/sessions/[id]/+page.svelte` | Render each set by `set.durationMin != null`, not by `equipment.type`. |
| `src/routes/equipment/[id]/+page.svelte` | Same shape-driven rendering for the per-set list / headline metric. |
| `src/routes/log/[id]/+page.svelte` | Photo cache-bust query param. |
| `src/lib/components/EquipmentTile.svelte` | Photo cache-bust query param. |

## Verification (per-milestone push gate)

Before push:

1. `docker compose up` clean. Tail logs. No errors, no missing-env warnings, migrations clean.
2. Connect via chrome-devtools MCP. Run through:
   - Add a new equipment with photo. Confirm it shows on the Setup row and in the home tile grid.
   - Tap the glyph tile on the row. Edit sheet opens preloaded with current values.
   - Replace the photo with a different image. Save. Refresh. New photo displays in setup, log screen, equipment detail (cache-bust working).
   - Open edit sheet again. Press Remove photo. Save. Photo is gone everywhere; glyph fallback shows.
   - Edit name, type, group, glyph, tint, notes (one at a time, save each, verify each).
   - Open a Cardio equipment with at least one logged set. Change type to a strength type. Save. Open Sessions detail for the session that contains those cardio sets. Confirm they still render as `N min · …` (shape-driven), not as `— kg × —`.
   - Reverse: a strength equipment with logged sets, change to cardio. Confirm strength sets still render `kg × reps` in history.
   - Open edit sheet, Save with no changes. No network calls (verify in DevTools network panel). Sheet closes silently.
   - Force a server error (e.g. send invalid payload via DevTools). Sheet stays open with inline error; retry works.
3. Run `pnpm check` and `pnpm test` if either exists; fix any regressions.
4. Smoke-test one edge case: edit equipment that has zero logged sets (free-weight → machine). Confirm hidden exercise still resolves and you can log a new set against it.

## Out of scope (FUTURE.md candidates)

- Moving equipment between gyms.
- Bulk edit (multi-select).
- Photo crop / rotate / brightness UI.
- Edit history / undo.
- Optimistic concurrency (last-write-wins is acceptable for two users).
