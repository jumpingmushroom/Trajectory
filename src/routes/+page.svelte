<script lang="ts">
	import { onDestroy } from 'svelte';
	import EquipmentTile from '$lib/components/EquipmentTile.svelte';
	import GymChip from '$lib/components/GymChip.svelte';
	import GymSheet from '$lib/components/GymSheet.svelte';
	import SessionBar from '$lib/components/SessionBar.svelte';
	import BackdatedSessionPreview from '$lib/components/BackdatedSessionPreview.svelte';
	import DateChip from '$lib/components/DateChip.svelte';
	import DateModeSheet from '$lib/components/DateModeSheet.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import { withDateMode } from '$lib/dateMode';
	import { mutate, ulid } from '$lib/mutate';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let starting = $state(false);
	let startError = $state<string | null>(null);

	async function handleStartSession() {
		if (starting) return;
		starting = true;
		startError = null;
		try {
			await mutate('session.start', {
				id: ulid(),
				gymId: data.activeGym.id
			});
		} catch (err) {
			startError = err instanceof Error ? err.message : 'Could not start session.';
		} finally {
			starting = false;
		}
	}

	// End-session flow. Mirrors /sessions/[id]: optimistic end + 10s undo
	// toast, undoUntil persisted to sessionStorage so the toast survives
	// the SvelteKit invalidate that unmounts SessionBar after the session
	// closes. Uses the same key prefix as /sessions/[id] so a toast armed
	// here can be cleared from there (and vice versa).
	const UNDO_WINDOW_MS = 10_000;
	const UNDO_KEY_PREFIX = 'trajectory.undoUntil.';

	let ending = $state(false);
	let endError = $state<string | null>(null);
	let endingId = $state<string | null>(null);
	let undoUntil = $state<number | null>(null);
	let undoNow = $state(Date.now());
	let undoTimer: ReturnType<typeof setInterval> | null = null;

	function readUndoFromStorage(id: string): number | null {
		if (typeof sessionStorage === 'undefined') return null;
		const raw = sessionStorage.getItem(UNDO_KEY_PREFIX + id);
		if (!raw) return null;
		const ts = Number(raw);
		if (!Number.isFinite(ts) || ts <= Date.now()) {
			sessionStorage.removeItem(UNDO_KEY_PREFIX + id);
			return null;
		}
		return ts;
	}

	// Scan storage for any still-valid undo key. Used on mount when the
	// session id is no longer in `data.activeSession` (post-reload, after
	// the optimistic end has been confirmed server-side).
	function findStoredUndo(): { id: string; until: number } | null {
		if (typeof sessionStorage === 'undefined') return null;
		let best: { id: string; until: number } | null = null;
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (!key || !key.startsWith(UNDO_KEY_PREFIX)) continue;
			const id = key.slice(UNDO_KEY_PREFIX.length);
			const until = readUndoFromStorage(id);
			if (until == null) continue;
			if (!best || until > best.until) best = { id, until };
		}
		return best;
	}

	function clearUndoStorage(id: string) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.removeItem(UNDO_KEY_PREFIX + id);
	}

	function startUndoTicker() {
		if (undoTimer != null) clearInterval(undoTimer);
		undoTimer = setInterval(() => {
			undoNow = Date.now();
			if (undoUntil != null && undoNow >= undoUntil) {
				undoUntil = null;
				if (endingId) clearUndoStorage(endingId);
				endingId = null;
				if (undoTimer != null) {
					clearInterval(undoTimer);
					undoTimer = null;
				}
			}
		}, 250);
	}

	$effect(() => {
		// Hydrate undoUntil on (re)mount. Prefer the id of a still-open
		// session if one exists; otherwise scan storage for any key (covers
		// the reload-during-undo path where activeSession is already null
		// because the optimistic end has been confirmed).
		if (undoUntil != null) return;
		const openId = data.activeSession?.id;
		if (openId) {
			const stored = readUndoFromStorage(openId);
			if (stored != null) {
				endingId = openId;
				undoUntil = stored;
				undoNow = Date.now();
				startUndoTicker();
				return;
			}
		}
		const found = findStoredUndo();
		if (found) {
			endingId = found.id;
			undoUntil = found.until;
			undoNow = Date.now();
			startUndoTicker();
		}
	});

	onDestroy(() => {
		if (undoTimer != null) clearInterval(undoTimer);
	});

	async function handleEnd() {
		const open = data.activeSession;
		if (!open || ending) return;
		ending = true;
		endError = null;
		endingId = open.id;
		const until = Date.now() + UNDO_WINDOW_MS;
		undoUntil = until;
		undoNow = Date.now();
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(UNDO_KEY_PREFIX + open.id, String(until));
		}
		startUndoTicker();
		try {
			await mutate('session.end', { id: open.id });
		} catch (err) {
			endError = err instanceof Error ? err.message : 'Could not end session.';
			undoUntil = null;
			clearUndoStorage(open.id);
			endingId = null;
			if (undoTimer != null) {
				clearInterval(undoTimer);
				undoTimer = null;
			}
		} finally {
			ending = false;
		}
	}

	async function handleUndo() {
		const id = endingId;
		if (!undoUntil || !id) return;
		undoUntil = null;
		clearUndoStorage(id);
		endingId = null;
		if (undoTimer != null) {
			clearInterval(undoTimer);
			undoTimer = null;
		}
		try {
			await mutate('session.endUndo', { id });
		} catch (err) {
			endError = err instanceof Error ? err.message : 'Could not undo.';
		}
	}

	const undoRemainingMs = $derived(undoUntil == null ? 0 : Math.max(0, undoUntil - undoNow));

	type Filter = 'all' | 'push' | 'pull' | 'legs' | 'core' | 'cardio';
	const filters: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'push', label: 'Push' },
		{ id: 'pull', label: 'Pull' },
		{ id: 'legs', label: 'Legs' },
		{ id: 'core', label: 'Core' },
		{ id: 'cardio', label: 'Cardio' }
	];

	let filter = $state<Filter>('all');
	let gymSheetOpen = $state(false);
	let dateSheetOpen = $state(false);

	const asOfTs = $derived(data.asOfTs);

	const visibleTiles = $derived(
		filter === 'all'
			? [...data.tiles].sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999))
			: data.tiles
					.filter((t) => t.equipment.group === filter)
					.sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999))
	);

	const initial = $derived(data.userName.charAt(0).toUpperCase());
