# Edit equipment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add equipment editing (photo, glyph, tint, name, type, group, cardio kind, notes) via a re-purposed `AddEquipmentSheet` opened from the Setup screen, plus three coupled fixes the feature exposes: shape-driven set rendering in history, a server-side `cardioKind` invariant in `equipmentUpdate`, and a photo URL cache-bust query parameter.

**Architecture:** One sheet, two modes. `AddEquipmentSheet.svelte` gets a `mode: 'add' | 'edit'` prop and an optional `equipment` prop. The three step bodies become snippets; add mode wraps them in the existing wizard, edit mode stacks them on a single scrollable form with one Save button. Save flow in edit mode diffs against initial values and only fires the network calls that are needed (photo POST/DELETE and/or `equipment.update` mutation).

The Setup row's glyph tile becomes a button that opens the sheet in edit mode. Inline-rename, manage-exercises, and trash on the row stay unchanged.

History rendering in `sessions/[id]/+page.svelte` and the "last set" strip in `equipment/[id]/+page.svelte` switch from `equipment.type === 'cardio'` to `set.durationMin != null` so past sets keep displaying correctly across type changes. The server enforces the `cardioKind` ↔ `type` invariant so any client cannot persist an inconsistent row. Photo URLs gain a `?v={updatedAt}` cache-buster.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) + TypeScript + Drizzle ORM + better-sqlite3. No new deps. The sheet refactor uses Svelte 5 `{#snippet}` blocks. Verification follows the project's per-milestone push gate (Docker boot → chrome-devtools MCP smoke-test → only then commit + push).

**Test framework note:** Trajectory has no component-test framework — its only automated test is `tests/smoke.mjs` (server contract). This plan is therefore not TDD-with-unit-tests at the component level. Server-side changes (the `cardioKind` invariant) get a smoke-test addition. Component changes get a focused browser smoke-test step at the end of each task plus a single comprehensive verification task before push.

**Spec:** `docs/superpowers/specs/2026-04-30-edit-equipment-design.md`

---

## File map

- **Modify:** `src/lib/components/AddEquipmentSheet.svelte` — add `mode`/`equipment` props; refactor 3 step bodies into snippets; edit-mode flat layout; preload state; save-with-diff; Remove photo button.
- **Modify:** `src/routes/setup/+page.svelte` — glyph tile becomes a button; add `editingEq` state; mount the sheet in edit mode.
- **Modify:** `src/lib/server/mutations.ts` — `cardioKind` ↔ `type` invariant in `equipmentUpdate`; the "at least one user field" guard.
- **Modify:** `src/routes/sessions/[id]/+page.svelte` — render each set by `set.durationMin != null` instead of `equipment.type`.
- **Modify:** `src/routes/equipment/[id]/+page.svelte` — `fmtLast()` and the headline strip switch on `lastDurationMin != null` rather than `isCardio`.
- **Modify:** `src/routes/log/[id]/+page.svelte` — photo `?v={updatedAt}` cache-bust.
- **Modify:** `src/routes/equipment/[id]/+page.svelte` — photo cache-bust (already in the list above for the rendering change, same file, same task).
- **Modify:** `src/lib/components/EquipmentTile.svelte` — photo cache-bust.
- **Modify:** `tests/smoke.mjs` — add a server-contract test for the `cardioKind` invariant.

No new files, no DB schema changes, no new components.

---

### Task 1: Create the feature branch

**Files:** none — git operation.

