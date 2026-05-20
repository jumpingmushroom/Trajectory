<script lang="ts">
	import { mutate } from '$lib/mutate';
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import { page } from '$app/state';
	import { parseAsOfTs, withDateMode } from '$lib/dateMode';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const asOfTs = $derived(parseAsOfTs(page.url.searchParams));

	const eq = $derived(data.equipment);
	const isCardio = $derived(eq.type === 'cardio');
	const mode = $derived(eq.inputMode ?? 'weighted');
	// Display unit for the LineChart axis. Cardio + timed plot minutes;
	// everything else (including weight_distance carries and timed_weighted
	// holds) plots kg, matching the PR axis chosen in evaluatePr.
	const seriesUnit = $derived<'kg' | 'min'>(
		mode === 'distance_time' || mode === 'timed' ? 'min' : 'kg'
	);
	const photoSrc = $derived(
		eq.photoPath ? `/uploads/${eq.photoPath}?v=${eq.updatedAt.getTime()}` : null
	);
	const lastSparkline = $derived(data.series.slice(-10));

	let notesDraft = $state('');
	let savingNotes = $state(false);
	let notesError = $state<string | null>(null);
	let notesPristine = $derived(notesDraft === (eq.notes ?? ''));

	// Bodyweight section: editing pct in % units (0..200) but persisted as
	// decimal (0..2). Local state lives only while editing — re-hydrates
	// from server state on close.
	let bwEditing = $state(false);
	let bwOn = $state(eq.bodyweightPct != null);
	let bwPctPercent = $state<number>(Math.round((eq.bodyweightPct ?? 0) * 100) || 100);
	let bwSaving = $state(false);
	let bwError = $state<string | null>(null);

	$effect(() => {
		// Keep local toggle/value in sync if the server row changes
		// (e.g. after invalidateAll on an unrelated mutation).
		if (!bwEditing) {
			bwOn = eq.bodyweightPct != null;
			bwPctPercent = Math.round((eq.bodyweightPct ?? 0) * 100) || 100;
		}
	});

	async function saveBodyweightPct() {
		bwError = null;
		bwSaving = true;
		try {
			const next = bwOn ? Math.max(0, Math.min(200, bwPctPercent)) / 100 : null;
			await mutate('equipment.update', { id: eq.id, bodyweightPct: next });
			bwEditing = false;
		} catch (err) {
			bwError = err instanceof Error ? err.message : 'Could not save body weight load.';
		} finally {
			bwSaving = false;
		}
	}

	$effect(() => {
		// Re-hydrate the textarea when navigating to a different equipment
		// page (or when invalidateAll refreshes notes from the server after
		// a save). Doesn't touch the draft if the user hasn't saved yet
		// because the comparison would always be against the latest server
		// notes.
		notesDraft = eq.notes ?? '';
	});

	async function saveNotes() {
		if (notesPristine) return;
		savingNotes = true;
		notesError = null;
		try {
			await mutate('equipment.update', {
				id: eq.id,
				notes: notesDraft.length === 0 ? null : notesDraft
			});
		} catch (err) {
			notesError = err instanceof Error ? err.message : 'Could not save note.';
		} finally {
			savingNotes = false;
		}
	}

	function fmtNum(n: number | null): string {
		if (n == null) return '—';
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function fmtClock(min: number): string {
		const total = Math.max(0, Math.round(min * 60));
		const m = Math.floor(total / 60);
		const s = String(total % 60).padStart(2, '0');
		return `${m}:${s}`;
	}

	function fmtDistance(m: number): string {
		if (m >= 500 || !Number.isInteger(m)) return `${(m / 1000).toFixed(2)} km`;
		return `${m} m`;
	}

	function fmtLast(): string {
		if (data.daysSinceLast == null) return 'Never logged';
		const ago =
			data.daysSinceLast === 0
				? 'today'
				: data.daysSinceLast === 1
					? '1 day ago'
					: `${data.daysSinceLast} days ago`;
		// Read the last set's own shape — covers timed-only holds, weighted
		// holds, carries, cardio, weighted strength, and bodyweight strength.
		const lastDistance = data.lastDistance;
		if (data.lastWeight != null && typeof lastDistance === 'number') {
			return `${fmtNum(data.lastWeight)} kg × ${fmtDistance(lastDistance)} · ${ago}`;
		}
		if (data.lastDurationMin != null && data.lastWeight != null && data.lastReps == null) {
			// Weighted timed hold.
			return `${fmtClock(data.lastDurationMin)} × ${fmtNum(data.lastWeight)} kg · ${ago}`;
		}
		if (data.lastDurationMin != null && data.lastWeight == null && data.lastReps == null) {
			// Plain timed hold (no weight, no reps). Distinguish from cardio
			// (which has reps == null too but typically has extras populated)
			// by checking the equipment's mode.
			if (mode === 'timed') return `${fmtClock(data.lastDurationMin)} · ${ago}`;
			return `${fmtNum(data.lastDurationMin)} min · ${ago}`;
		}
		if (data.lastDurationMin != null) {
			return `${fmtNum(data.lastDurationMin)} min · ${ago}`;
		}
		if (data.lastWeight != null && data.lastReps != null) {
			// Effective load if the last set carried a bodyweight snapshot —
			// keeps this label aligned with the per-set rows on the session
			// page and the live preview on the log screen.
			const display = data.lastWeight + (data.lastBwLoadKg ?? 0);
			return `${fmtNum(display)} kg × ${data.lastReps} · ${ago}`;
		}
		return ago;
	}

	function capitalizeWord(s: string): string {
		return s.length ? s[0].toUpperCase() + s.slice(1) : s;
	}

	const metaTiles = $derived([
		{
			label: 'PR',
			value: (() => {
				if (data.pr == null) return '—';
				if (mode === 'timed') return fmtClock(data.pr);
				if (mode === 'distance_time') {
					return eq.cardioKind === 'rower' ? `${fmtNum(data.pr)} m` : `${fmtNum(data.pr)} km`;
				}
				// weighted | bodyweight | timed_weighted | weight_distance
				return `${fmtNum(data.pr)} kg`;
			})()
		},
		{ label: 'Sessions', value: String(data.sessionsCount) },
		{
			label: isCardio ? 'Type' : 'Sets',
			value: isCardio ? capitalizeWord(eq.cardioKind ?? 'Cardio') : String(data.setsCount)
		}
	]);
</script>

<svelte:head>
	<title>{eq.name} · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pt-12 pb-24">
	<header class="flex items-start gap-3">
		<a
			href={withDateMode('/', asOfTs)}
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Back"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M15 6l-6 6 6 6" />
			</svg>
		</a>
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.16em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				{isCardio ? 'CARDIO' : 'EQUIPMENT'}
			</div>
			<div
				class="mt-0.5 truncate text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{eq.name}
			</div>
		</div>
	</header>

	<section
		class="relative mt-4 aspect-[16/9] overflow-hidden rounded-2xl border"
		style="background: linear-gradient(135deg, {eq.tint} 0%, var(--color-bg) 100%); border-color: var(--color-line);"
	>
		{#if photoSrc}
			<img src={photoSrc} alt={eq.name} class="absolute inset-0 h-full w-full object-cover" />
		{:else}
			<div class="absolute inset-6">
				<EquipmentGlyph kind={eq.glyph as GlyphKind} />
			</div>
		{/if}
		{#if data.series.length >= 2}
			<div
				class="absolute right-2 bottom-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
				style="background: rgba(13,15,18,0.8); border-color: var(--color-line-2); backdrop-filter: blur(6px);"
			>
				<Sparkline data={lastSparkline} width={70} height={20} />
				<span class="text-[10px] tabular-nums" style="color: var(--color-text-dim);">
					{(() => {
						const delta = data.series[data.series.length - 1] - data.series[0];
						if (delta === 0) return `flat ${seriesUnit}`;
						const arrow = delta > 0 ? '▲' : '▼';
						return `${arrow} ${fmtNum(Math.abs(delta))} ${seriesUnit}`;
					})()}
				</span>
			</div>
		{/if}
	</section>

	<a
		href={withDateMode(`/log/${eq.id}`, asOfTs)}
		class="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold"
		style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 6px 18px var(--color-amber-glow);"
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
		Log a set
	</a>

	<div class="mt-3 flex items-center gap-2 text-[12px]" style="color: var(--color-text-dim-2);">
		<span class="h-1.5 w-1.5 rounded-full" style="background: var(--color-text-dim-2);"></span>
		Last time: <span style="color: var(--color-text-dim);">{fmtLast()}</span>
	</div>

	<section class="mt-4 grid grid-cols-3 gap-2">
		{#each metaTiles as t (t.label)}
			<div
				class="flex flex-col gap-1 rounded-xl border p-3"
				style="background: var(--color-surface); border-color: var(--color-line);"
			>
				<div
					class="text-[9px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					{t.label}
				</div>
				<div
					class="text-[18px] font-bold tracking-[-0.01em] tabular-nums"
					style="color: var(--color-text);"
				>
					{t.value}
				</div>
			</div>
		{/each}
	</section>

	<section
		class="mt-4 rounded-2xl border p-3 pt-3"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-baseline justify-between px-1 pb-2">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Top-set progression
			</div>
			<div class="text-[11px] tabular-nums" style="color: var(--color-text-dim);">
				{data.series.length > 0
					? `${data.series.length} session${data.series.length === 1 ? '' : 's'}`
					: 'No data yet'}
			</div>
		</div>
		<LineChart data={data.series} width={420} height={170} unit={seriesUnit} />
	</section>

	{#if data.commonWeights.length > 0 && !isCardio}
		<section
			class="mt-3 rounded-2xl border p-4"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Weights you actually use
			</div>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each data.commonWeights as w (w)}
					<span
						class="rounded-full border px-3 py-1 text-[12px] font-medium tabular-nums"
						style="background: var(--color-amber-dim); border-color: var(--color-amber-line); color: var(--color-amber);"
					>
						{fmtNum(w)} kg
					</span>
				{/each}
			</div>
		</section>
	{/if}

	{#if !isCardio}
		<section
			class="mt-3 flex flex-col gap-2 rounded-2xl border p-4"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div class="flex items-baseline justify-between">
				<div
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Body weight load
				</div>
				{#if !bwEditing}
					<button
						type="button"
						class="text-[12px]"
						style="color: var(--color-text-dim);"
						onclick={() => (bwEditing = true)}
					>
						Edit
					</button>
				{/if}
			</div>

			{#if !bwEditing}
				<div class="text-[14px]" style="color: var(--color-text);">
					{#if eq.bodyweightPct != null}
						Adds {Math.round(eq.bodyweightPct * 100)}% of your body weight per rep
						{#if data.bodyWeightKg != null}
							<span style="color: var(--color-text-dim);"
								>(~{(eq.bodyweightPct * data.bodyWeightKg).toFixed(1)} kg)</span
							>
						{/if}
					{:else}
						<span style="color: var(--color-text-dim);">Loaded externally only</span>
					{/if}
				</div>
			{:else}
				<label class="flex items-center gap-2 text-[14px]" style="color: var(--color-text);">
					<input type="checkbox" bind:checked={bwOn} />
					This equipment loads with body weight
				</label>
				{#if bwOn}
					<label class="flex items-center justify-between gap-3">
						<span class="text-[12px]" style="color: var(--color-text-dim);"
							>Percentage of body weight</span
						>
						<input
							type="number"
							min="0"
							max="200"
							step="1"
							bind:value={bwPctPercent}
							class="w-24 rounded-lg border px-3 py-2 text-right text-[14px] tabular-nums outline-none"
							style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
						/>
					</label>
					{#if data.bodyWeightKg != null}
						<div class="text-[11px]" style="color: var(--color-text-dim-2);">
							≈ {((Math.max(0, Math.min(200, bwPctPercent)) / 100) * data.bodyWeightKg).toFixed(1)}
							kg per rep at {data.bodyWeightKg.toFixed(1)} kg
						</div>
					{:else}
						<div class="text-[11px]" style="color: var(--color-text-dim-2);">
							<a href="/profile" style="color: var(--color-amber);">Set your body weight</a> to see effective
							load.
						</div>
					{/if}
				{/if}
				{#if bwError}
					<div class="text-[11px]" style="color: #ff8080;">{bwError}</div>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						class="flex-1 rounded-full border py-2 text-[13px]"
						style="border-color: var(--color-line-2); color: var(--color-text-dim);"
						onclick={() => {
							bwError = null;
							bwEditing = false;
							bwOn = eq.bodyweightPct != null;
							bwPctPercent = Math.round((eq.bodyweightPct ?? 0) * 100) || 100;
						}}
						disabled={bwSaving}
					>
						Cancel
					</button>
					<button
						type="button"
						class="flex-[2] rounded-full py-2 text-[13px] font-bold disabled:opacity-50"
						style="background: var(--color-amber); color: #1b0a00;"
						onclick={saveBodyweightPct}
						disabled={bwSaving}
					>
						{bwSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			{/if}
		</section>
	{/if}

	<section
		class="mt-3 flex flex-col gap-2 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-baseline justify-between">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Notes
			</div>
			{#if savingNotes}
				<span class="text-[10px]" style="color: var(--color-text-dim-2);">Saving…</span>
			{:else if !notesPristine}
				<span class="text-[10px]" style="color: var(--color-amber);">Unsaved</span>
			{/if}
		</div>
		<textarea
			bind:value={notesDraft}
			placeholder="Pin-loaded. Seat notch 4. Plates stored to the left."
			rows="3"
			onblur={saveNotes}
			class="w-full resize-y rounded-lg border px-3 py-2 text-[13px] leading-relaxed outline-none"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
		></textarea>
		{#if notesError}
			<div
				class="rounded-md border px-3 py-2 text-[12px]"
				style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
			>
				{notesError}
			</div>
		{/if}
		<div class="text-[10px]" style="color: var(--color-text-dim-2);">
			Notes are shared across users — they describe the machine, not the lifter.
		</div>
	</section>
</main>
