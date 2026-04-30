# Glyph Library Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the equipment glyph library from 11 to 33 kinds (8 kept, 3 redrawn, 22 new), restructure the glyph metadata so it carries `label`/`category`/`aliases`, and rebuild the Add Equipment picker around a search field plus category-grouped grid.

**Architecture:** Three files change — `src/lib/components/glyph-kinds.ts` (now structured metadata, not a bare string array), `src/lib/components/EquipmentGlyph.svelte` (22 new `{:else if}` branches plus 3 redrawn ones), and `src/lib/components/AddEquipmentSheet.svelte` (search input + grouped grid in step 0). DB schema is untouched: `equipment.glyph` stays a string column, new kinds drop in without migration, redrawn kinds reuse their existing string and pick up new art automatically.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) + TypeScript + Tailwind CSS 4. No new deps.

**Test framework note:** Trajectory has no component-test framework — automated coverage is `tests/smoke.mjs` (server-contract end-to-end). This plan therefore is not TDD-with-unit-tests for SVG/UI work. Each glyph task ends with a focused visual check via `pnpm check` (type/svelte-check) plus a browser smoke (chrome-devtools MCP) at the picker. The standing per-milestone push gate (CLAUDE.md) is the final gate before merge.

**Spec:** `docs/superpowers/specs/2026-04-30-glyph-library-expansion-design.md`

---

## File map

- **Modify:** `src/lib/components/glyph-kinds.ts` — replace string-union + array with structured `GlyphMeta` records; export `GLYPHS` (ordered metadata) and `GLYPH_KINDS` (derived array, kept for any back-compat consumers).
- **Modify:** `src/lib/components/EquipmentGlyph.svelte` — replace 3 weak `{:else if}` branches (preacher, chestpress, legpress) with redrawn SVG; append 22 new branches.
- **Modify:** `src/lib/components/AddEquipmentSheet.svelte` — step 0: add search input above the grid; replace flat 4-col grid with category-sectioned grid; flatten back to single grid when search is non-empty; render an empty-state tip + `generic` tile when search yields zero matches.

No other files touched. No new components. No DB migration.

---

### Task 1: Create the feature branch

**Files:** none — git operation.

- [ ] **Step 1: Create branch off `main`**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/glyph-library-expansion
```

Expected: `Switched to a new branch 'feat/glyph-library-expansion'`

---

### Task 2: Restructure glyph metadata

**Files:**
- Modify: `src/lib/components/glyph-kinds.ts` (full rewrite — file is currently ~30 lines).

Replace the bare string union + array with structured records. `GLYPHS` is the ordered source of truth; `GLYPH_KINDS` is derived from it for any consumer that still wants just the kind list. Order within `GLYPHS` is the order glyphs appear within their category in the picker.

- [ ] **Step 1: Overwrite `src/lib/components/glyph-kinds.ts`**

Replace the entire file with:

```ts
// Glyph kinds shared between EquipmentGlyph (the SVG renderer) and the
// AddEquipmentSheet (the picker grid). Each kind has a label, a
// category (used to group the picker), and a list of search aliases.

export type GlyphKind =
	| 'bench'
	| 'squat'
	| 'cable'
	| 'pulldown'
	| 'smith'
	| 'treadmill'
	| 'bike'
	| 'rower'
	| 'preacher'
	| 'chestpress'
	| 'legpress'
	| 'shoulderpress'
	| 'captainschair'
	| 'stairmaster'
	| 'elliptical'
	| 'legcurl'
	| 'legextension'
	| 'hyperextension'
	| 'pullupbar'
	| 'dipstation'
	| 'cablecrossover'
	| 'dumbbells'
	| 'barbell'
	| 'kettlebell'
	| 'generic'
	| 'hackquat'
	| 'tbarrow'
	| 'calfraise'
	| 'hipthrust'
	| 'sled'
	| 'battleropes'
	| 'abwheel'
	| 'mobility';

export type GlyphCategory =
	| 'push'
	| 'pull'
	| 'legs'
	| 'core'
	| 'freeweight'
	| 'cardio'
	| 'other';

export interface GlyphMeta {
	kind: GlyphKind;
	label: string;
	category: GlyphCategory;
	aliases: string[];
}

