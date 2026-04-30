# Glyph Library Expansion — Design

**Date:** 2026-04-30
**Status:** Approved (brainstorm → ready for implementation plan)

## Problem

The equipment glyph library has two gaps:

1. **Coverage** — only 11 kinds. Missing common machines the user already trains on (shoulder press, captain's chair) and standard commercial-gym equipment (leg curl, leg extension, dumbbells, pull-up bar, etc.).
2. **Quality** — three of the existing 11 read poorly at tile size: `preacher`, `chestpress`, `legpress`.

Glyphs are the fallback illustration on equipment tiles when no photo is uploaded, and they populate the picker grid in the Add Equipment sheet. They also need to scale gracefully across travel gyms where photos won't always be available.

## Approach

Stay hand-authored in the existing schematic stroke style. Expand the roster from 11 to 33 kinds. Redraw the three weak ones in place (same kind string, new SVG — existing DB rows pick up the new art automatically). Add a search field and category groupings to the picker, since 33 items in a flat 4-col grid is too long to scan.

No icon-library swap. Lucide / Tabler / Iconoir have ~3 gym icons total; Game-icons.net is closest in coverage but cartoonish and would break the app's visual identity.

## Roster (33 total)

**Existing kept (8)**

bench, squat, cable, pulldown, smith, treadmill, bike, rower

**Existing redrawn (3)**

preacher, chestpress, legpress

**New — tier 1, named by user (4)**

shoulderpress, captainschair, stairmaster, elliptical

**New — tier 2, typical commercial gym (10)**

legcurl, legextension, hyperextension, pullupbar, dipstation, cablecrossover, dumbbells, barbell, kettlebell, generic

**New — tier 3, less common but common enough (8)**

hackquat, tbarrow, calfraise, hipthrust, sled, battleropes, abwheel, mobility

## Glyph metadata

Replace the bare string array in `glyph-kinds.ts` with structured records so the picker can search and group.

```ts
type GlyphKind =
  | 'bench' | 'squat' | 'cable' | 'pulldown' | 'smith'
  | 'treadmill' | 'bike' | 'rower'
  | 'preacher' | 'chestpress' | 'legpress'
  | 'shoulderpress' | 'captainschair' | 'stairmaster' | 'elliptical'
  | 'legcurl' | 'legextension' | 'hyperextension'
  | 'pullupbar' | 'dipstation' | 'cablecrossover'
  | 'dumbbells' | 'barbell' | 'kettlebell' | 'generic'
  | 'hackquat' | 'tbarrow' | 'calfraise' | 'hipthrust'
  | 'sled' | 'battleropes' | 'abwheel' | 'mobility';

type GlyphCategory =
  | 'push' | 'pull' | 'legs' | 'core'
  | 'freeweight' | 'cardio' | 'other';

interface GlyphMeta {
  kind: GlyphKind;
  label: string;        // human-readable, e.g. "Lat Pulldown"
  category: GlyphCategory;
  aliases: string[];    // search synonyms, lowercase
}

export const GLYPHS: GlyphMeta[];           // ordered for display
export const GLYPH_KINDS: GlyphKind[];      // derived, kept for back-compat
```

`label` and `aliases` feed search (case-insensitive substring match on either). `category` drives the section headers in the picker. Order in `GLYPHS` is the order they appear within their category.

### Category assignments

- **push:** chestpress, shoulderpress, dipstation, cablecrossover
- **pull:** pulldown, cable, tbarrow, pullupbar, preacher
- **legs:** squat, legpress, legcurl, legextension, hackquat, calfraise, hipthrust
- **core:** captainschair, abwheel, hyperextension
- **freeweight:** bench, smith, barbell, dumbbells, kettlebell
- **cardio:** treadmill, bike, rower, elliptical, stairmaster
- **other:** sled, battleropes, mobility, generic

## SVG style spec (locked)

To keep new glyphs consistent with the existing eight kept ones, formalize the rules:

- **viewBox:** `0 0 80 60`
- **Stroke-only.** No fills.
- **Two strokes:**
  - structure: `rgba(244,237,226,0.85)` at `stroke-width=1.5`
  - accent: `var(--color-amber)` at `stroke-width=1.75`
- **Linecap / linejoin:** both `round`
- **Story rule:** each glyph picks one element as the "story" — typically the resistance source (weight stack, cable path, plate, the moving handle). That element uses the accent stroke; everything else is structure.
- **Element budget:** ~6–10 path/circle/rect elements max. More than that reads as noise at tile size.

These constants are already in `EquipmentGlyph.svelte` (`stroke`, `sw`, `aSw`); the spec is a documented commitment to keep them, not a code change.

## Picker UI changes (AddEquipmentSheet step 0)

- **Search field** above the grid. Filters glyphs by `label` and `aliases` substring, case-insensitive. Empty input shows everything.
- **Category sections** when search is empty. Each section: small uppercase label (`PUSH`, `PULL`, etc.) above its 4-col grid block. Order: push → pull → legs → core → freeweight → cardio → other.
- **Flat results** when search has any text. Headers hide; matches appear in a single 4-col grid.
- **Empty state:** if search yields zero matches, show a one-line tip ("No match — pick `generic` and name it whatever you like.") and a `generic` tile to tap.
- The current selected-state styling (amber-dim background, amber-line border) carries over unchanged.

## Files touched

- `src/lib/components/glyph-kinds.ts` — replace array with `GLYPHS` metadata array; keep `GLYPH_KINDS` as derived export.
- `src/lib/components/EquipmentGlyph.svelte` — 22 new `{:else if}` branches; 3 redrawn (`preacher`, `chestpress`, `legpress`).
- `src/lib/components/AddEquipmentSheet.svelte` — search input + categorized grid layout in step 0.

## Data migration

Glyph kind is stored as a string in `equipment.glyph` (TEXT column). No migration needed:

- New kind strings: rows referencing them simply didn't exist before.
- Redrawn kinds (`preacher`, `chestpress`, `legpress`): existing rows continue using these strings and pick up the new SVG branches automatically on next render.

## Out of scope

Out of scope for this work; parked in `FUTURE.md` consideration only:

- Photo-first picker (camera capture flow improvements).
- Per-user favorite glyphs / recently-used row at the top of the picker.
- Animated glyphs (motion on tap to confirm the moving part).
- Color customization per glyph.
- Importing user-uploaded SVGs as custom glyphs.

## Acceptance

- 33 distinct glyph kinds render in `EquipmentGlyph.svelte` without visual regressions on existing tiles.
- The three redrawn glyphs (`preacher`, `chestpress`, `legpress`) read correctly at tile size — the equipment they represent is identifiable without a label.
- Add Equipment sheet step 0 has a working search field and category-grouped grid.
- Search matches both labels and aliases, case-insensitive.
- Existing equipment rows referencing `preacher` / `chestpress` / `legpress` render the new art with no DB change.
- Per-milestone push gate: smoke-tested in a real browser via chrome-devtools MCP before commit.
