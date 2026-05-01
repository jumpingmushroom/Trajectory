<script lang="ts">
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import type { PageData } from './$types';
	import { mutate } from '$lib/mutate';
	import { goto, invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.session);

	const UNDO_WINDOW_MS = 10_000;
	// Survives a SvelteKit invalidateAll that may remount this component
	// (which would otherwise reset local $state). The key encodes the
	// session id so two simultaneous tabs on different sessions don't
	// collide. Stored as the timestamp at which the undo window expires.
	const UNDO_KEY_PREFIX = 'trajectory.undoUntil.';

	let ending = $state(false);
	let endError = $state<string | null>(null);
	let undoUntil = $state<number | null>(null);
	let undoNow = $state(Date.now());
	let undoTimer: ReturnType<typeof setInterval> | null = null;

	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let pendingDelete = $state(false);

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

	function clearUndoStorage(id: string) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.removeItem(UNDO_KEY_PREFIX + id);
	}

	$effect(() => {
		// On (re)mount, hydrate undoUntil from sessionStorage so a remount
		// triggered by invalidateAll() doesn't lose the toast state.
		const stored = readUndoFromStorage(s.id);
		if (stored != null) {
			undoUntil = stored;
			undoNow = Date.now();
			startUndoTicker();
		}
	});

	onDestroy(() => {
		if (undoTimer != null) clearInterval(undoTimer);
	});

	function startUndoTicker() {
		if (undoTimer != null) clearInterval(undoTimer);
		undoTimer = setInterval(() => {
			undoNow = Date.now();
			if (undoUntil != null && undoNow >= undoUntil) {
				undoUntil = null;
				clearUndoStorage(s.id);
				if (undoTimer != null) {
					clearInterval(undoTimer);
					undoTimer = null;
				}
			}
		}, 250);
	}

	function armUndo() {
		const until = Date.now() + UNDO_WINDOW_MS;
		undoUntil = until;
		undoNow = Date.now();
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(UNDO_KEY_PREFIX + s.id, String(until));
		}
		startUndoTicker();
	}

	const undoRemainingMs = $derived(
		undoUntil == null ? 0 : Math.max(0, undoUntil - undoNow)
	);

	async function handleEnd() {
		if (ending || !s.isOpen) return;
		ending = true;
		endError = null;
		armUndo();
		try {
			await mutate('session.end', { id: s.id });
		} catch (err) {
			endError = err instanceof Error ? err.message : 'Could not end session.';
			undoUntil = null;
			clearUndoStorage(s.id);
			if (undoTimer != null) {
				clearInterval(undoTimer);
				undoTimer = null;
			}
		} finally {
			ending = false;
		}
	}

	async function handleUndo() {
		if (!undoUntil) return;
		undoUntil = null;
		clearUndoStorage(s.id);
		if (undoTimer != null) {
			clearInterval(undoTimer);
			undoTimer = null;
		}
		try {
			await mutate('session.endUndo', { id: s.id });
		} catch (err) {
			endError = err instanceof Error ? err.message : 'Could not undo.';
		}
	}

	async function handleDelete() {
		pendingDelete = false;
		if (deleting) return;
		deleting = true;
		deleteError = null;
		try {
			await mutate('session.delete', { id: s.id });
			await goto('/history');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Could not delete session.';
			deleting = false;
		}
	}

	function fmtNum(n: number | null): string {
		if (n == null) return '—';
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function formatVol(kg: number): string {
		const rounded = Math.round(kg);
		return `${rounded.toLocaleString('en-US').replace(/,/g, ' ')} kg`;
	}

	function timeOnly(ms: number): string {
		const d = new Date(ms);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function dayLabel(dayOffset: number, startedAt: number): string {
		if (dayOffset === 0) return 'Today';
		if (dayOffset === 1) return 'Yesterday';
		if (dayOffset < 14) return `${dayOffset} days ago`;
		const d = new Date(startedAt);
		return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function cardioSummary(extras: Record<string, number> | null): string[] {
		if (!extras) return [];
		const out: string[] = [];
		if (typeof extras.distance === 'number') {
			if (extras.distance >= 200 && Number.isInteger(extras.distance)) out.push(`${extras.distance} m`);
			else out.push(`${fmtNum(extras.distance)} km`);
		}
		if (typeof extras.incline === 'number') out.push(`${fmtNum(extras.incline)}%`);
		if (typeof extras.level === 'number') out.push(`L${extras.level}`);
		if (typeof extras.rpm === 'number') out.push(`${extras.rpm} rpm`);
		if (typeof extras.spm === 'number') out.push(`${extras.spm} spm`);
		if (typeof extras.split === 'number') out.push(`${extras.split}s/500`);
		if (typeof extras.hr === 'number') out.push(`${extras.hr} bpm`);
		if (typeof extras.calories === 'number') out.push(`${extras.calories} kcal`);
		return out;
	}
</script>

<svelte:head>
	<title>Session · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pt-12 pb-12">
	<header class="flex items-start gap-3">
		<a
			href="/history"
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Back to history"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<path d="M15 6l-6 6 6 6"/>
			</svg>
		</a>
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				{s.gymName}
			</div>
			<div
				class="mt-0.5 text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{dayLabel(s.dayOffset, s.startedAt)}
				{#if s.isOpen}
					<span
						class="ml-1 align-middle rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
						style="background: var(--color-amber-dim); color: var(--color-amber);"
					>
						Live
					</span>
				{/if}
			</div>
		</div>
	</header>

	<section class="mt-4 grid grid-cols-3 gap-2">
		<div
			class="flex flex-col gap-1 rounded-xl border p-3"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[9px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Duration
			</div>
			<div
				class="text-[18px] font-bold tabular-nums tracking-[-0.01em]"
				style="color: var(--color-text);"
			>
				{s.durationMin} min
			</div>
		</div>
		<div
			class="flex flex-col gap-1 rounded-xl border p-3"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[9px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Machines
			</div>
			<div
				class="text-[18px] font-bold tabular-nums tracking-[-0.01em]"
				style="color: var(--color-text);"
			>
				{s.machineCount}
			</div>
		</div>
		<div
			class="flex flex-col gap-1 rounded-xl border p-3"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[9px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Volume
			</div>
			<div
				class="text-[18px] font-bold tabular-nums tracking-[-0.01em]"
				style="color: var(--color-text);"
			>
				{s.totalVolume > 0 ? formatVol(s.totalVolume) : '—'}
			</div>
		</div>
	</section>

	<section class="mt-5 flex flex-col gap-4">
		{#each data.blocks as block (block.equipment.id)}
			<div class="flex flex-col gap-2">
				<a
					href={`/equipment/${block.equipment.id}`}
					class="flex items-center gap-3 px-1"
				>
					<div
						class="h-9 w-9 flex-shrink-0 rounded-lg border p-1.5"
						style="background: linear-gradient(135deg, {block.equipment.tint}, var(--color-bg)); border-color: var(--color-line-2);"
					>
						<EquipmentGlyph kind={block.equipment.glyph as GlyphKind} />
					</div>
					<div class="flex flex-1 flex-col">
						<div class="text-[14px] font-semibold" style="color: var(--color-text);">
							{block.equipment.name}
						</div>
						<div class="text-[10px] capitalize" style="color: var(--color-text-dim-2);">
							{block.equipment.type}{block.equipment.cardioKind
								? ` · ${block.equipment.cardioKind}`
								: ''}
						</div>
					</div>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-dim-2);">
						<path d="M9 6l6 6-6 6"/>
					</svg>
				</a>

				<ul class="flex flex-col gap-1.5">
					{#each block.sets as set, i (set.id)}
						<li
							class="flex items-center gap-3 rounded-xl border px-3 py-2 tabular-nums"
							style="background: var(--color-surface-2); border-color: var(--color-line);"
						>
							<div
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
								style="background: var(--color-surface-3); color: var(--color-text-dim);"
							>
								{i + 1}
							</div>
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
								<div class="flex flex-1 items-baseline gap-2 text-[13px]" style="color: var(--color-text);">
									{#if !set.exerciseIsHidden && set.exerciseName !== block.equipment.name}
										<span class="text-[10px]" style="color: var(--color-text-dim);">
											{set.exerciseName}
										</span>
									{/if}
									<span class="font-semibold">{fmtNum(set.weight)}</span>
									<span class="text-[10px]" style="color: var(--color-text-dim-2);">kg</span>
									<span style="color: var(--color-text-dim-2);">×</span>
									<span class="font-semibold">{set.reps ?? '—'}</span>
								</div>
							{/if}
							<div class="text-[10px]" style="color: var(--color-text-dim-2);">
								{timeOnly(set.ts)}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>

	{#if data.blocks.length === 0}
		<div
			class="mt-6 rounded-2xl border-2 border-dashed p-6 text-center text-[13px]"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			No sets in this session yet.
		</div>
	{/if}

	{#if s.isOpen}
		<div class="mt-8 flex flex-col gap-2">
			<button
				type="button"
				class="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-bold disabled:opacity-60"
				style="background: var(--color-amber); color: #1b0a00;"
				disabled={ending}
				onclick={handleEnd}
			>
				{ending ? 'Ending…' : 'End session'}
			</button>
			{#if endError}
				<div class="text-center text-[12px]" style="color: var(--color-text-dim);">
					{endError}
				</div>
			{/if}
		</div>
	{/if}

	{#if s.setCount === 0}
		<div class="mt-3 flex flex-col gap-2">
			<button
				type="button"
				class="flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
				style="border-color: var(--color-line-2); color: var(--color-text-dim);"
				disabled={deleting}
				onclick={() => (pendingDelete = true)}
			>
				{deleting ? 'Deleting…' : 'Delete session'}
			</button>
			{#if deleteError}
				<div class="text-center text-[12px]" style="color: var(--color-text-dim);">
					{deleteError}
				</div>
			{/if}
		</div>
	{/if}
</main>

{#if undoUntil != null && undoRemainingMs > 0}
	<div
		class="fixed inset-x-0 z-20 mx-auto flex w-full max-w-[480px] items-center gap-3 px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 16px);"
	>
		<div
			class="flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3"
			style="background: var(--color-surface); border-color: var(--color-line-2); backdrop-filter: blur(8px);"
		>
			<div class="flex flex-1 flex-col">
				<div class="text-[13px] font-semibold" style="color: var(--color-text);">
					Session ended
				</div>
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

{#if pendingDelete}
	<ConfirmDialog
		title="Delete this session?"
		description="It has no sets logged. Deleting removes the row entirely."
		confirmLabel="Delete"
		danger
		onConfirm={handleDelete}
		onCancel={() => (pendingDelete = false)}
	/>
{/if}