// Order here is the order glyphs appear within their category in the
// picker. Categories themselves are ordered by CATEGORY_ORDER below.
export const GLYPHS: GlyphMeta[] = [
	// push
	{ kind: 'chestpress', label: 'Chest Press', category: 'push', aliases: ['chest press', 'machine press'] },
	{ kind: 'shoulderpress', label: 'Shoulder Press', category: 'push', aliases: ['shoulder press', 'overhead press', 'ohp', 'military press'] },
	{ kind: 'dipstation', label: 'Dip Station', category: 'push', aliases: ['dip', 'dips', 'parallel bars'] },
	{ kind: 'cablecrossover', label: 'Cable Crossover', category: 'push', aliases: ['cable crossover', 'crossover', 'cable fly', 'fly'] },

	// pull
	{ kind: 'pulldown', label: 'Lat Pulldown', category: 'pull', aliases: ['lat pulldown', 'lat pull-down', 'lat pull'] },
	{ kind: 'cable', label: 'Cable Column', category: 'pull', aliases: ['cable', 'cable machine', 'single cable', 'cable column'] },
	{ kind: 'tbarrow', label: 'T-Bar Row', category: 'pull', aliases: ['t-bar row', 'tbar', 't bar', 'landmine row'] },
	{ kind: 'pullupbar', label: 'Pull-Up Bar', category: 'pull', aliases: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chinup'] },
	{ kind: 'preacher', label: 'Preacher Curl', category: 'pull', aliases: ['preacher curl', 'scott curl', 'biceps curl'] },

	// legs
	{ kind: 'squat', label: 'Squat Rack', category: 'legs', aliases: ['squat', 'squat rack', 'power rack'] },
	{ kind: 'legpress', label: 'Leg Press', category: 'legs', aliases: ['leg press'] },
	{ kind: 'legcurl', label: 'Leg Curl', category: 'legs', aliases: ['leg curl', 'hamstring curl', 'lying curl', 'seated curl'] },
	{ kind: 'legextension', label: 'Leg Extension', category: 'legs', aliases: ['leg extension', 'quad extension'] },
	{ kind: 'hackquat', label: 'Hack Squat', category: 'legs', aliases: ['hack squat', 'hack'] },
	{ kind: 'calfraise', label: 'Calf Raise', category: 'legs', aliases: ['calf raise', 'calves', 'standing calf'] },
	{ kind: 'hipthrust', label: 'Hip Thrust', category: 'legs', aliases: ['hip thrust', 'glute bridge', 'thruster'] },

	// core
	{ kind: 'captainschair', label: "Captain's Chair", category: 'core', aliases: ["captain's chair", 'captains chair', 'leg raise', 'abs'] },
	{ kind: 'abwheel', label: 'Ab Wheel', category: 'core', aliases: ['ab wheel', 'ab roller'] },
	{ kind: 'hyperextension', label: 'Hyperextension', category: 'core', aliases: ['hyperextension', 'back extension', 'roman chair', 'glute ham'] },

	// freeweight
	{ kind: 'bench', label: 'Bench', category: 'freeweight', aliases: ['bench', 'flat bench', 'barbell bench'] },
	{ kind: 'smith', label: 'Smith Machine', category: 'freeweight', aliases: ['smith', 'smith machine'] },
	{ kind: 'barbell', label: 'Barbell', category: 'freeweight', aliases: ['barbell', 'free barbell', 'olympic bar'] },
	{ kind: 'dumbbells', label: 'Dumbbells', category: 'freeweight', aliases: ['dumbbells', 'dumbbell', 'dumbbell rack', 'db'] },
	{ kind: 'kettlebell', label: 'Kettlebell', category: 'freeweight', aliases: ['kettlebell', 'kb'] },

	// cardio
	{ kind: 'treadmill', label: 'Treadmill', category: 'cardio', aliases: ['treadmill', 'tread', 'running'] },
	{ kind: 'bike', label: 'Bike', category: 'cardio', aliases: ['bike', 'stationary bike', 'spin bike', 'cycle'] },
	{ kind: 'rower', label: 'Rower', category: 'cardio', aliases: ['rower', 'rowing machine', 'erg'] },
	{ kind: 'elliptical', label: 'Elliptical', category: 'cardio', aliases: ['elliptical', 'cross trainer'] },
	{ kind: 'stairmaster', label: 'Stair Climber', category: 'cardio', aliases: ['stairmaster', 'stair', 'stepper', 'stepmill', 'stair climber'] },

	// other
	{ kind: 'sled', label: 'Sled', category: 'other', aliases: ['sled', 'prowler', 'push sled'] },
	{ kind: 'battleropes', label: 'Battle Ropes', category: 'other', aliases: ['battle ropes', 'ropes'] },
	{ kind: 'mobility', label: 'Foam Roller', category: 'other', aliases: ['foam roller', 'mobility', 'roller', 'stretch'] },
	{ kind: 'generic', label: 'Generic', category: 'other', aliases: ['generic', 'other', 'unknown', 'custom'] }
];

// Category display order in the picker grid.
export const CATEGORY_ORDER: GlyphCategory[] = [
	'push',
	'pull',
	'legs',
	'core',
	'freeweight',
	'cardio',
	'other'
];

export const CATEGORY_LABEL: Record<GlyphCategory, string> = {
	push: 'Push',
	pull: 'Pull',
	legs: 'Legs',
	core: 'Core',
	freeweight: 'Free weight',
	cardio: 'Cardio',
	other: 'Other'
};

// Derived for back-compat with any consumer that just wants the kinds.
export const GLYPH_KINDS: GlyphKind[] = GLYPHS.map((g) => g.kind);
```

- [ ] **Step 2: Run the type checker**

Run: `pnpm check`
Expected: zero TypeScript / Svelte errors. The `EquipmentGlyph.svelte` file references `GlyphKind` only as a type, and `AddEquipmentSheet.svelte` imports `GLYPH_KINDS` — both still resolve. Existing `equipment.glyph` strings in the DB also satisfy the broader union (8 kept kinds are all in the new `GlyphKind`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/glyph-kinds.ts
git commit -m "refactor(glyphs): structure metadata with label/category/aliases"
```

---

### Task 3: Redraw `preacher` glyph

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (the `kind === 'preacher'` branch).

The current `preacher` branch reads as a stick figure with two floating circles. New design: angled pad sloping up-right with a curl bar at the working end.

- [ ] **Step 1: Replace the `preacher` branch**

In `src/lib/components/EquipmentGlyph.svelte`, find the existing block:

```svelte
		{:else if kind === 'preacher'}
			<path d="M14 50v-20l12-8h14" stroke={stroke} stroke-width={sw}/>
			<path d="M40 22h10l6 6" stroke={stroke} stroke-width={sw}/>
			<path d="M20 50h36" stroke={stroke} stroke-width={sw}/>
			<circle cx="62" cy="14" r="4" stroke={accent} stroke-width={aSw}/>
			<circle cx="62" cy="36" r="4" stroke={accent} stroke-width={aSw}/>
			<path d="M62 18v14" stroke={accent} stroke-width={aSw}/>
```

Replace with:

```svelte
		{:else if kind === 'preacher'}
			<path d="M8 54h64" stroke={stroke} stroke-width={sw}/>
			<path d="M30 54v-22" stroke={stroke} stroke-width={sw}/>
			<rect x="22" y="44" width="18" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M30 32l28 -14" stroke={accent} stroke-width={aSw}/>
			<path d="M58 18l8 4" stroke={accent} stroke-width={aSw}/>
			<circle cx="68" cy="22" r="3" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 2: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 3: Visual sanity check**

Boot the dev container if not already running:

```bash
docker compose up -d
```

Open `http://localhost:5173`, log in, go to Setup, open Add Equipment. In the picker grid, `preacher` should now read as an angled pad with a bar at the upper-right end (not a stick figure).

If still ambiguous, iterate the path geometry before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): redraw preacher curl glyph"
```

---

### Task 4: Redraw `chestpress` glyph

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (the `kind === 'chestpress'` branch).

Current reads as a filing cabinet. New: seated press with a backrest, seat, two horizontal handle arms, and a side weight stack.

- [ ] **Step 1: Replace the `chestpress` branch**

Find:

```svelte
		{:else if kind === 'chestpress'}
			<rect x="18" y="14" width="16" height="32" rx="3" stroke={stroke} stroke-width={sw}/>
			<path d="M34 22l14-4v20l-14-4" stroke={accent} stroke-width={aSw}/>
			<circle cx="52" cy="28" r="3" stroke={stroke} stroke-width={sw}/>
			<path d="M12 52h46" stroke={stroke} stroke-width={sw}/>
