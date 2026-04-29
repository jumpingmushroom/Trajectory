<script lang="ts">
	import { mutate } from '$lib/mutate';
	import { invalidateAll } from '$app/navigation';
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const eq = $derived(data.equipment);
	const isCardio = $derived(eq.type === 'cardio');
	const photoSrc = $derived(eq.photoPath ? `/uploads/${eq.photoPath}` : null);
	const lastSparkline = $derived(data.series.slice(-10));

	let notesDraft = $state('');
	let savingNotes = $state(false);
	let notesError = $state<string | null>(null);
	let notesPristine = $derived(notesDraft === (eq.notes ?? ''));

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
			await invalidateAll();
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

	const metaTiles = $derived([
		{
			label: isCardio ? 'Last' : 'PR',
			value: isCardio
				? data.lastDurationMin != null
					? `${fmtNum(data.lastDurationMin)} min`
					: '—'
				: data.pr != null
					? `${fmtNum(data.pr)} kg`
					: '—'
		},
		{ label: 'Sessions', value: String(data.sessionsCount) },
		{
			label: isCardio ? 'Type' : 'Sets',
			value: isCardio ? (eq.cardioKind ?? 'Cardio') : String(data.setsCount)
		}
	]);
</script>

<svelte:head>
	<title>{eq.name} · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pt-12 pb-24">
	<header class="flex items-start gap-3">
		<a
			href="/"
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Back"
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
				{isCardio ? 'CARDIO' : 'EQUIPMENT'}
			</div>
			<div
				class="mt-0.5 truncate text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{eq.name}
			</div>
		</div>
		<a
			href={`/log/${eq.id}`}
			class="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
			style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 6px 18px var(--color-amber-glow);"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 5v14M5 12h14"/>
			</svg>
			Log
		</a>
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
				class="absolute bottom-2 right-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
				style="background: rgba(13,15,18,0.8); border-color: var(--color-line-2); backdrop-filter: blur(6px);"
			>
				<Sparkline data={lastSparkline} width={70} height={20} />
				<span class="text-[10px] tabular-nums" style="color: var(--color-text-dim);">
					{(() => {
						const delta = data.series[data.series.length - 1] - data.series[0];
						const sign = delta > 0 ? '+' : '';
						return `${sign}${fmtNum(delta)} ${isCardio ? 'min' : 'kg'}`;
					})()}
				</span>
			</div>
		{/if}
	</section>

	<div
		class="mt-3 flex items-center gap-2 text-[12px]"
		style="color: var(--color-text-dim-2);"
	>
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
					class="text-[9px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					{t.label}
				</div>
				<div
					class="text-[18px] font-bold tabular-nums tracking-[-0.01em] capitalize"
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
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
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
		<LineChart
			data={data.series}
			width={420}
			height={170}
			unit={isCardio ? 'min' : 'kg'}
		/>
	</section>

	{#if data.commonWeights.length > 0 && !isCardio}
		<section
			class="mt-3 rounded-2xl border p-4"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
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

	<section
		class="mt-3 flex flex-col gap-2 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-baseline justify-between">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
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
