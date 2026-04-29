<script lang="ts">
	import { onDestroy } from 'svelte';
	import { mutate, ulid } from '$lib/mutate';
	import { invalidateAll } from '$app/navigation';
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import Stepper from '$lib/components/Stepper.svelte';
	import SmallStepper from '$lib/components/SmallStepper.svelte';
	import SetRow from '$lib/components/SetRow.svelte';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const eq = $derived(data.equipment);
	const photoSrc = $derived(eq.photoPath ? `/uploads/${eq.photoPath}` : null);
	const isCardio = $derived(eq.type === 'cardio');

	// Visible (non-hidden) exercises. For machine/cable/cardio there's
	// exactly one hidden auto-exercise that we still need to log against.
	const visibleExercises = $derived(data.exercises.filter((x) => !x.isHidden));
	const allExercises = $derived(data.exercises);
	const showsExercisePicker = $derived(visibleExercises.length > 0);

	// Pick the default exercise: most-recent visible if any, else the
	// (single) hidden auto-exercise.
	const defaultExerciseId = $derived(
		visibleExercises[0]?.id ?? allExercises[0]?.id ?? ''
	);

	let selectedExerciseId = $state('');
	$effect(() => {
		if (!selectedExerciseId && defaultExerciseId) selectedExerciseId = defaultExerciseId;
	});

	const ctx = $derived(
		data.contexts.find((c) => c.id === selectedExerciseId) ?? data.contexts[0]
	);

	let weight = $state(60);
	let reps = $state(8);
	let targetSets = $state(3);
	let lastSetExerciseId = $state('');

	$effect(() => {
		// Reset prefill when the user picks a different exercise OR on
		// first arrival when ctx becomes available.
		if (ctx && selectedExerciseId && selectedExerciseId !== lastSetExerciseId) {
			weight = ctx.lastWeight ?? weight;
			reps = ctx.lastReps ?? reps;
			lastSetExerciseId = selectedExerciseId;
		}
	});

	let logging = $state(false);
	let justSaved = $state(false);
	let error = $state<string | null>(null);
	let lastLogAt = $state<number | null>(null);
	let now = $state(Date.now());

	const tickHandle = setInterval(() => {
		now = Date.now();
	}, 1000);
	onDestroy(() => clearInterval(tickHandle));

	const REST_SECS = 90;
	const restRemaining = $derived(
		lastLogAt == null ? null : Math.max(0, REST_SECS - Math.floor((now - lastLogAt) / 1000))
	);

	const sessionSetsForExercise = $derived(
		data.sessionSets.filter((s) => s.exerciseId === selectedExerciseId)
	);
	const setsDone = $derived(sessionSetsForExercise.length);
	const allDone = $derived(setsDone >= targetSets && targetSets > 0);

	async function handleLog() {
		if (logging) return;
		error = null;
		logging = true;
		try {
			const id = ulid();
			await mutate('set.create', {
				id,
				exerciseId: selectedExerciseId,
				weight,
				reps,
				ts: Date.now()
			});
			justSaved = true;
			lastLogAt = Date.now();
			setTimeout(() => (justSaved = false), 700);
			if (setsDone + 1 > targetSets) targetSets = setsDone + 1;
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not log set.';
		} finally {
			logging = false;
		}
	}

	async function handleClone(s: { weight: number | null; reps: number | null }) {
		if (s.weight == null || s.reps == null) return;
		try {
			await mutate('set.create', {
				id: ulid(),
				exerciseId: selectedExerciseId,
				weight: s.weight,
				reps: s.reps,
				ts: Date.now()
			});
			lastLogAt = Date.now();
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not clone set.';
		}
	}

	async function handleDelete(setId: string) {
		try {
			await mutate('set.delete', { id: setId });
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not delete set.';
		}
	}

	function fmtRest(s: number): string {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	function fmtNum(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	const buttonLabel = $derived.by(() => {
		if (justSaved) return 'Logged';
		if (allDone) return `Extra set · ${fmtNum(weight)} kg × ${reps}`;
		return `Log set ${setsDone + 1} of ${Math.max(targetSets, 1)} · ${fmtNum(weight)} kg × ${reps}`;
	});
</script>

<svelte:head>
	<title>Log {eq.name} · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pb-32 pt-12">
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
				{isCardio ? 'CARDIO' : 'LOGGING'}
			</div>
			<div
				class="mt-0.5 truncate text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{eq.name}
			</div>
		</div>
		<a
			href={`/equipment/${eq.id}`}
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Equipment detail"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
				<circle cx="5" cy="12" r="1.7"/>
				<circle cx="12" cy="12" r="1.7"/>
				<circle cx="19" cy="12" r="1.7"/>
			</svg>
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
		{#if ctx && ctx.sparklineSeries.length >= 2}
			<div
				class="absolute bottom-2 right-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
				style="background: rgba(13,15,18,0.8); border-color: var(--color-line-2); backdrop-filter: blur(6px);"
			>
				<Sparkline data={ctx.sparklineSeries} width={70} height={20} />
				<span class="text-[10px] tabular-nums" style="color: var(--color-text-dim);">
					{(() => {
						const s = ctx.sparklineSeries;
						const delta = s[s.length - 1] - s[0];
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
		Last time:
		<span style="color: var(--color-text-dim);">
			{#if ctx?.lastWeight != null && ctx?.lastReps != null}
				{fmtNum(ctx.lastWeight)} kg × {ctx.lastReps}
			{:else}
				never
			{/if}
		</span>
	</div>

	{#if showsExercisePicker && visibleExercises.length > 0}
		<section class="mt-4 flex flex-col gap-2">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Exercise
			</div>
			<div class="flex flex-wrap gap-2">
				{#each visibleExercises as ex (ex.id)}
					<button
						type="button"
						class="rounded-full border px-3 py-1.5 text-[12px] font-medium"
						style="background: {selectedExerciseId === ex.id
							? 'var(--color-amber-dim)'
							: 'var(--color-surface-2)'}; border-color: {selectedExerciseId === ex.id
							? 'var(--color-amber-line)'
							: 'var(--color-line-2)'}; color: {selectedExerciseId === ex.id
							? 'var(--color-amber)'
							: 'var(--color-text)'};"
						onclick={() => (selectedExerciseId = ex.id)}
						aria-pressed={selectedExerciseId === ex.id}
					>
						{ex.name}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mt-4">
		<Stepper
			value={weight}
			onChange={(v) => (weight = v)}
			step={2.5}
			label="WEIGHT"
			unit="kg"
			hint="Tap +/− for 2.5 kg · hold to scroll"
		/>
	</section>

	{#if ctx && ctx.commonWeights.length > 0}
		<section class="mt-4 flex flex-col gap-2">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Your usual
			</div>
			<div class="flex flex-wrap gap-2">
				{#each ctx.commonWeights as w (w)}
					<button
						type="button"
						class="rounded-full border px-3 py-1.5 text-[12px] font-medium tabular-nums"
						style="background: {weight === w
							? 'var(--color-amber-dim)'
							: 'transparent'}; border-color: {weight === w
							? 'var(--color-amber-line)'
							: 'var(--color-line-2)'}; color: {weight === w
							? 'var(--color-amber)'
							: 'var(--color-text-dim)'};"
						onclick={() => (weight = w)}
					>
						{fmtNum(w)} kg
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mt-4 grid grid-cols-2 gap-2">
		<SmallStepper
			value={reps}
			onChange={(v) => (reps = v)}
			min={1}
			max={50}
			label="REPS"
		/>
		<SmallStepper
			value={targetSets}
			onChange={(v) => (targetSets = v)}
			min={1}
			max={12}
			label="TARGET SETS"
		/>
	</section>

	<section
		class="mt-3 flex items-center gap-3 rounded-xl border px-3 py-2.5"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex flex-1 flex-wrap gap-1.5">
			{#each Array.from({ length: Math.max(targetSets, setsDone) }) as _, i (i)}
				{@const done = i < setsDone}
				{@const next = i === setsDone && !allDone}
				<div
					class="flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums"
					style="background: {done
						? 'var(--color-amber)'
						: next
							? 'var(--color-amber-dim)'
							: 'rgba(244,237,226,0.05)'}; border-color: {done
						? 'var(--color-amber)'
						: next
							? 'var(--color-amber-line)'
							: 'var(--color-line-2)'}; color: {done
						? '#1b0a00'
						: next
							? 'var(--color-amber)'
							: 'var(--color-text-dim-2)'};"
				>
					{done ? '✓' : i + 1}
				</div>
			{/each}
		</div>
		<div
			class="text-[12px] font-medium tabular-nums"
			style="color: var(--color-text-dim);"
		>
			{setsDone}<span style="color: var(--color-text-dim-2);"> / {targetSets}</span>
		</div>
	</section>

	<div class="mt-2 text-center text-[11px] tabular-nums" style="color: var(--color-text-dim-2);">
		Planned · {targetSets} × {reps} × {fmtNum(weight)} kg = {Math.round(
			targetSets * reps * weight
		)} kg
	</div>

	{#if sessionSetsForExercise.length > 0}
		<section class="mt-4 flex flex-col gap-2">
			<div class="flex items-baseline justify-between">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					This session · {sessionSetsForExercise.length}
					set{sessionSetsForExercise.length === 1 ? '' : 's'}
				</div>
				{#if restRemaining != null && restRemaining > 0}
					<div
						class="flex items-center gap-1.5 text-[12px] font-semibold tabular-nums"
						style="color: var(--color-amber);"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="13" r="8"/>
							<path d="M12 9v4l2.5 2M9 2h6"/>
						</svg>
						rest {fmtRest(restRemaining)}
					</div>
				{/if}
			</div>
			<div class="flex flex-col gap-1.5">
				{#each sessionSetsForExercise as s, i (s.id)}
					<SetRow
						index={i}
						weight={s.weight ?? 0}
						reps={s.reps ?? 0}
						isLatest={i === sessionSetsForExercise.length - 1}
						onClone={() => handleClone(s)}
						onDelete={() => handleDelete(s.id)}
					/>
				{/each}
			</div>
			<div
				class="text-center text-[11px]"
				style="color: var(--color-text-dim-2);"
			>
				← swipe to delete · swipe right to clone →
			</div>
		</section>
	{/if}

	{#if error}
		<div
			class="mt-3 rounded-md border px-3 py-2 text-[13px]"
			style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
		>
			{error}
		</div>
	{/if}
</main>

<div
	class="fixed inset-x-0 bottom-0 z-30 px-4 pb-6 pt-3"
	style="background: linear-gradient(180deg, transparent 0%, rgba(13,15,18,0.92) 30%, rgba(13,15,18,1) 60%);"
>
	<div class="mx-auto w-full max-w-[448px]">
		<button
			type="button"
			class="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold tracking-[0.01em] transition-all disabled:opacity-50"
			style="background: {justSaved
				? 'var(--color-teal)'
				: 'var(--color-amber)'}; color: #1b0a00; box-shadow: 0 8px 24px {justSaved
				? 'rgba(102,199,194,0.32)'
				: 'var(--color-amber-glow)'};"
			onclick={handleLog}
			disabled={logging}
		>
			{#if justSaved}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12l5 5L20 7"/>
				</svg>
			{/if}
			{buttonLabel}
		</button>
	</div>
</div>