</script>

<svelte:head>
	<title>Trajectory</title>
</svelte:head>

<main
	class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pt-12 pb-32"
	style="background-image: radial-gradient(1200px 600px at 50% 0%, rgba(255,140,66,0.06), transparent 70%);"
>
	<header class="flex flex-col gap-3">
		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold tracking-[0.16em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Trajectory
				</div>
				<div class="mt-0.5">
					<DateChip {asOfTs} onOpen={() => (dateSheetOpen = true)} />
				</div>
			</div>
			<GymChip gym={data.activeGym} onClick={() => (gymSheetOpen = true)} />
			<a
				href="/profile"
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
				style="background: var(--color-amber-dim); color: var(--color-amber);"
				aria-label="Open profile"
			>
				{initial}
			</a>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
			{#each filters as f (f.id)}
				<button
					type="button"
					class="flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium"
					style="background: {filter === f.id
						? 'var(--color-amber-dim)'
						: 'transparent'}; border-color: {filter === f.id
						? 'var(--color-amber-line)'
						: 'var(--color-line-2)'}; color: {filter === f.id
						? 'var(--color-amber)'
						: 'var(--color-text-dim)'};"
					onclick={() => (filter = f.id)}
					aria-pressed={filter === f.id}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</header>

	<div class="mt-3">
		<InstallPrompt />
	</div>

	{#if asOfTs == null && data.activeSession == null && data.tiles.length > 0}
		<button
			type="button"
			class="mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold disabled:opacity-60"
			style="background: var(--color-amber-dim); color: var(--color-amber); border: 1px solid var(--color-amber-line);"
			disabled={starting}
			onclick={handleStartSession}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polygon points="6 4 20 12 6 20 6 4" />
			</svg>
			{starting ? 'Starting…' : 'Start session'}
		</button>
		{#if startError}
			<div class="mt-2 text-center text-[12px]" style="color: var(--color-text-dim);">
				{startError}
			</div>
		{/if}
	{/if}

	{#if data.tiles.length === 0}
		<section
			class="mt-8 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center"
			style="border-color: var(--color-line-2);"
		>
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				{data.activeGym.name}
			</div>
			<div class="text-[16px] font-semibold" style="color: var(--color-text);">
				No equipment yet
			</div>
			<div class="max-w-[28ch] text-[13px]" style="color: var(--color-text-dim);">
				Add your first machine in Setup so you have something to log against.
			</div>
			<a
				href="/setup"
				class="mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				Open Setup
			</a>
		</section>
	{:else if visibleTiles.length === 0}
		<section
			class="mt-6 rounded-2xl border-2 border-dashed p-6 text-center text-[13px]"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			Nothing in this category yet.
		</section>
	{:else}
		<section class="mt-3 grid grid-cols-2 gap-3">
			{#each visibleTiles as tile (tile.equipment.id)}
				<EquipmentTile
					equipment={tile.equipment}
					lastWeight={tile.lastWeight}
					lastReps={tile.lastReps}
					lastDurationMin={tile.lastDurationMin}
					lastDistance={tile.lastDistance}
					lastBwLoadKg={tile.lastBwLoadKg}
					daysSince={tile.daysSince}
					href={withDateMode(`/log/${tile.equipment.id}`, asOfTs)}
				/>
			{/each}
		</section>
	{/if}

	<a
		href="/setup"
		class="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-dashed py-3 text-[13px] font-semibold"
		style="border-color: var(--color-line-2); color: var(--color-amber);"
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
		Add equipment
	</a>
</main>

{#if asOfTs != null}
	<BackdatedSessionPreview {asOfTs} session={data.backdatedSession} />
{:else if data.activeSession}
	<SessionBar
		id={data.activeSession.id}
		startedAt={data.activeSession.startedAt}
		setCount={data.activeSession.setCount}
		lastSetTs={data.activeSession.lastSetTs}
		lastEquipmentName={data.activeSession.lastEquipmentName}
		lastEquipmentId={data.activeSession.lastEquipmentId}
		onStop={handleEnd}
		{ending}
	/>
{/if}

{#if undoUntil != null && undoRemainingMs > 0}
	<div
		class="fixed inset-x-0 z-30 mx-auto flex w-full max-w-[480px] items-center gap-3 px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 65px);"
	>
		<div
			class="flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3"
			style="background: var(--color-surface); border-color: var(--color-line-2); backdrop-filter: blur(8px);"
		>
			<div class="flex flex-1 flex-col">
				<div class="text-[13px] font-semibold" style="color: var(--color-text);">Session ended</div>
				<div class="text-[11px]" style="color: var(--color-text-dim-2);">
					{Math.ceil(undoRemainingMs / 1000)}s to undo
				</div>
			</div>
			<button
				type="button"
				class="rounded-full px-3 py-1.5 text-[12px] font-bold"
				style="background: var(--color-amber-dim); color: var(--color-amber);"
				onclick={handleUndo}
			>
				Undo
			</button>
		</div>
	</div>
{/if}

{#if endError}
	<div
		class="fixed inset-x-0 z-20 mx-auto flex w-full max-w-[480px] px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 16px);"
	>
		<div
			class="flex-1 rounded-2xl border px-4 py-3 text-center text-[12px]"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			{endError}
		</div>
	</div>
{/if}

<TabBar active="home" />

{#if gymSheetOpen}
	<GymSheet
		gyms={data.gyms}
		activeGymId={data.activeGym.id}
		onClose={() => (gymSheetOpen = false)}
	/>
{/if}

{#if dateSheetOpen}
	<DateModeSheet {asOfTs} onClose={() => (dateSheetOpen = false)} />
{/if}