- [ ] **Step 1: Create branch off `main`**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/edit-equipment
```

Expected: `Switched to a new branch 'feat/edit-equipment'`

---

### Task 2: Server invariant — `cardioKind` ↔ `type` in `equipmentUpdate`

**Files:**
- Modify: `src/lib/server/mutations.ts:275-320`

This task is independent of all the UI work and can ship first. The mutation currently lets a payload like `{ type: 'cardio' }` (without `cardioKind`) leave `cardioKind` as whatever it was, and `{ type: 'machine' }` doesn't clear a stale `cardioKind`. We fix both directions and tweak the "at least one field" guard so the invariant-only paths (e.g. nothing changed except the implicit `cardioKind` clear) don't accidentally satisfy it.

- [ ] **Step 1: Read the current `equipmentUpdate` function**

```bash
sed -n '275,320p' src/lib/server/mutations.ts
```

Confirm the function shape matches the spec (validator at line 301 reads `Object.keys(updates).length === 1`).

- [ ] **Step 2: Replace `equipmentUpdate` with the invariant-aware version**

In `src/lib/server/mutations.ts`, replace the entire `async function equipmentUpdate(...)` body with:

```ts
async function equipmentUpdate(payload: EquipmentUpdate): Promise<Equipment> {
	assertUlid(payload.id, 'id');

	const existing = (
		await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1)
	)[0];
	if (!existing) notFound(`equipment ${payload.id} not found`);

	const updates: Partial<Equipment> = { updatedAt: new Date() };
	let hasUserField = false;

	if (payload.name !== undefined) {
		updates.name = assertString(payload.name, 'name', 80);
		hasUserField = true;
	}
	if (payload.type !== undefined) {
		updates.type = assertEnum(payload.type, 'type', EQUIPMENT_TYPES);
		hasUserField = true;
	}
	if (payload.group !== undefined) {
		updates.group = assertEnum(payload.group, 'group', MUSCLE_GROUPS);
		hasUserField = true;
	}
	if (payload.glyph !== undefined) {
		updates.glyph = assertString(payload.glyph, 'glyph', 20);
		hasUserField = true;
	}
	if (payload.tint !== undefined) {
		updates.tint = assertHex(payload.tint, 'tint');
		hasUserField = true;
	}
	if (payload.cardioKind !== undefined) {
		updates.cardioKind =
			payload.cardioKind == null
				? null
				: assertEnum(payload.cardioKind, 'cardioKind', CARDIO_KINDS);
		hasUserField = true;
	}
	if (typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)) {
		updates.sortOrder = payload.sortOrder;
		hasUserField = true;
	}
	if (payload.notes !== undefined) {
		updates.notes =
			payload.notes == null
				? null
				: typeof payload.notes === 'string'
					? payload.notes.slice(0, 4000)
					: badRequest('notes must be a string or null');
		hasUserField = true;
	}

	if (!hasUserField) badRequest('equipment.update needs at least one field');

	// Invariant: cardioKind is non-null iff type === 'cardio'. Compute the
	// post-update type and reconcile cardioKind regardless of whether the
	// caller sent it. This protects every client (current UI, future UIs,
	// hand-crafted curl) from creating an inconsistent row.
	const finalType = updates.type ?? existing.type;
	if (finalType === 'cardio') {
		const finalCardioKind =
			updates.cardioKind !== undefined ? updates.cardioKind : existing.cardioKind;
		if (finalCardioKind == null) updates.cardioKind = 'generic';
	} else {
		// Non-cardio types must not carry a cardioKind. Force-clear it.
		if (existing.cardioKind != null || updates.cardioKind != null) {
			updates.cardioKind = null;
		}
	}

	await db.update(equipment).set(updates).where(eq(equipment.id, payload.id));

	// If the equipment got renamed and it has an auto-hidden exercise, sync
	// the exercise name so logging UI labels stay consistent.
	if (updates.name !== undefined) {
		const hiddenId = derivedExerciseId(payload.id);
		await db
			.update(exercise)
			.set({ name: updates.name, updatedAt: new Date() })
			.where(and(eq(exercise.id, hiddenId), eq(exercise.isHidden, true)));
	}

	const row = (
		await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`equipment ${payload.id} not found`);
	return row;
}
```

Note that we now fetch `existing` up-front (single query) instead of relying on the post-update select alone. The post-update select stays so the returned row reflects all changes including the invariant clears.

- [ ] **Step 3: Run typecheck**

```bash
pnpm check
```

Expected: 0 errors. (If the project lacks a `check` script, run `pnpm exec svelte-check` or `pnpm exec tsc --noEmit` — whichever the project uses; check `package.json` scripts.)

- [ ] **Step 4: Add a smoke-test for the invariant**

Append to `tests/smoke.mjs` (find the last `test(` block, add a new one after it). The exact harness shape depends on how `tests/smoke.mjs` is structured — read it first:

```bash
sed -n '1,40p' tests/smoke.mjs
grep -n "equipment.create\|equipment.update" tests/smoke.mjs
```

Add a test that:

1. Creates an equipment with `type: 'cardio'`, `cardioKind: 'treadmill'`.
2. Calls `equipment.update` with `{ id, type: 'machine' }` (no `cardioKind` in the payload).
3. Reads the row back. Asserts `type === 'machine'` AND `cardioKind === null`.
4. Calls `equipment.update` with `{ id, type: 'cardio' }` (no `cardioKind`).
5. Reads back. Asserts `type === 'cardio'` AND `cardioKind === 'generic'` (the default).

If the existing tests follow a pattern like `test('foo', async () => { ... })` with helpers like `mutate(op, payload)` and `getEquipment(id)`, mirror that style. Otherwise raw fetch against `/api/mutate` is fine; the request envelope is `{ clientId, mutationId, op, payload }`.

- [ ] **Step 5: Run the smoke tests**

```bash
docker compose up -d
pnpm test
```

Expected: all tests pass, including the new invariant test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/mutations.ts tests/smoke.mjs
git commit -m "fix(mutations): enforce cardioKind ↔ type invariant on equipment.update"
```

---

### Task 3: Photo URL cache-bust (`?v={updatedAt}`)

**Files:**
- Modify: `src/routes/log/[id]/+page.svelte:19`
- Modify: `src/routes/equipment/[id]/+page.svelte:13`
- Modify: `src/lib/components/EquipmentTile.svelte:28-30`

This task is independent of the rest. It's a 3-line change that fixes a latent bug (replaced photos won't refresh) before the edit feature exposes it.

- [ ] **Step 1: Update `src/routes/log/[id]/+page.svelte` line 19**

Find:
```ts
const photoSrc = $derived(eq.photoPath ? `/uploads/${eq.photoPath}` : null);
```

Replace with:
```ts
const photoSrc = $derived(
    eq.photoPath ? `/uploads/${eq.photoPath}?v=${eq.updatedAt.getTime()}` : null
);
```

- [ ] **Step 2: Update `src/routes/equipment/[id]/+page.svelte` line 13**

Find:
```ts
const photoSrc = $derived(eq.photoPath ? `/uploads/${eq.photoPath}` : null);
```

Replace with:
```ts
const photoSrc = $derived(
    eq.photoPath ? `/uploads/${eq.photoPath}?v=${eq.updatedAt.getTime()}` : null
);
```

- [ ] **Step 3: Update `src/lib/components/EquipmentTile.svelte` lines 28-30**

Find:
```ts
const photoSrc = $derived(
    equipment.photoPath ? `/uploads/${equipment.photoPath}` : null
);
```

Replace with:
```ts
const photoSrc = $derived(
    equipment.photoPath
        ? `/uploads/${equipment.photoPath}?v=${equipment.updatedAt.getTime()}`
        : null
);
```

- [ ] **Step 4: Typecheck**

```bash
pnpm check
```

Expected: 0 errors. The `Equipment` type already includes `updatedAt: Date`.

- [ ] **Step 5: Browser smoke**