```

Replace with:

```svelte
		{:else if kind === 'chestpress'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
			<rect x="20" y="38" width="20" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M22 28h28" stroke={accent} stroke-width={aSw}/>
			<path d="M22 36h28" stroke={accent} stroke-width={aSw}/>
			<circle cx="52" cy="28" r="3" stroke={accent} stroke-width={aSw}/>
			<circle cx="52" cy="36" r="3" stroke={accent} stroke-width={aSw}/>
			<rect x="58" y="22" width="8" height="22" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 2: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 3: Visual check**

Reload the picker. `chestpress` should now read as backrest + seat + two forward-pointing handles.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): redraw chest press glyph"
```

---

### Task 5: Redraw `legpress` glyph

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (the `kind === 'legpress'` branch).

Current reads as a rhombus floating mid-air. New: angled sled with a seat at the bottom and a plate platform at the top of the rail.

- [ ] **Step 1: Replace the `legpress` branch**

Find:

```svelte
		{#if kind === 'legpress'}
			<path d="M8 48h44" stroke={stroke} stroke-width={sw}/>
			<path d="M12 48v-8h36v8" stroke={stroke} stroke-width={sw}/>
			<path d="M50 20l18-6v20l-18-6z" stroke={accent} stroke-width={aSw}/>
			<path d="M52 26l-6 4v8" stroke={stroke} stroke-width={sw}/>
			<circle cx="52" cy="14" r="3" stroke={stroke} stroke-width={sw}/>
```

Replace with:

```svelte
		{#if kind === 'legpress'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="10" y="38" width="20" height="12" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M28 44l32 -28" stroke={accent} stroke-width={aSw}/>
			<path d="M58 16l8 8" stroke={accent} stroke-width={aSw}/>
			<circle cx="62" cy="20" r="4" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 2: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 3: Visual check**

Reload the picker. `legpress` should read as seat at lower-left, angled rail going up-right, plate at the top.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): redraw leg press glyph"
```

---

### Task 6: Add tier 1 glyphs (shoulderpress, captainschair, stairmaster, elliptical)

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (append 4 new `{:else if}` branches before the closing `{/if}`).

These are the four kinds the user specifically named as missing. After this task, all of the user's main equipment renders correctly in the new metadata. They are added one branch at a time so each can be eyeballed in the picker before committing.

- [ ] **Step 1: Append `shoulderpress` branch**

In `src/lib/components/EquipmentGlyph.svelte`, immediately before the final `{/if}`, insert:

```svelte
		{:else if kind === 'shoulderpress'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="22" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
			<rect x="28" y="38" width="20" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M30 28v-12" stroke={accent} stroke-width={aSw}/>
			<path d="M46 28v-12" stroke={accent} stroke-width={aSw}/>
			<circle cx="30" cy="14" r="3" stroke={accent} stroke-width={aSw}/>
			<circle cx="46" cy="14" r="3" stroke={accent} stroke-width={aSw}/>
			<rect x="58" y="20" width="8" height="24" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 2: Append `captainschair` branch**

Immediately after the `shoulderpress` branch, insert:

```svelte
		{:else if kind === 'captainschair'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M40 52v-40" stroke={stroke} stroke-width={sw}/>
			<rect x="32" y="14" width="16" height="20" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M32 24h-12" stroke={accent} stroke-width={aSw}/>
			<path d="M48 24h12" stroke={accent} stroke-width={aSw}/>
			<path d="M40 34v10" stroke={accent} stroke-width={aSw}/>
			<path d="M36 44l4 6 4-6" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 3: Append `stairmaster` branch**

Immediately after `captainschair`, insert:

```svelte
		{:else if kind === 'stairmaster'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M14 52v-6h8v-6h8v-6h8v-6h8v-6h8" stroke={accent} stroke-width={aSw}/>
			<path d="M62 22v-12" stroke={stroke} stroke-width={sw}/>
			<rect x="56" y="6" width="12" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 4: Append `elliptical` branch**

Immediately after `stairmaster`, insert:

```svelte
		{:else if kind === 'elliptical'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<circle cx="22" cy="34" r="8" stroke={accent} stroke-width={aSw}/>
			<path d="M22 34l28 12" stroke={accent} stroke-width={aSw}/>
			<path d="M22 34l28 -8" stroke={accent} stroke-width={aSw}/>
			<path d="M50 46h6" stroke={stroke} stroke-width={sw}/>
			<path d="M50 26v-12" stroke={stroke} stroke-width={sw}/>
			<circle cx="50" cy="12" r="2" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 5: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 6: Visual check**

These won't appear in the picker until Task 9 wires the new metadata into the grid. To verify them now, temporarily render each from a debug page or browser console — or wait to verify them in Task 9. The minimum check at this stage is that `pnpm check` passes; visual confirmation comes when the picker is rebuilt.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): add tier 1 (shoulderpress, captainschair, stairmaster, elliptical)"
```

---

### Task 7: Add tier 2 glyphs (10 kinds)

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (append 10 new branches).

Tier 2 covers what a typical commercial gym has beyond the user's main set: leg curl, leg extension, hyperextension, pull-up bar, dip station, cable crossover, dumbbells, barbell, kettlebell, generic.

- [ ] **Step 1: Append `legcurl` branch**

Insert immediately before the closing `{/if}`:

```svelte
		{:else if kind === 'legcurl'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="12" y="32" width="36" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M16 38v12" stroke={stroke} stroke-width={sw}/>
			<path d="M44 38v12" stroke={stroke} stroke-width={sw}/>
			<path d="M48 32l14 -10" stroke={accent} stroke-width={aSw}/>
			<circle cx="64" cy="22" r="3" stroke={accent} stroke-width={aSw}/>
			<path d="M48 32l4 14" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 2: Append `legextension` branch**

```svelte
		{:else if kind === 'legextension'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
			<rect x="20" y="38" width="22" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
			<path d="M42 38l16 -16" stroke={accent} stroke-width={aSw}/>
			<circle cx="60" cy="20" r="3" stroke={accent} stroke-width={aSw}/>
			<rect x="50" y="44" width="10" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 3: Append `hyperextension` branch**

```svelte
		{:else if kind === 'hyperextension'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M20 52l28 -32" stroke={accent} stroke-width={aSw}/>
			<path d="M28 52l24 -28" stroke={accent} stroke-width={aSw}/>
			<path d="M44 28l8 -2" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="42" width="6" height="10" rx="1" stroke={stroke} stroke-width={sw}/>
			<path d="M52 44h8v8" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 4: Append `pullupbar` branch**

```svelte
		{:else if kind === 'pullupbar'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M16 52v-44" stroke={stroke} stroke-width={sw}/>
			<path d="M64 52v-44" stroke={stroke} stroke-width={sw}/>
			<path d="M16 12h48" stroke={accent} stroke-width={aSw}/>
			<path d="M22 16v6" stroke={stroke} stroke-width={sw}/>
			<path d="M30 16v6" stroke={stroke} stroke-width={sw}/>
			<path d="M50 16v6" stroke={stroke} stroke-width={sw}/>
			<path d="M58 16v6" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 5: Append `dipstation` branch**

```svelte
		{:else if kind === 'dipstation'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M14 52v-26" stroke={stroke} stroke-width={sw}/>
			<path d="M50 36v16" stroke={stroke} stroke-width={sw}/>
			<path d="M14 36h36" stroke={accent} stroke-width={aSw}/>
			<path d="M22 52v-22" stroke={stroke} stroke-width={sw}/>
			<path d="M58 30v22" stroke={stroke} stroke-width={sw}/>
			<path d="M22 30h36" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 6: Append `cablecrossover` branch**

```svelte
		{:else if kind === 'cablecrossover'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M14 52v-44" stroke={stroke} stroke-width={sw}/>
			<path d="M66 52v-44" stroke={stroke} stroke-width={sw}/>
			<path d="M14 8h52" stroke={stroke} stroke-width={sw}/>
			<path d="M14 14l26 24" stroke={accent} stroke-width={aSw}/>
			<path d="M66 14l-26 24" stroke={accent} stroke-width={aSw}/>
			<rect x="36" y="36" width="8" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 7: Append `dumbbells` branch**

```svelte
		{:else if kind === 'dumbbells'}
			<rect x="14" y="18" width="28" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
			<rect x="10" y="14" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<rect x="40" y="14" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<rect x="36" y="38" width="28" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
			<rect x="32" y="34" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<rect x="62" y="34" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 8: Append `barbell` branch**

```svelte
		{:else if kind === 'barbell'}
			<path d="M8 30h64" stroke={accent} stroke-width={aSw}/>
			<rect x="10" y="20" width="6" height="20" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<rect x="18" y="16" width="4" height="28" rx="1" stroke={stroke} stroke-width={sw}/>
			<rect x="58" y="16" width="4" height="28" rx="1" stroke={stroke} stroke-width={sw}/>
			<rect x="64" y="20" width="6" height="20" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 9: Append `kettlebell` branch**

```svelte
		{:else if kind === 'kettlebell'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M30 18c0-6 4-10 10-10s10 4 10 10" stroke={stroke} stroke-width={sw}/>
			<path d="M30 18v6" stroke={stroke} stroke-width={sw}/>
			<path d="M50 18v6" stroke={stroke} stroke-width={sw}/>
			<path d="M22 28c0-4 8-6 18-6s18 2 18 6" stroke={accent} stroke-width={aSw}/>
			<path d="M22 28c0 16 6 22 18 22s18-6 18-22" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 10: Append `generic` branch**

```svelte
		{:else if kind === 'generic'}
			<rect x="20" y="10" width="40" height="40" rx="6" stroke={stroke} stroke-width={sw}/>
			<path d="M40 24v10" stroke={accent} stroke-width={aSw}/>
			<path d="M34 22a6 6 0 0 1 12 0c0 4-6 6-6 8" stroke={accent} stroke-width={aSw}/>
			<circle cx="40" cy="40" r="2" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 11: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 12: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): add tier 2 (legcurl, legextension, hyperextension, pullupbar, dipstation, cablecrossover, dumbbells, barbell, kettlebell, generic)"
```

---

### Task 8: Add tier 3 glyphs (8 kinds)

**Files:**
- Modify: `src/lib/components/EquipmentGlyph.svelte` (append 8 new branches).

Less common but real (`hackquat`, `tbarrow`, `calfraise`, `hipthrust`, `sled`, `battleropes`, `abwheel`, `mobility`).

- [ ] **Step 1: Append `hackquat` branch**

```svelte
		{:else if kind === 'hackquat'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M14 52l32 -36" stroke={accent} stroke-width={aSw}/>
			<path d="M22 52l32 -36" stroke={accent} stroke-width={aSw}/>
			<rect x="34" y="22" width="14" height="8" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<rect x="46" y="20" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<path d="M14 16l8 4" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 2: Append `tbarrow` branch**

```svelte
		{:else if kind === 'tbarrow'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<path d="M10 52l50 -28" stroke={accent} stroke-width={aSw}/>
			<circle cx="14" cy="50" r="3" stroke={stroke} stroke-width={sw}/>
			<rect x="56" y="20" width="6" height="10" rx="1" stroke={stroke} stroke-width={sw}/>
			<rect x="62" y="22" width="4" height="6" rx="1" stroke={stroke} stroke-width={sw}/>
			<rect x="34" y="34" width="10" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 3: Append `calfraise` branch**

```svelte
		{:else if kind === 'calfraise'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="20" y="44" width="40" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<path d="M30 44v-32" stroke={stroke} stroke-width={sw}/>
			<path d="M50 44v-32" stroke={stroke} stroke-width={sw}/>
			<path d="M30 16h20" stroke={accent} stroke-width={aSw}/>
			<rect x="26" y="14" width="6" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
			<rect x="48" y="14" width="6" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 4: Append `hipthrust` branch**

```svelte
		{:else if kind === 'hipthrust'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="36" width="20" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<path d="M18 42v8" stroke={stroke} stroke-width={sw}/>
			<path d="M30 42v8" stroke={stroke} stroke-width={sw}/>
			<path d="M34 32l24 -4" stroke={accent} stroke-width={aSw}/>
			<rect x="56" y="22" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<path d="M40 38l4 12 4-12" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 5: Append `sled` branch**

```svelte
		{:else if kind === 'sled'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="38" width="36" height="10" rx="2" stroke={accent} stroke-width={aSw}/>
			<path d="M22 38v-22" stroke={stroke} stroke-width={sw}/>
			<path d="M42 38v-22" stroke={stroke} stroke-width={sw}/>
			<rect x="18" y="14" width="8" height="4" rx="1" stroke={stroke} stroke-width={sw}/>
			<rect x="38" y="14" width="8" height="4" rx="1" stroke={stroke} stroke-width={sw}/>
			<path d="M50 44l16 6" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 6: Append `battleropes` branch**

```svelte
		{:else if kind === 'battleropes'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="62" y="38" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
			<path d="M62 42c-6 0 -8 6 -14 6s-8 -6 -14 -6s-8 6 -14 6s-8 -6 -12 -6" stroke={accent} stroke-width={aSw}/>
			<path d="M62 48c-6 0 -8 -6 -14 -6s-8 6 -14 6s-8 -6 -14 -6s-8 6 -12 6" stroke={accent} stroke-width={aSw}/>
```

- [ ] **Step 7: Append `abwheel` branch**

```svelte
		{:else if kind === 'abwheel'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<circle cx="40" cy="38" r="12" stroke={accent} stroke-width={aSw}/>
			<path d="M22 38h-10" stroke={stroke} stroke-width={sw}/>
			<path d="M58 38h10" stroke={stroke} stroke-width={sw}/>
			<circle cx="40" cy="38" r="3" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 8: Append `mobility` branch**

```svelte
		{:else if kind === 'mobility'}
			<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
			<rect x="14" y="28" width="52" height="14" rx="7" stroke={accent} stroke-width={aSw}/>
			<path d="M22 32v6" stroke={stroke} stroke-width={sw}/>
			<path d="M30 32v6" stroke={stroke} stroke-width={sw}/>
			<path d="M40 32v6" stroke={stroke} stroke-width={sw}/>
			<path d="M50 32v6" stroke={stroke} stroke-width={sw}/>
			<path d="M58 32v6" stroke={stroke} stroke-width={sw}/>
```

- [ ] **Step 9: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/components/EquipmentGlyph.svelte
git commit -m "feat(glyphs): add tier 3 (hackquat, tbarrow, calfraise, hipthrust, sled, battleropes, abwheel, mobility)"
```

---

### Task 9: Rebuild the picker — search field + categorized grid

**Files:**
- Modify: `src/lib/components/AddEquipmentSheet.svelte` (script imports, new state, step 0 markup).

The picker currently is a flat 4-col grid of `GLYPH_KINDS`. With 33 kinds it scrolls too long. New shape: a search input above the grid, and the grid is sectioned by category. When search has any non-empty text, sections collapse and the grid becomes a flat filtered list. If filter yields zero, show a single `generic` tile + tip.

This is the task that finally surfaces all 33 glyphs in the UI. Do all visual verification of the new glyphs at the end of this task.

- [ ] **Step 1: Update the import line**

In `src/lib/components/AddEquipmentSheet.svelte`, find:

```svelte
	import { GLYPH_KINDS, type GlyphKind } from './glyph-kinds';
```

Replace with:

```svelte
	import {
		GLYPHS,
		CATEGORY_ORDER,
		CATEGORY_LABEL,
		type GlyphKind,
		type GlyphMeta
	} from './glyph-kinds';
```

- [ ] **Step 2: Add search state and derived lists**

In the same `<script lang="ts">` block, immediately after the existing state declarations (after the `let error = $state<string | null>(null);` line), add:

```ts
	let glyphSearch = $state('');

	// When search is non-empty, render a flat filtered list. When empty,
	// render category-grouped sections in CATEGORY_ORDER.
	const filteredGlyphs = $derived.by<GlyphMeta[] | null>(() => {
		const q = glyphSearch.trim().toLowerCase();
		if (!q) return null;
		return GLYPHS.filter(
			(g) =>
				g.label.toLowerCase().includes(q) ||
				g.aliases.some((a) => a.toLowerCase().includes(q))
		);
	});

	const groupedGlyphs = $derived.by(() =>
		CATEGORY_ORDER.map((category) => ({
			category,
			label: CATEGORY_LABEL[category],
			items: GLYPHS.filter((g) => g.category === category)
		}))
	);

	function pickGeneric() {
		glyph = 'generic';
		glyphSearch = '';
	}
```

- [ ] **Step 3: Replace the step-0 glyph grid markup**

Find the existing block (currently inside `{#if step === 0}` after the photo button row):

```svelte
				<div class="mt-1">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Glyph
					</div>
					<div class="mt-2 grid grid-cols-4 gap-2">
						{#each GLYPH_KINDS as g (g)}
							<button
								type="button"
								class="flex aspect-square items-center justify-center rounded-xl border p-2"
								style="background: {glyph === g
									? 'var(--color-amber-dim)'
									: 'var(--color-surface-2)'}; border-color: {glyph === g
									? 'var(--color-amber-line)'
									: 'var(--color-line-2)'};"
								onclick={() => (glyph = g)}
								aria-pressed={glyph === g}
							>
								<EquipmentGlyph
									kind={g}
									accent={glyph === g ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
								/>
							</button>
						{/each}
					</div>
				</div>
```

Replace with:

```svelte
				<div class="mt-1 flex flex-col gap-2">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Glyph
					</div>

					<input
						bind:value={glyphSearch}
						type="text"
						placeholder="Search glyphs (e.g. lat pulldown, kettlebell)"
						class="rounded-lg border px-3 py-2 text-[13px] outline-none"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
						aria-label="Search glyphs"
					/>

					{#if filteredGlyphs === null}
						{#each groupedGlyphs as section (section.category)}
							<div class="mt-2 flex flex-col gap-2">
								<div
									class="text-[10px] font-bold uppercase tracking-[0.14em]"
									style="color: var(--color-text-dim-2);"
								>
									{section.label}
								</div>
								<div class="grid grid-cols-4 gap-2">
									{#each section.items as g (g.kind)}
										<button
											type="button"
											class="flex aspect-square items-center justify-center rounded-xl border p-2"
											style="background: {glyph === g.kind
												? 'var(--color-amber-dim)'
												: 'var(--color-surface-2)'}; border-color: {glyph === g.kind
												? 'var(--color-amber-line)'
												: 'var(--color-line-2)'};"
											onclick={() => (glyph = g.kind)}
											aria-pressed={glyph === g.kind}
											aria-label={g.label}
											title={g.label}
										>
											<EquipmentGlyph
												kind={g.kind}
												accent={glyph === g.kind ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
											/>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					{:else if filteredGlyphs.length === 0}
						<div class="mt-2 flex flex-col gap-2">
							<div
								class="text-[12px]"
								style="color: var(--color-text-dim);"
							>
								No glyph matches “{glyphSearch}”. Pick <span style="color: var(--color-text);">Generic</span> and name it whatever you like.
							</div>
							<div class="grid grid-cols-4 gap-2">
								<button
									type="button"
									class="flex aspect-square items-center justify-center rounded-xl border p-2"
									style="background: {glyph === 'generic'
										? 'var(--color-amber-dim)'
										: 'var(--color-surface-2)'}; border-color: {glyph === 'generic'
										? 'var(--color-amber-line)'
										: 'var(--color-line-2)'};"
									onclick={pickGeneric}
									aria-pressed={glyph === 'generic'}
									aria-label="Generic"
									title="Generic"
								>
									<EquipmentGlyph
										kind="generic"
										accent={glyph === 'generic' ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
									/>
								</button>
							</div>
						</div>
					{:else}
						<div class="mt-2 grid grid-cols-4 gap-2">
							{#each filteredGlyphs as g (g.kind)}
								<button
									type="button"
									class="flex aspect-square items-center justify-center rounded-xl border p-2"
									style="background: {glyph === g.kind
										? 'var(--color-amber-dim)'
										: 'var(--color-surface-2)'}; border-color: {glyph === g.kind
										? 'var(--color-amber-line)'
										: 'var(--color-line-2)'};"
									onclick={() => (glyph = g.kind)}
									aria-pressed={glyph === g.kind}
									aria-label={g.label}
									title={g.label}
								>
									<EquipmentGlyph
										kind={g.kind}
										accent={glyph === g.kind ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
									/>
								</button>
							{/each}
						</div>
					{/if}
				</div>
```

- [ ] **Step 4: Type check**

Run: `pnpm check`
Expected: zero errors.

- [ ] **Step 5: Visual verification — full glyph audit**

Boot Docker if not already: `docker compose up -d`. Open `http://localhost:5173`, log in, go to Setup → Add Equipment.

In step 0:

1. Confirm the search field is above the grid.
2. Scroll through every category section (Push, Pull, Legs, Core, Free weight, Cardio, Other). Confirm all 33 glyphs render without console errors.
3. For each glyph, eyeball that the schematic motif reads as the named equipment at tile size. Note any that don't read; iterate the SVG paths in `EquipmentGlyph.svelte` and re-test before moving on. The three redrawn ones (preacher, chestpress, legpress) should now be markedly clearer than before.
4. Type `lat` in the search box. Expect category sections to disappear and `Lat Pulldown` to be in the filtered grid.
5. Type `kb`. Expect `Kettlebell` to match (alias).
6. Type `xyzzy`. Expect the empty-state tip and a single `Generic` tile.
7. Clear the search. Sections should reappear in order Push → Pull → Legs → Core → Free weight → Cardio → Other.
8. Tap a glyph in any section. Confirm the amber-dim selected state applies and the preview at the top of the sheet updates.
9. Complete the flow (give it a name, type, group) and save. Confirm the tile on Setup renders the chosen glyph.

If any glyph fails the read test, fix the SVG in place and re-verify.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/AddEquipmentSheet.svelte
git commit -m "feat(setup): add glyph search + category sections to picker"
```

---

### Task 10: Push gate

**Files:** none — verification + push.

Per CLAUDE.md, the per-milestone push gate is mandatory. This task runs it.

- [ ] **Step 1: Clean Docker boot**

```bash
docker compose down
docker compose up
```

Tail the logs in another terminal. Expected: no errors, no missing-env warnings, migrations clean.

- [ ] **Step 2: chrome-devtools MCP smoke**

Connect to `http://localhost:5173` via chrome-devtools MCP. Take screenshots of:
1. Setup screen with at least one piece of equipment using a redrawn glyph.
2. Add Equipment sheet step 0 with sections collapsed (no search).
3. Add Equipment sheet step 0 with `lat` typed (filter active).
4. Add Equipment sheet step 0 with `xyzzy` typed (empty state).

Check the browser console for errors during all of the above.

- [ ] **Step 3: Smoke-test acceptance criteria from the spec**

For each spec acceptance bullet, click through the actual UI:

1. ✅ 33 distinct glyph kinds render — verified in Task 9 step 5.
2. ✅ Redrawn `preacher`, `chestpress`, `legpress` read correctly — verified in Tasks 3–5 plus Task 9 step 5.
3. ✅ Step 0 has working search + categorized grid — verified in Task 9 step 5.
4. ✅ Search matches labels and aliases case-insensitive — verified in Task 9 step 5.
5. ✅ Existing rows render the new art — log a set on an `equipment` row that uses one of the redrawn kinds (or create one if none exists) and confirm the new SVG shows.
6. ✅ Per-milestone push gate — this task.

- [ ] **Step 4: One adjacent edge case**

Verify deleting an equipment item that uses a new glyph kind, then re-adding it with the same glyph, doesn't break. (Soft-delete, then walk through Add Equipment again, pick the same glyph.)

- [ ] **Step 5: Run smoke tests**

```bash
pnpm test:smoke
```

Expected: all assertions pass. The smoke harness exercises `/api/mutate` end-to-end and is unaffected by glyph changes; it should pass regardless. If it fails, the regression is unrelated to this work but must be triaged before push anyway.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feat/glyph-library-expansion
```

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "feat: expand glyph library to 33 kinds + searchable picker" --body "$(cat <<'EOF'
## Summary
- Glyph library grows from 11 to 33 kinds: 8 kept, 3 redrawn (preacher, chestpress, legpress), 22 new.
- Glyph metadata restructured with `label`, `category`, and `aliases` to drive the picker.
- Add Equipment sheet picker rebuilt around a search input + category-grouped grid (Push, Pull, Legs, Core, Free weight, Cardio, Other) with a generic-fallback empty state.

Spec: `docs/superpowers/specs/2026-04-30-glyph-library-expansion-design.md`
Plan: `docs/superpowers/plans/2026-04-30-glyph-library-expansion.md`

## Test plan
- [x] `pnpm check` clean
- [x] `pnpm test:smoke` clean
- [x] Per-milestone push gate (Docker boot + chrome-devtools MCP screenshots + UI smoke)
- [x] All 33 glyphs render in picker without console errors
- [x] Search filters by label and alias, case-insensitive
- [x] Empty-state shows the generic fallback tile + tip
- [x] Existing `preacher` / `chestpress` / `legpress` rows pick up the new SVG art with no DB change
EOF
)"
```

Return the PR URL.

---

## Self-review notes

Coverage check against spec:

- ✅ Roster (33 kinds, 8 kept / 3 redrawn / 22 new) — Tasks 3–8 cover all 25 SVG changes.
- ✅ Glyph metadata (`GLYPHS`, `GlyphMeta`, `CATEGORY_ORDER`, `CATEGORY_LABEL`) — Task 2.
- ✅ SVG style spec — encoded directly in the SVG paths (constant `stroke`, `sw`, `aSw` already exist; new branches reuse them with no exceptions).
- ✅ Picker UI changes (search, categories, flat-on-search, empty state) — Task 9.
- ✅ Files-touched list (`glyph-kinds.ts`, `EquipmentGlyph.svelte`, `AddEquipmentSheet.svelte`) — matches.
- ✅ Data migration (none needed) — confirmed in plan header.
- ✅ Acceptance criteria — explicit checklist in Task 10 step 3.

Type-name consistency: `GlyphKind`, `GlyphMeta`, `GlyphCategory`, `GLYPHS`, `GLYPH_KINDS`, `CATEGORY_ORDER`, `CATEGORY_LABEL` are used identically across Tasks 2 and 9. The `glyph` state variable in `AddEquipmentSheet.svelte` keeps its existing `GlyphKind` type from the original file (`let glyph = $state<GlyphKind>('bench');` is unchanged).
