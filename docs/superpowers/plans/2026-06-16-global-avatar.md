# Global Avatar Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the uploaded user avatar (with the existing amber initials badge as fallback) on the home and setup pages' top-right icon, via one shared `Avatar` component fed by global layout data.

**Architecture:** A new presentational `Avatar.svelte` owns the image-vs-initials decision. The root `+layout.server.ts` exposes `userName`, `userImage`, and `userImageVersion` (read fresh from the DB so re-uploads aren't masked by a stale session cache). Home and setup pages drop their inline initials markup and render `<Avatar>` from merged layout data. Cache-busting is `?v={updatedAt}`.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Drizzle ORM, Vitest (node env, SSR component test via `svelte/server`).

**Reference spec:** `docs/superpowers/specs/2026-06-16-global-avatar-design.md`

---

## File Structure

- **Create:** `src/lib/components/Avatar.svelte` — presentational avatar (image or initials).
- **Create:** `src/lib/components/Avatar.test.ts` — SSR unit test for the two branches.
- **Modify:** `src/routes/+layout.server.ts` — add `userName`, `userImage`, `userImageVersion` to both return paths; extend the existing `user` select.
- **Modify:** `src/routes/+page.svelte` — swap inline initials anchor for `<Avatar>`, remove now-unused `initial`.
- **Modify:** `src/routes/setup/+page.svelte` — swap inline initials anchor for `<Avatar>`.

---

## Task 1: Avatar component (TDD)

**Files:**
- Create: `src/lib/components/Avatar.svelte`
- Test: `src/lib/components/Avatar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/Avatar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	it('renders the image with a cache-bust query when image is set', () => {
		const { body } = render(Avatar, {
			props: { name: 'Alice', image: '/uploads/avatars/u1.webp', version: 1700 }
		});
		expect(body).toContain('src="/uploads/avatars/u1.webp?v=1700"');
		expect(body).not.toContain('>A<');
	});

	it('falls back to the uppercased initial when no image', () => {
		const { body } = render(Avatar, {
			props: { name: 'alice', image: null, version: 0 }
		});
		expect(body).not.toContain('<img');
		expect(body).toContain('A');
	});

	it('renders empty initial without throwing when name is empty', () => {
		const { body } = render(Avatar, { props: { name: '', image: null, version: 0 } });
		expect(body).not.toContain('<img');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec app pnpm test:unit src/lib/components/Avatar.test.ts`
Expected: FAIL — cannot resolve `./Avatar.svelte` (file does not exist yet).

(If running outside Docker: `pnpm test:unit src/lib/components/Avatar.test.ts`.)

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/components/Avatar.svelte`:

```svelte
<script lang="ts">
	let {
		name,
		image = null,
		version = 0
	}: { name: string; image?: string | null; version?: string | number } = $props();

	const initial = $derived((name ?? '').charAt(0).toUpperCase());
</script>

{#if image}
	<img
		src={`${image}?v=${version}`}
		alt=""
		class="h-9 w-9 flex-shrink-0 rounded-full object-cover"
	/>
{:else}
	<span
		class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
		style="background: var(--color-amber-dim); color: var(--color-amber);"
	>
		{initial}
	</span>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec app pnpm test:unit src/lib/components/Avatar.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Avatar.svelte src/lib/components/Avatar.test.ts
git commit -m "feat: add shared Avatar component (image with initials fallback)"
```

---

## Task 2: Expose user avatar data from the root layout

**Files:**
- Modify: `src/routes/+layout.server.ts`

The existing load already runs one `select` against `user` (for rest settings). Extend that select to also fetch `name`, `image`, `updatedAt`, then return the three new fields. Reading from the DB (not `locals.user`) guarantees a fresh avatar after re-upload. Both return paths (the no-user early return and the main return) must include the keys so the generated `LayoutData` type is consistent.

- [ ] **Step 1: Add the new columns to the existing user select**

In `src/routes/+layout.server.ts`, find the `urow` select (currently selecting `restDefaultSec`, `restTimerEnabled`, `restSoundEnabled`, `restVibrateEnabled`) and add three fields:

```ts
	const urow = (
		await db
			.select({
				restDefaultSec: user.restDefaultSec,
				restTimerEnabled: user.restTimerEnabled,
				restSoundEnabled: user.restSoundEnabled,
				restVibrateEnabled: user.restVibrateEnabled,
				name: user.name,
				image: user.image,
				updatedAt: user.updatedAt
			})
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1)
	)[0];
```

- [ ] **Step 2: Derive the avatar fields after `restSettings`**

Immediately after the `restSettings` object literal, add:

```ts
	const userName = urow?.name ?? '';
	const userImage = urow?.image ?? null;
	const userImageVersion = urow?.updatedAt ? urow.updatedAt.getTime() : 0;
```

- [ ] **Step 3: Add the fields to both return statements**

Update the no-user early return:

```ts
	if (!locals.user) {
		return {
			achievementQueue: [],
			isAdmin: false,
			restSettings: null,
			openRest: null,
			userName: '',
			userImage: null,
			userImageVersion: 0
		};
	}
```

Update the final return:

```ts
	return {
		achievementQueue: rows,
		isAdmin: locals.user.role === 'admin',
		restSettings,
		openRest,
		userName,
		userImage,
		userImageVersion
	};
```

- [ ] **Step 4: Verify types compile**

Run: `docker compose exec app pnpm check`
Expected: no new errors referencing `+layout.server.ts` or `userImage`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.server.ts
git commit -m "feat: expose userName/userImage/userImageVersion from root layout"
```

---

## Task 3: Use Avatar on the home page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Import the component**

In the `<script>` block of `src/routes/+page.svelte`, add to the imports (alongside the other `$lib/components` imports):

```ts
	import Avatar from '$lib/components/Avatar.svelte';
```

- [ ] **Step 2: Remove the now-unused `initial` derived**

Delete this line (currently ~line 270):

```ts
	const initial = $derived(data.userName.charAt(0).toUpperCase());
```

- [ ] **Step 3: Replace the top-right anchor markup**

Replace the existing profile anchor (the `<a href="/profile">` block that renders `{initial}`) with:

```svelte
				<a href="/profile" class="flex-shrink-0" aria-label="Open profile">
					<Avatar
						name={data.userName}
						image={data.userImage}
						version={data.userImageVersion}
					/>
				</a>
```

- [ ] **Step 4: Verify types compile**

Run: `docker compose exec app pnpm check`
Expected: no errors in `src/routes/+page.svelte`; no "initial is declared but never read".

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: show avatar image on home page top-right icon"
```

---

## Task 4: Use Avatar on the setup page

**Files:**
- Modify: `src/routes/setup/+page.svelte`

- [ ] **Step 1: Import the component**

In the `<script>` block of `src/routes/setup/+page.svelte`, add to the `$lib/components` imports:

```ts
	import Avatar from '$lib/components/Avatar.svelte';
```

- [ ] **Step 2: Replace the top-right anchor markup**

Replace the existing profile anchor (the `<a href="/profile">` block that renders `{data.userName.charAt(0).toUpperCase()}`) with:

```svelte
		<a href="/profile" class="flex-shrink-0" aria-label="Open profile">
			<Avatar
				name={data.userName}
				image={data.userImage}
				version={data.userImageVersion}
			/>
		</a>
```

- [ ] **Step 3: Verify types compile**

Run: `docker compose exec app pnpm check`
Expected: no errors in `src/routes/setup/+page.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/setup/+page.svelte
git commit -m "feat: show avatar image on setup page top-right icon"
```

---

## Task 5: Browser verification

Per `CLAUDE.md`: verify in a real browser before pushing. Drive via chrome-devtools MCP.

- [ ] **Step 1: Boot the app**

Run: `docker compose up` (background) and confirm it serves on the dev port. Tail logs for boot errors.

- [ ] **Step 2: Run the full unit + smoke suites**

Run: `docker compose exec app pnpm test:unit && docker compose exec app pnpm test:smoke`
Expected: all pass.

- [ ] **Step 3: Verify the image case**

Log in (admin@trajectory.local / `change-me-on-first-login`). On `/profile`, upload an avatar image. Navigate to `/` (home) and `/setup`.
Expected: the uploaded image appears in the top-right circle on both pages.

- [ ] **Step 4: Verify the fallback case**

On `/profile`, delete the avatar (DELETE handler). Navigate to `/` and `/setup`.
Expected: the amber initials badge renders on both — visually unchanged from before this feature.

- [ ] **Step 5: Verify cache-bust on re-upload**

Upload a *different* image on `/profile`, then navigate to `/`.
Expected: the new image shows without a hard refresh (the `?v=` value changed because `updatedAt` bumped).

- [ ] **Step 6: Check the console**

Inspect the browser console on `/`, `/setup`, `/profile`.
Expected: no errors (no 404 on the avatar URL, no hydration warnings about the avatar).

- [ ] **Step 7: Final lint**

Run: `docker compose exec app pnpm lint`
Expected: passes. Run `pnpm format` if it flags formatting, then re-commit.

---

## Self-Review Notes

- **Spec coverage:** shared component (Task 1) ✓; global layout data with cache-bust version (Task 2) ✓; swap home + setup (Tasks 3, 4) ✓; profile left untouched (no task touches it) ✓; fallback unchanged (Task 1 initials branch + Task 5 step 4) ✓.
- **Deviation from spec:** spec listed `size: 'sm' | 'md'` props. Both call sites use the identical `h-9 w-9` size, so the component hard-codes that size (YAGNI) — no `size` prop until a second size is actually needed. `userImageVersion` uses `updatedAt.getTime()` (a number) as the cache-bust value.
- **Type consistency:** prop names `name` / `image` / `version` are identical across the component, its test, and both call sites. Layout keys `userName` / `userImage` / `userImageVersion` match the props passed in Tasks 3–4.
- **Note on staleness:** layout reads `image`/`updatedAt` from the DB (not `locals.user`), so a fresh avatar shows on the next navigation after upload even if the Better Auth session cache is stale.