```bash
docker compose up -d
```

Open `http://localhost:5173`, log in, navigate to a piece of equipment that has a photo. Confirm the photo still loads on Home, the equipment detail, and the log screen. View-source and confirm the `<img src>` URL now includes `?v=<number>`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/log/[id]/+page.svelte src/routes/equipment/[id]/+page.svelte src/lib/components/EquipmentTile.svelte
git commit -m "fix(equipment): cache-bust photo URLs with ?v=updatedAt"
```

---

### Task 4: Shape-driven set rendering in `sessions/[id]`

**Files:**
- Modify: `src/routes/sessions/[id]/+page.svelte` (around line 184)

The session-detail page renders each set inside an equipment block. Currently `{#if block.equipment.type === 'cardio'}` decides cardio-vs-strength shape. After type change, past sets render under the wrong shape. Fix: read each set's own columns.

- [ ] **Step 1: Read the current rendering block**

```bash
sed -n '170,215p' src/routes/sessions/[id]/+page.svelte
```

Confirm the structure: a `<ul>` over `block.sets`, each `<li>` branching on `block.equipment.type === 'cardio'`.

- [ ] **Step 2: Replace the per-set conditional**

In `src/routes/sessions/[id]/+page.svelte`, find:

```svelte
{#if block.equipment.type === 'cardio'}
    <div class="flex flex-1 items-baseline gap-2 text-[13px]" style="color: var(--color-text);">
        <span class="font-semibold">{fmtNum(set.durationMin)}</span>
        <span class="text-[10px]" style="color: var(--color-text-dim-2);">min</span>
        {#each cardioSummary(set.extras) as bit, k (k)}
            <span style="color: var(--color-text-dim-2);">·</span>
            <span style="color: var(--color-text-dim);">{bit}</span>
        {/each}
    </div>
{:else}
```

Replace `block.equipment.type === 'cardio'` with `set.durationMin != null`. The two branch bodies stay identical:

```svelte
{#if set.durationMin != null}
    <div class="flex flex-1 items-baseline gap-2 text-[13px]" style="color: var(--color-text);">
        <span class="font-semibold">{fmtNum(set.durationMin)}</span>
        <span class="text-[10px]" style="color: var(--color-text-dim-2);">min</span>
        {#each cardioSummary(set.extras) as bit, k (k)}
            <span style="color: var(--color-text-dim-2);">·</span>
            <span style="color: var(--color-text-dim);">{bit}</span>
        {/each}
    </div>
{:else}
```

The block-level header above this still shows `block.equipment.type · cardioKind` (the equipment's *current* identity). That's correct and stays as-is.

- [ ] **Step 3: Typecheck**

```bash
pnpm check
```

Expected: 0 errors. The `set` type already exposes `durationMin: number | null`.

- [ ] **Step 4: Browser smoke**

Open a session-detail page that contains both strength and cardio sets logged under their original equipment types. Confirm rendering looks identical to before (this change is a no-op when `equipment.type` agrees with each set's shape, which is the only state currently reachable).

- [ ] **Step 5: Commit**

```bash
git add src/routes/sessions/[id]/+page.svelte
git commit -m "fix(sessions): render each set by its own shape, not equipment type"
```

---

### Task 5: Shape-driven "last set" strip in `equipment/[id]`

**Files:**
- Modify: `src/routes/equipment/[id]/+page.svelte:51-68`

The `fmtLast()` helper in `src/routes/equipment/[id]/+page.svelte` decides display shape from `isCardio = eq.type === 'cardio'`. The "last set" line is history — it should show what was actually logged for the last set, regardless of any subsequent type change. The `metaTiles` derivation (line 70+) intentionally stays current-type-driven because it summarizes "what is this equipment now."

- [ ] **Step 1: Replace `fmtLast()`**

In `src/routes/equipment/[id]/+page.svelte`, find the function (around lines 51-68):

```ts
function fmtLast(): string {
    if (data.daysSinceLast == null) return 'Never logged';
    const ago =
        data.daysSinceLast === 0
            ? 'today'
            : data.daysSinceLast === 1
                ? '1 day ago'
                : `${data.daysSinceLast} days ago`;
    if (isCardio) {
        return data.lastDurationMin != null
            ? `${fmtNum(data.lastDurationMin)} min · ${ago}`
            : ago;
    }
    if (data.lastWeight != null && data.lastReps != null) {
        return `${fmtNum(data.lastWeight)} kg × ${data.lastReps} · ${ago}`;
    }
    return ago;
}
```

Replace with:

```ts
function fmtLast(): string {
    if (data.daysSinceLast == null) return 'Never logged';
    const ago =
        data.daysSinceLast === 0
            ? 'today'
            : data.daysSinceLast === 1
                ? '1 day ago'
                : `${data.daysSinceLast} days ago`;
    // Read the last set's own shape rather than the equipment's current
    // type. After a cardio↔strength type change, the last set might still
    // have been cardio (or strength) and should display as it was logged.
    if (data.lastDurationMin != null) {
        return `${fmtNum(data.lastDurationMin)} min · ${ago}`;
    }
    if (data.lastWeight != null && data.lastReps != null) {
        return `${fmtNum(data.lastWeight)} kg × ${data.lastReps} · ${ago}`;
    }
    return ago;
}
```

The `metaTiles` derivation directly below stays unchanged — it's a current-state summary, not history.

- [ ] **Step 2: Typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 3: Browser smoke**

Open the equipment detail page for a piece of equipment that has logged sets. Confirm the "last set" line still shows correctly (this is a no-op for currently-reachable state).

- [ ] **Step 4: Commit**

```bash
git add src/routes/equipment/[id]/+page.svelte
git commit -m "fix(equipment-detail): last-set strip reads set shape, not equipment type"
```

---

### Task 6: Refactor `AddEquipmentSheet` step bodies into snippets (no behavior change)

**Files:**
- Modify: `src/lib/components/AddEquipmentSheet.svelte` (template section, roughly lines 184-432)

Before introducing the `mode` prop, extract the three step bodies into Svelte 5 snippets so both modes can compose the same content. This task is a pure refactor — the on-screen output and behavior must be identical when verified in the browser.

- [ ] **Step 1: Read the current template structure**

```bash
sed -n '180,435p' src/lib/components/AddEquipmentSheet.svelte
```

Confirm the template has three branches: `{#if step === 0}` (photo & glyph), `{:else if step === 1}` (name & type, plus cardio kind), `{:else}` (group). Footer with Back/Next at the bottom.

- [ ] **Step 2: Extract step 0 body into a snippet**

Above the outer `<div class="fixed inset-0 ...">` (i.e. just after the closing `</script>` tag, but inside the file's top-level), declare:

```svelte
{#snippet photoAndGlyphSection()}
    <div class="flex flex-col gap-3">
        <!-- everything currently inside {#if step === 0} ... before {:else if step === 1} -->
    </div>
{/snippet}
```

Move the entire content of the step-0 branch (the outer `<div class="flex flex-col gap-3">` and its children, lines roughly 184-325) into this snippet. Then in the template branch where `step === 0`, replace the moved content with a single `{@render photoAndGlyphSection()}`.

- [ ] **Step 3: Extract step 1 body into a snippet**

Same pattern:

```svelte
{#snippet nameAndTypeSection()}
    <div class="flex flex-col gap-4">
        <!-- everything from inside {:else if step === 1} -->
    </div>
{/snippet}
```

Replace the step-1 branch body with `{@render nameAndTypeSection()}`.

- [ ] **Step 4: Extract step 2 body into a snippet**

```svelte
{#snippet groupSection()}
    <div class="flex flex-col gap-3">
        <!-- everything from the {:else} branch -->
    </div>
{/snippet}
```

Replace the step-2 branch body with `{@render groupSection()}`.

- [ ] **Step 5: Typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 6: Browser smoke**

Open Setup, click "Add equipment" on a gym, walk through all three steps with a photo, a glyph search and selection, name input, type chips (try cardio to see cardio-kind chips appear), and group selection. Submit. Confirm equipment is added correctly. Behavior must be identical to pre-refactor.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AddEquipmentSheet.svelte
git commit -m "refactor(AddEquipmentSheet): extract step bodies into snippets"
```

---

### Task 7: Add `mode`/`equipment` props and edit-mode flat layout

**Files:**
- Modify: `src/lib/components/AddEquipmentSheet.svelte`

Introduce the `mode` prop, switch the template to render either the wizard (add) or the flat form (edit), and preload state from the `equipment` prop. The save flow itself is intentionally NOT yet wired to the server — Save in edit mode does nothing in this task. We add the network calls in Task 8.

- [ ] **Step 1: Update the props block**

Find (near top of `<script>`):

```ts
let {
    gymId,
    onClose
}: { gymId: string; onClose: () => void } = $props();
```

Replace with:

```ts
import type { Equipment } from '$lib/server/db/schema';

type Mode = 'add' | 'edit';

let {
    mode = 'add',
    gymId,
    equipment: editTarget,
    onClose
}: {
    mode?: Mode;
    // gymId is required in add mode, optional/ignored in edit mode.
    gymId?: string;
    // equipment is required in edit mode, ignored in add mode.
    equipment?: Equipment;
    onClose: () => void;
} = $props();

if (mode === 'add' && !gymId) {
    throw new Error('AddEquipmentSheet: gymId is required in add mode');
}
if (mode === 'edit' && !editTarget) {
    throw new Error('AddEquipmentSheet: equipment is required in edit mode');
}
```

- [ ] **Step 2: Replace the field-level `$state` initializers with mode-aware values**

Find the existing block (around lines 21-31):

```ts
let step = $state(0);
let glyph = $state<GlyphKind>('bench');
let name = $state('');
let type = $state<EquipmentType>('machine');
let cardioKind = $state<CardioKind>('treadmill');
let group = $state<MuscleGroup>('push');
let photoFile = $state<File | null>(null);
let photoPreview = $state<string | null>(null);
let submitting = $state(false);
let error = $state<string | null>(null);
let glyphSearch = $state('');
```

Replace with:

```ts
const initialPhotoSrc =
    mode === 'edit' && editTarget?.photoPath
        ? `/uploads/${editTarget.photoPath}?v=${editTarget.updatedAt.getTime()}`
        : null;

let step = $state(0);
let glyph = $state<GlyphKind>(
    mode === 'edit' ? ((editTarget!.glyph as GlyphKind) ?? 'bench') : 'bench'
);
let name = $state(mode === 'edit' ? editTarget!.name : '');
let type = $state<EquipmentType>(
    mode === 'edit' ? (editTarget!.type as EquipmentType) : 'machine'
);
let cardioKind = $state<CardioKind>(
    mode === 'edit'
        ? ((editTarget!.cardioKind as CardioKind | null) ?? 'treadmill')
        : 'treadmill'
);
let group = $state<MuscleGroup>(
    mode === 'edit' ? (editTarget!.group as MuscleGroup) : 'push'
);
let notes = $state<string>(mode === 'edit' ? (editTarget!.notes ?? '') : '');
let photoFile = $state<File | null>(null);
let photoPreview = $state<string | null>(initialPhotoSrc);
let removePhoto = $state(false);
let submitting = $state(false);
let error = $state<string | null>(null);
let glyphSearch = $state('');

// Captured snapshot for diff at save time. Only meaningful in edit mode.
const initial = {
    name: mode === 'edit' ? editTarget!.name : '',
    type: mode === 'edit' ? (editTarget!.type as EquipmentType) : 'machine',
    group: mode === 'edit' ? (editTarget!.group as MuscleGroup) : 'push',
    glyph: mode === 'edit' ? ((editTarget!.glyph as GlyphKind) ?? 'bench') : 'bench',
    tint: mode === 'edit' ? editTarget!.tint : '#1c2026',
    cardioKind:
        mode === 'edit' ? (editTarget!.cardioKind as CardioKind | null) : null,
    notes: mode === 'edit' ? (editTarget!.notes ?? '') : '',
    photoPath: mode === 'edit' ? editTarget!.photoPath : null
};
```

Note we capture `initial` for the diff. We also seed `photoPreview` from the existing photo URL so the user sees their current photo when opening the sheet.

- [ ] **Step 3: Update the existing `clearPhoto()` function**

`clearPhoto()` is the add-mode "I changed my mind, drop the file I just picked" affordance. Update it so it also clears `removePhoto` (a brand-new pick should obviously not be in remove-state):

Find:
```ts
function clearPhoto() {
    photoFile = null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = null;
}
```

Replace with:
```ts
function clearPhoto() {
    photoFile = null;
    if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
    }
    photoPreview = null;
    removePhoto = false;
}
```

The `startsWith('blob:')` guard prevents revoking the `/uploads/...` URL that edit mode seeded.

- [ ] **Step 4: Update `pickPhoto()` to clear `removePhoto`**

Find:
```ts
function pickPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    photoFile = file;
    photoPreview = file ? URL.createObjectURL(file) : null;
}
```

Replace with:
```ts
function pickPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
    }
    photoFile = file;
    photoPreview = file ? URL.createObjectURL(file) : null;
    if (file) removePhoto = false;
}
```

- [ ] **Step 5: Add the `handleRemovePhoto()` function**

Add right after `pickPhoto()`:

```ts
function handleRemovePhoto() {
    if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
    }
    photoFile = null;
    photoPreview = null;
    // Only meaningful in edit mode; in add mode this just acts like clearPhoto.
    if (mode === 'edit' && initial.photoPath) {
        removePhoto = true;
    }
}
```

- [ ] **Step 6: Add a `handleEditSave()` stub (network calls land in Task 8)**

Right above the existing `function next()`:

```ts
async function handleEditSave() {
    // Wired up in Task 8. For now, just close so the button is non-broken.
    onClose();
}
```

- [ ] **Step 7: Update the template header for edit mode**

Find the header block (around lines 156-182) that shows "Step N of 3" and the title. Replace the inner content of the left column with a mode-aware version:

```svelte
<div class="flex flex-1 flex-col">
    {#if mode === 'add'}
        <div
            class="text-[10px] font-bold uppercase tracking-[0.14em]"
            style="color: var(--color-text-dim-2);"
        >
            Step {step + 1} of 3
        </div>
        <div
            class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
            style="color: var(--color-text);"
        >
            {step === 0 ? 'Photo & glyph' : step === 1 ? 'Name & type' : 'Muscle group'}
        </div>
    {:else}
        <div
            class="text-[10px] font-bold uppercase tracking-[0.14em]"
            style="color: var(--color-text-dim-2);"
        >
            Edit
        </div>
        <div
            class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
            style="color: var(--color-text);"
        >
            {editTarget!.name}
        </div>
    {/if}
</div>
```

- [ ] **Step 8: Replace the step-branched body with mode-aware rendering**

Find the block:

```svelte
{#if step === 0}
    {@render photoAndGlyphSection()}
{:else if step === 1}
    {@render nameAndTypeSection()}
{:else}
    {@render groupSection()}
{/if}
```

(After Task 6 the bodies should be condensed to these three render calls.)

Replace with:

```svelte
{#if mode === 'add'}
    {#if step === 0}
        {@render photoAndGlyphSection()}
    {:else if step === 1}
        {@render nameAndTypeSection()}
    {:else}
        {@render groupSection()}
    {/if}
{:else}
    <div class="flex flex-col gap-6">
        <section class="flex flex-col gap-2">
            <div
                class="text-[10px] font-bold uppercase tracking-[0.14em]"
                style="color: var(--color-text-dim-2);"
            >
                Photo & glyph
            </div>
            {@render photoAndGlyphSection()}
        </section>
        <section class="flex flex-col gap-2">
            <div
                class="text-[10px] font-bold uppercase tracking-[0.14em]"
                style="color: var(--color-text-dim-2);"
            >
                Name & type
            </div>
            {@render nameAndTypeSection()}
        </section>
        <section class="flex flex-col gap-2">
            <div
                class="text-[10px] font-bold uppercase tracking-[0.14em]"
                style="color: var(--color-text-dim-2);"
            >
                Muscle group
            </div>
            {@render groupSection()}
        </section>
        <section class="flex flex-col gap-2">
            <div
                class="text-[10px] font-bold uppercase tracking-[0.14em]"
                style="color: var(--color-text-dim-2);"
            >
                Notes
            </div>
            <textarea
                bind:value={notes}
                rows="3"
                placeholder="e.g. seat height 4, arms wide for chest"
                maxlength="4000"
                class="rounded-lg border px-3 py-2 text-[14px] outline-none"
                style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text); resize: vertical;"
            ></textarea>
        </section>
    </div>
{/if}
```

- [ ] **Step 9: Replace the footer Back/Next buttons with mode-aware buttons**

Find the footer block (around lines 443-464):

```svelte
<div class="flex gap-2 pt-1">
    {#if step > 0}
        <button ... onclick={back} ...>Back</button>
    {/if}
    <button ... onclick={next} ...>
        {submitting ? 'Saving…' : step === 2 ? 'Add to gym' : 'Continue'}
    </button>
</div>
```

Replace with:

```svelte
<div class="flex gap-2 pt-1">
    {#if mode === 'add'}
        {#if step > 0}
            <button
                type="button"
                class="flex-1 rounded-full border py-3 text-[14px] font-semibold"
                style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
                onclick={back}
                disabled={submitting}
            >
                Back
            </button>
        {/if}
        <button
            type="button"
            class="flex-[2] rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
            style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
            onclick={next}
            disabled={submitting}
        >
            {submitting ? 'Saving…' : step === 2 ? 'Add to gym' : 'Continue'}
        </button>
    {:else}
        <button
            type="button"
            class="w-full rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
            style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
            onclick={handleEditSave}
            disabled={submitting}
        >
            {submitting ? 'Saving…' : 'Save'}
        </button>
    {/if}
</div>
```

- [ ] **Step 10: Add a `Remove photo` button inside `photoAndGlyphSection`**

In the `photoAndGlyphSection` snippet, find the `<div class="flex gap-2">` row that contains the `Add photo` / `Replace photo` label-button and the existing `Clear` button. Add a third button (Remove) that appears only when there is a server-side photo OR a newly picked one:

Find:
```svelte
<div class="flex gap-2">
    <label
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border py-3 text-[13px] font-semibold"
        style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
    >
        <input type="file" accept="image/*" class="hidden" onchange={pickPhoto} />
        {photoFile ? 'Replace photo' : 'Add photo'}
    </label>
    {#if photoFile}
        <button
            type="button"
            class="rounded-full border px-4 py-3 text-[13px] font-semibold"
            style="background: transparent; border-color: var(--color-line-2); color: var(--color-text-dim);"
            onclick={clearPhoto}
        >
            Clear
        </button>
    {/if}
</div>
```

Replace with:
```svelte
<div class="flex gap-2">
    <label
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border py-3 text-[13px] font-semibold"
        style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
    >
        <input type="file" accept="image/*" class="hidden" onchange={pickPhoto} />
        {photoFile || photoPreview ? 'Replace photo' : 'Add photo'}
    </label>
    {#if photoFile}
        <button
            type="button"
            class="rounded-full border px-4 py-3 text-[13px] font-semibold"
            style="background: transparent; border-color: var(--color-line-2); color: var(--color-text-dim);"
            onclick={clearPhoto}
        >
            Clear
        </button>
    {:else if mode === 'edit' && photoPreview}
        <button
            type="button"
            class="rounded-full border px-4 py-3 text-[13px] font-semibold"
            style="background: transparent; border-color: var(--color-line-2); color: var(--color-text-dim);"
            onclick={handleRemovePhoto}
        >
            Remove
        </button>
    {/if}
</div>
```

The label now reads "Replace photo" if there's any preview (uploaded or seed). The Remove button only appears in edit mode when there's a current preview that came from the server (`photoFile` is null but `photoPreview` is non-null → it's the seed URL).

- [ ] **Step 11: Typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 12: Browser smoke (add mode)**

Open Setup, click "Add equipment". Walk through all 3 steps and submit. Behavior must be identical to before Task 7.

- [ ] **Step 13: Browser smoke (edit mode, no save yet)**

Edit mode is wired only in Task 9. To verify the layout in this task, temporarily wire a test mount: in the browser DevTools, instantiate the sheet manually, OR add a transient `?edit=<eqId>` query check in `setup/+page.svelte` (revert before commit). Confirm:

- Title shows "Edit · {name}" header.
- All three sections stack on one screen.
- Photo preview is the existing photo (with cache-bust URL).
- Glyph picker shows the current glyph as selected.
- Name field is preloaded.
- Type chip is the current type.
- Group chip is the current group.
- Cardio kind chip is the current cardio kind (only visible if type is cardio).
- "Replace photo" / "Remove" buttons appear correctly.
- "Save" button at the bottom (no Back).

Revert any transient test code before commit.

- [ ] **Step 14: Commit**

```bash
git add src/lib/components/AddEquipmentSheet.svelte
git commit -m "feat(EquipmentSheet): mode prop, edit-mode flat layout, preload state"
```

---

### Task 8: Wire `handleEditSave()` to actually save

**Files:**
- Modify: `src/lib/components/AddEquipmentSheet.svelte`

Now that the form is preloaded and the user can edit, hook the Save button up to the network. Save flow per spec:

1. Compute diff vs `initial`.
2. Photo file picked → POST.
3. Else if `removePhoto` → DELETE.
4. Diff has fields → `mutate('equipment.update', ...)`.
5. Nothing dirty → close silently.
6. Error → keep sheet open with inline error.
7. Success → close (mutate's drain triggers `invalidateAll()`; for the photo path we call it explicitly).

- [ ] **Step 1: Add the `invalidateAll` import**

In the `<script>` block, add to the imports:

```ts
import { invalidateAll } from '$app/navigation';
```

- [ ] **Step 2: Replace the `handleEditSave()` stub**

Find:
```ts
async function handleEditSave() {
    // Wired up in Task 8. For now, just close so the button is non-broken.
    onClose();
}
```

Replace with:
```ts
async function handleEditSave() {
    if (!editTarget) return;
    error = null;

    // Compute diff against `initial`. Build a payload of only changed fields.
    type DiffPayload = {
        id: string;
        name?: string;
        type?: EquipmentType;
        group?: MuscleGroup;
        glyph?: string;
        cardioKind?: CardioKind | null;
        notes?: string | null;
    };
    const diff: DiffPayload = { id: editTarget.id };
    let hasFieldDiff = false;

    const trimmedName = name.trim();
    if (!trimmedName) {
        error = 'Name is required.';
        return;
    }
    if (trimmedName !== initial.name) {
        diff.name = trimmedName;
        hasFieldDiff = true;
    }
    if (type !== initial.type) {
        diff.type = type;
        hasFieldDiff = true;
    }
    if (group !== initial.group) {
        diff.group = group;
        hasFieldDiff = true;
    }
    if (glyph !== initial.glyph) {
        diff.glyph = glyph;
        hasFieldDiff = true;
    }
    if (notes !== initial.notes) {
        diff.notes = notes.length === 0 ? null : notes;
        hasFieldDiff = true;
    }

    // cardioKind reconciliation (mirrors the server invariant for clean state):
    // - resulting type is cardio: include cardioKind if it differs from initial,
    //   defaulting to 'generic' if somehow null.
    // - resulting type is non-cardio: include cardioKind: null if initial had one.
    if (type === 'cardio') {
        const next = cardioKind ?? 'generic';
        if (next !== initial.cardioKind) {
            diff.cardioKind = next;
            hasFieldDiff = true;
        }
    } else if (initial.cardioKind != null) {
        diff.cardioKind = null;
        hasFieldDiff = true;
    }

    submitting = true;
    try {
        // Photo first: if upload fails, we don't want stale field updates to
        // mask the photo problem. POST overwrites the same path on retry.
        if (photoFile) {
            const form = new FormData();
            form.append('photo', photoFile);
            const res = await fetch(`/api/equipment/${editTarget.id}/photo`, {
                method: 'POST',
                body: form
            });
            if (!res.ok) {
                error = `Photo upload failed (${res.status}).`;
                return;
            }
        } else if (removePhoto && initial.photoPath) {
            const res = await fetch(`/api/equipment/${editTarget.id}/photo`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                error = `Photo remove failed (${res.status}).`;
                return;
            }
        }

        if (hasFieldDiff) {
            await mutate('equipment.update', diff);
        }

        // Photo POST/DELETE doesn't go through mutate(), so its drain doesn't
        // trigger invalidation. Re-fetch the page data so the Setup row reflects
        // the new state immediately.
        if (photoFile || removePhoto) {
            await invalidateAll();
        }

        onClose();
    } catch (err) {
        error = err instanceof Error ? err.message : 'Could not save changes.';
    } finally {
        submitting = false;
    }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AddEquipmentSheet.svelte
git commit -m "feat(EquipmentSheet): wire edit-mode save flow (diff + photo + mutate)"
```

---

### Task 9: Open the edit sheet from the Setup row

**Files:**
- Modify: `src/routes/setup/+page.svelte`

Make the glyph tile a button. Tapping it opens the sheet in edit mode.

- [ ] **Step 1: Add `editingEq` state**

Near the top of the `<script>` block of `src/routes/setup/+page.svelte`, find the existing state declarations (around lines 23-31):

```ts
let addingGym = $state(false);
let newGymName = $state('');
let newGymCity = $state('');
let addingEqForGym = $state<string | null>(null);
let managingExercisesFor = $state<Equipment | null>(null);
let pendingEqDelete = $state<Equipment | null>(null);
let pendingGymDelete = $state<Gym | null>(null);
let busy = $state(false);
let error = $state<string | null>(null);
```

Add immediately after `let managingExercisesFor`:

```ts
let editingEq = $state<Equipment | null>(null);
```

- [ ] **Step 2: Convert the glyph tile into a button**

Find the equipment row block (around lines 254-303). The glyph tile is currently:

```svelte
<div
    class="h-9 w-9 flex-shrink-0 rounded-lg border p-1.5"
    style="background: linear-gradient(135deg, {eq.tint}, var(--color-bg)); border-color: var(--color-line-2);"
>
    <EquipmentGlyph kind={eq.glyph as never} />
</div>
```

Replace with:

```svelte
<button
    type="button"
    class="h-9 w-9 flex-shrink-0 rounded-lg border p-1.5 transition-transform active:scale-95"
    style="background: linear-gradient(135deg, {eq.tint}, var(--color-bg)); border-color: var(--color-line-2);"
    onclick={() => (editingEq = eq)}
    aria-label="Edit equipment"
>
    <EquipmentGlyph kind={eq.glyph as never} />
</button>
```

The visual styling matches the original `<div>`; the `transition-transform active:scale-95` advertises tappability without adding new visual chrome.

- [ ] **Step 3: Mount the sheet in edit mode**

Find the existing mount of `AddEquipmentSheet` (search for `<AddEquipmentSheet`):

```bash
grep -n "AddEquipmentSheet" src/routes/setup/+page.svelte
```

There's likely already an add-mode mount that opens when `addingEqForGym` is non-null. Add a parallel edit-mode mount (anywhere alongside it; near the bottom of the markup is fine):

```svelte
{#if editingEq}
    <AddEquipmentSheet
        mode="edit"
        equipment={editingEq}
        onClose={() => (editingEq = null)}
    />
{/if}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/setup/+page.svelte
git commit -m "feat(setup): tap glyph tile to edit equipment"
```

---

### Task 10: Per-milestone push gate verification

**Files:** none (verification only).

This is the project's mandatory pre-push gate. Do not skip any step.

- [ ] **Step 1: Clean Docker boot**

```bash
docker compose down
docker compose up
```

Tail the logs. Confirm:
- No errors.
- No missing-env warnings.
- Migrations apply cleanly.

- [ ] **Step 2: Connect via chrome-devtools MCP and smoke-test**

Open `http://localhost:5173`. Log in. Run through this checklist:

**Edit basics**
- [ ] On Setup, equipment glyph tile reads as tappable (subtle press state on hover/click).
- [ ] Tapping the glyph tile opens the sheet in edit mode.
- [ ] Header reads "Edit · {equipment name}".
- [ ] All three sections (Photo & glyph, Name & type, Muscle group) are visible on one scrollable screen.
- [ ] Photo preview is the current photo (or glyph fallback if no photo).
- [ ] Glyph picker shows the current glyph as selected.
- [ ] Type chips show the current type as selected.
- [ ] If type is cardio, cardio-kind chips show the current cardio kind as selected.
- [ ] Group chips show the current group as selected.
- [ ] Closing the sheet (X button or backdrop click) makes no network calls.

**Photo flows**
- [ ] In edit mode, "Replace photo" button is present.
- [ ] If a photo exists, "Remove" button is also present.
- [ ] Pick a new photo → preview updates → Save → photo is replaced on Setup row, Home tile, and equipment detail.
- [ ] Replaced photo loads the new image (cache-bust working). Verify the `<img src>` query string changed.
- [ ] Open the sheet again → "Remove" → Save → photo is gone everywhere; glyph fallback displays.

**Field flows**
- [ ] Edit name → Save → row updates everywhere immediately.
- [ ] Edit type → Save → row updates.
- [ ] Edit group → Save → reflected in Stats muscle-group bars (if the equipment had sets in that group).
- [ ] Edit glyph → Save → glyph tile and Home tile update.
- [ ] Edit cardio kind on a cardio equipment → Save → log screen for that equipment shows the new template.
- [ ] Edit notes (add a few lines) → Save → equipment detail page shows the same notes in its own notes editor (the two editors share the same field).
- [ ] Edit notes back to empty → Save → notes are cleared on the detail page.
- [ ] Open the sheet → Save with no changes → no network calls (verify in DevTools Network panel) → sheet closes silently.

**Type-change history correctness**
- [ ] Pick a cardio equipment with at least one logged cardio set. Edit type to a strength type (e.g. machine). Save.
- [ ] Open the Sessions detail page that contains those cardio sets. Confirm the rows still render as `N min · …` (not `— kg × —`).
- [ ] Change the type back to cardio. Confirm cardio sets render correctly again.
- [ ] Pick a strength equipment with at least one logged set. Edit type to cardio. Confirm cardio kind defaults to `generic` and the row in Sessions detail still shows `kg × reps`.

**Server invariant**
- [ ] Manually POST to `/api/mutate` with op `equipment.update` and payload `{ id: <cardio eq id>, type: 'machine' }` (no cardioKind). Inspect the equipment row (via `/equipment/{id}` or the Setup screen). Confirm `cardioKind` is null.
- [ ] Manually POST `equipment.update` with `{ id: <machine eq id>, type: 'cardio' }` (no cardioKind). Confirm cardioKind is `'generic'`.

**Error handling**
- [ ] In DevTools, set network to "Offline". Open edit sheet, change name, Save. The mutation queues; sheet closes (mutate is queue-tolerant). Reconnect → queue drains → Setup updates.
- [ ] Open edit sheet, pick a photo, set network offline, Save. Photo POST fails immediately (it bypasses the queue). Sheet stays open with an error message. Reconnect, retry, success.

**Unrelated regressions**
- [ ] Add equipment flow (the wizard) still works end-to-end with all three steps and a photo upload.
- [ ] Inline rename on the Setup row still works.
- [ ] Manage exercises chevron on free-weight equipment still opens the sheet.
- [ ] Trash icon on a row still soft-deletes the equipment.
- [ ] Home, Log screen, Equipment detail, Sessions detail, History, Stats all render without errors.
- [ ] Console is clean across all the above.

If any check fails, fix the issue, re-run from Step 1, and only proceed once everything is green.

- [ ] **Step 3: Run automated tests**

```bash
pnpm test
```

Expected: all tests pass, including the new `cardioKind` invariant test.

- [ ] **Step 4: Final typecheck**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feat/edit-equipment
```

- [ ] **Step 6: Open PR (or merge directly to main per project convention)**

```bash
gh pr create --title "feat: edit equipment" --body "$(cat <<'EOF'
Adds equipment editing via tap-to-edit on the Setup row's glyph tile. Reuses AddEquipmentSheet with a new mode prop (add wizard vs edit flat-form).

Coupled fixes:
- Server invariant in equipment.update: cardioKind is non-null iff type='cardio', enforced regardless of payload.
- Sessions detail and equipment detail's last-set strip now render each set by its own column shape (durationMin vs weight) so type changes never break history rendering.
- Photo URLs append ?v={updatedAt} to defeat browser caching after replace/remove.

Spec: docs/superpowers/specs/2026-04-30-edit-equipment-design.md
Plan: docs/superpowers/plans/2026-04-30-edit-equipment.md
EOF
)"
```

---

## Out of scope (per spec, FUTURE.md candidates)

- Moving equipment between gyms (`gymId` change).
- Bulk multi-select edit.
- Photo crop / rotate / brightness UI.
- Edit history / undo.
- Optimistic concurrency (last-write-wins is fine for two users).
- **Tint chooser.** The spec listed `tint` among editable fields, but there is no tint-picker UI anywhere in the current app — every equipment row carries the schema default `#1c2026`. Adding the first hex/swatch picker is its own design surface and would expand this iteration's scope without an obvious shape. The schema, the `equipment.update` mutation, and the `initial.tint` snapshot in the form state all keep `tint` plumbed end-to-end so a follow-up plan can drop in just the picker. Filed for FUTURE.md.
