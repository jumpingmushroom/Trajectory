# Global Avatar Image — Design

**Date:** 2026-06-16
**Status:** Approved, pending implementation

## Problem

The uploaded user avatar image only renders on the profile edit page
(`src/routes/profile/+page.svelte`). Everywhere else that an avatar appears —
the home page top-right icon and the setup page — shows only the user's initial
in an amber circle badge. The uploaded image (`user.image`) is ignored on those
surfaces.

There is no shared header/nav component; each page renders its own avatar
markup, so the initials-only logic is duplicated.

## Goal

Show the real uploaded avatar image (with the existing initials badge as a
fallback when no image is set) consistently on every surface that currently
renders an avatar/initial: home and setup pages. Do this via one shared
component so the logic lives in a single place.

## Current state (as found)

- **Upload:** `POST /api/profile/avatar` resizes to 256×256 WEBP, writes
  `data/uploads/avatars/<userId>.webp`, and saves the public path
  `/uploads/avatars/<userId>.webp` to `user.image`. Upload also bumps
  `user.updatedAt`.
- **Serving:** `/uploads/[...path]/+server.ts` serves the file with a 30-day
  immutable cache header.
- **Display today:**
  - Profile edit (`profile/+page.svelte`): renders `<img src={image}?v={avatarVersion}>`
    with initials/icon fallback.
  - Home (`+page.svelte`, top-right) and setup (`setup/+page.svelte`): render
    `{initial}` only, derived from `userName.charAt(0)`.
- **Layout:** root `+layout.svelte` has no header. Root `+layout.server.ts` does
  not return user name/image; each page loads what it needs.
- **User shape:** `locals.user` (Better Auth) includes `image` and `updatedAt`.

## Design

### 1. Shared `Avatar` component

New file: `src/lib/components/Avatar.svelte`.

- **Props:**
  - `name: string` — used to derive the initial fallback (`name.charAt(0).toUpperCase()`).
  - `image: string | null` — public avatar path, or null.
  - `version: string | number` — cache-bust value (the user's `updatedAt`).
  - `size: 'sm' | 'md'` (or equivalent) — maps to height/width classes.
- **Render:**
  - If `image` is set: `<img src={`${image}?v=${version}`} alt="" class="…object-cover" />`
    inside the rounded container.
  - Else: the amber initial circle, preserving the current styling
    (`background: var(--color-amber-dim); color: var(--color-amber);`).
- Owns the image-vs-initials decision in one place.

### 2. Expose user data globally

In `src/routes/+layout.server.ts`, add to the returned data:

- `userName` — display name.
- `userImage` — `locals.user.image ?? null`.
- `userImageVersion` — `locals.user.updatedAt` (timestamp used as cache-bust).

These become available to every route through layout data.

### 3. Swap in the component

- **Home** (`src/routes/+page.svelte`): replace the inline top-right initials
  anchor markup with `<Avatar … />` reading from layout data. Keep it wrapped in
  the existing `<a href="/profile">`.
- **Setup** (`src/routes/setup/+page.svelte`): replace its inline initials markup
  with `<Avatar … />`.
- Both stop deriving their own `initial` for this purpose and read
  `userName` / `userImage` / `userImageVersion` from layout data.

### 4. Profile edit page — out of scope

Leave `profile/+page.svelte` as-is. It already shows the image and has the
upload/edit overlay. It may adopt `Avatar` later, but not in this change.

## Cache invalidation

The avatar file path is fixed per user and served immutable for 30 days.
Appending `?v={updatedAt}` makes the URL change whenever a new image is
uploaded (upload bumps `updatedAt`), so re-uploads display immediately. No
schema change.

## Behavior in edge cases

- **No image set:** `Avatar` renders the same amber initials badge as today —
  zero visual change on those surfaces.
- **Offline / missing file:** the `<img>` falls back to the browser's
  broken-image behavior. Accepted as simple; not specially handled.

## Non-goals

- No shared header/nav component refactor.
- No change to upload/serving pipeline or DB schema.
- No avatar on the tab bar or new surfaces beyond home/setup.
- No refactor of the profile edit page.

## Verification

Boot in Docker, drive via chrome-devtools MCP:

- Profile with an uploaded image → image appears top-right on home and on setup.
- Profile with no image → initials badge unchanged on both.
- Re-upload a new image → new image shows on home/setup without a hard refresh
  (cache-bust via updated `?v=`).
- Check the console for errors.
