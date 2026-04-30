<script lang="ts">
	import { onDestroy } from 'svelte';
	import { mutate, ulid } from '$lib/mutate';
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import Stepper from '$lib/components/Stepper.svelte';
	import SmallStepper from '$lib/components/SmallStepper.svelte';
	import SetRow from '$lib/components/SetRow.svelte';
	import CardioRow from '$lib/components/CardioRow.svelte';
	import DateChip from '$lib/components/DateChip.svelte';
	import DateModeSheet from '$lib/components/DateModeSheet.svelte';
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import { fieldsFor, type CardioField } from '$lib/cardio-templates';
	import { syncStatus } from '$lib/sync/status';
	import { tsForBackdate, withDateMode } from '$lib/dateMode';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const asOfTs = $derived(data.asOfTs);
	let dateSheetOpen = $state(false);

	function setTs(): number {
		return asOfTs == null ? Date.now() : tsForBackdate(asOfTs);
	}

	const eq = $derived(data.equipment);
	const photoSrc = $derived(
		eq.photoPath ? `/uploads/${eq.photoPath}?v=${eq.updatedAt.getTime()}` : null
	);
	const isCardio = $derived(eq.type === 'cardio');
	const cardioFields = $derived<CardioField[]>(isCardio ? fieldsFor(eq.cardioKind) : []);

	// Visible (non-hidden) exercises. For machine/cable/cardio there's
	// exactly one hidden auto-exercise that we still need to log against.
	const visibleExercises = $derived(data.exercises.filter((x) => !x.isHidden));
	const allExercises = $derived(data.exercises);
	const showsExercisePicker = $derived(!isCardio && visibleExercises.length > 0);

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

	// Strength state
	let weight = $state(60);
	let reps = $state(8);
	let targetSets = $state(3);
	let lastSetExerciseId = $state('');

	// Cardio state
	let duration = $state(20);
	let cardioExtras = $state<Record<string, number>>({});

	$effect(() => {
		if (ctx && selectedExerciseId && selectedExerciseId !== lastSetExerciseId) {
			weight = ctx.lastWeight ?? weight;
			reps = ctx.lastReps ?? reps;
			duration = ctx.lastDurationMin ?? duration;
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

	const status = $derived($syncStatus);

	// Optimistic display: include set.create mutations still in the local
	// queue for this exercise. Each pending row has the same shape as a
	// server set so the rendering doesn't branch.
	const pendingSetsForExercise = $derived(
		status.pendingMutations
			.filter(
				(m) =>
					m.op === 'set.create' &&
					typeof m.payload === 'object' &&
					m.payload !== null &&
					(m.payload as { exerciseId?: string }).exerciseId === selectedExerciseId
			)
			.map((m) => {
				const p = m.payload as {
					id: string;
					weight?: number | null;
					reps?: number | null;
					durationMin?: number | null;
					extras?: Record<string, number> | null;
					ts?: number;
				};
				return {
					id: p.id,
					exerciseId: selectedExerciseId,
					weight: p.weight ?? null,
					reps: p.reps ?? null,
					durationMin: p.durationMin ?? null,
					extras: p.extras ?? null,
					ts: p.ts ?? m.enqueuedAt,
					pending: true as const
				};
			})
	);

	const serverSetIds = $derived(new Set(data.sessionSets.map((s) => s.id)));
	const visiblePending = $derived(pendingSetsForExercise.filter((p) => !serverSetIds.has(p.id)));

	const sessionSetsForExercise = $derived(
		[
			...data.sessionSets
				.filter((s) => s.exerciseId === selectedExerciseId)
				.map((s) => ({ ...s, pending: false as const })),
			...visiblePending
		].sort((a, b) => a.ts - b.ts)
	);
	const setsDone = $derived(sessionSetsForExercise.length);
	const allDone = $derived(setsDone >= targetSets && targetSets > 0);

	function fieldStep(id: string): number {
		const f = cardioFields.find((x) => x.id === id);
		return f?.step ?? 1;
	}
	function fieldMin(id: string): number {
		const f = cardioFields.find((x) => x.id === id);
		return f?.min ?? 0;
	}

	function bumpExtra(id: string, dir: 1 | -1) {
		const cur = cardioExtras[id];
		const step = fieldStep(id);
		const min = fieldMin(id);
		const next = Math.max(min, +(cur + dir * step).toFixed(2));
		cardioExtras = { ...cardioExtras, [id]: next };
	}
	function activateExtra(field: CardioField) {
		if (field.id in cardioExtras) return;
		cardioExtras = { ...cardioExtras, [field.id]: field.defaultValue };
	}
	function clearExtra(id: string) {
		const next = { ...cardioExtras };
		delete next[id];
		cardioExtras = next;
	}

	const treadmillDerived = $derived.by(() => {
		if (!isCardio || eq.cardioKind !== 'treadmill') return null;
		const dist = cardioExtras.distance;
		if (typeof dist !== 'number' || dist <= 0 || duration <= 0) return null;
		const speed = dist / (duration / 60); // km/h
		const paceMin = duration / dist;
		const paceM = Math.floor(paceMin);
		const paceS = Math.round((paceMin - paceM) * 60);
		return { speed, pace: `${paceM}:${String(paceS).padStart(2, '0')}` };
	});

	async function handleLog() {
		if (logging) return;
		error = null;
		logging = true;
		try {
			const id = ulid();
			if (isCardio) {
				if (duration <= 0) {
					error = 'Duration must be greater than 0.';
					return;
				}
				const extras: Record<string, number> = {};
				for (const [k, v] of Object.entries(cardioExtras)) {
					if (typeof v === 'number' && Number.isFinite(v)) extras[k] = v;
				}
				await mutate('set.create', {
					id,
					exerciseId: selectedExerciseId,
					durationMin: duration,
					extras: Object.keys(extras).length > 0 ? extras : null,
					ts: setTs()
				});
			} else {
				await mutate('set.create', {
					id,
					exerciseId: selectedExerciseId,
					weight,
					reps,
					ts: setTs()
				});
				if (setsDone + 1 > targetSets) targetSets = setsDone + 1;
			}
			justSaved = true;
			lastLogAt = Date.now();
			setTimeout(() => (justSaved = false), 700);
			// mutate() handles invalidation when the queue successfully drains;
			// when offline it queues silently and the optimistic overlay
			// covers the UI until reconnect — we explicitly don't call
			// invalidateAll here because that would 500 against an offline
			// network.
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
				ts: setTs()
			});
			lastLogAt = Date.now();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not clone set.';
		}
	}

	async function handleDelete(setId: string) {
		try {
			await mutate('set.delete', { id: setId });
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

	function fmtFieldValue(id: string, v: number): string {
		const f = cardioFields.find((x) => x.id === id);
		if (!f) return String(v);
		if (Number.isInteger(v) || f.step >= 1) return String(Math.round(v));
		return v.toFixed(1);
	}

	const buttonLabel = $derived.by(() => {
		if (justSaved) return 'Logged';
		if (isCardio) {
			return `Log · ${fmtNum(duration)} min`;
		}
		if (allDone) return `Extra set · ${fmtNum(weight)} kg × ${reps}`;
		return `Log set ${setsDone + 1} of ${Math.max(targetSets, 1)} · ${fmtNum(weight)} kg × ${reps}`;
	});

	function lastSummary(): string {
		if (isCardio) {
			if (ctx?.lastDurationMin != null) return `${fmtNum(ctx.lastDurationMin)} min`;
			return 'never';
		}
		if (ctx?.lastWeight != null && ctx?.lastReps != null) {
			return `${fmtNum(ctx.lastWeight)} kg × ${ctx.lastReps}`;
		}
		return 'never';
	}
</script>

<svelte:head>
	<title>Log {eq.name} · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pb-32 pt-12">
	<header class="flex items-start gap-3">
		<a
			href={withDateMode('/', asOfTs)}
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
			{#if asOfTs != null}
				<div class="mt-1.5">
					<DateChip {asOfTs} onOpen={() => (dateSheetOpen = true)} />
				</div>
			{/if}
		</div>
		<a
			href={withDateMode(`/equipment/${eq.id}`, asOfTs)}
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
		Last time: <span style="color: var(--color-text-dim);">{lastSummary()}</span>
	</div>

	{#if showsExercisePicker}
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

	{#if isCardio}
		<section class="mt-4">
			<Stepper
				value={duration}
				onChange={(v) => (duration = v)}
				step={1}
				min={1}
				label="DURATION"
				unit="min"
				hint={ctx?.lastDurationMin != null ? `Previous: ${fmtNum(ctx.lastDurationMin)} min` : undefined}
			/>
		</section>

		{#if cardioFields.length > 0}
			<section class="mt-4 flex flex-col gap-2">
				<div class="flex items-baseline justify-between">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Details · optional
					</div>
					<div class="text-[11px] tabular-nums" style="color: var(--color-text-dim-2);">
						{Object.keys(cardioExtras).length} / {cardioFields.length} added
					</div>
				</div>
				<div class="grid grid-cols-2 gap-2">
					{#each cardioFields as f (f.id)}
						{#if f.id in cardioExtras}
							<div
								class="flex flex-col gap-1 rounded-2xl border p-2.5"
								style="background: var(--color-surface); border-color: var(--color-amber-line);"
							>
								<div class="flex items-center justify-between">
									<span
										class="text-[9px] font-bold uppercase tracking-[0.14em]"
										style="color: var(--color-amber);"
									>
										{f.label}
									</span>
									<button
										type="button"
										class="-mr-1 rounded-full p-0.5"
										style="color: var(--color-text-dim-2);"
										onclick={() => clearExtra(f.id)}
										aria-label="Remove {f.label}"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
											<path d="M6 6l12 12M18 6L6 18"/>
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border active:scale-95"
										style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
										use:holdRepeat={{ onTick: () => bumpExtra(f.id, -1) }}
										aria-label="Decrease {f.label.toLowerCase()}"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
											<path d="M5 12h14"/>
										</svg>
									</button>
									<div class="flex flex-1 items-baseline justify-center gap-1">
										<span
											class="text-[18px] font-bold tabular-nums"
											style="color: var(--color-text);"
										>
											{fmtFieldValue(f.id, cardioExtras[f.id])}
										</span>
										{#if f.unit}
											<span class="text-[10px]" style="color: var(--color-text-dim);">
												{f.unit}
											</span>
										{/if}
									</div>
									<button
										type="button"
										class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border active:scale-95"
										style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
										use:holdRepeat={{ onTick: () => bumpExtra(f.id, 1) }}
										aria-label="Increase {f.label.toLowerCase()}"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
											<path d="M12 5v14M5 12h14"/>
										</svg>
									</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								class="flex min-h-[64px] items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-[12px] font-medium"
								style="border-color: var(--color-line-2); color: var(--color-text-dim);"
								onclick={() => activateExtra(f)}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
									<path d="M12 5v14M5 12h14"/>
								</svg>
								{f.label.toLowerCase()}
							</button>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		{#if treadmillDerived}
			<section
				class="mt-3 flex items-center gap-3 rounded-xl border px-3 py-2.5"
				style="background: var(--color-surface); border-color: var(--color-line);"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-dim-2);">
					<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
				</svg>
				<div class="flex flex-col">
					<div class="text-[9px] font-bold uppercase tracking-[0.14em]" style="color: var(--color-text-dim-2);">
						Avg speed
					</div>
					<div class="text-[14px] font-bold tabular-nums" style="color: var(--color-text);">
						{treadmillDerived.speed.toFixed(1)}
						<span class="text-[10px] font-medium" style="color: var(--color-text-dim);">km/h</span>
					</div>
				</div>
				<div class="self-stretch w-px" style="background: var(--color-line);"></div>
				<div class="flex flex-col">
					<div class="text-[9px] font-bold uppercase tracking-[0.14em]" style="color: var(--color-text-dim-2);">
						Pace
					</div>
					<div class="text-[14px] font-bold tabular-nums" style="color: var(--color-text);">
						{treadmillDerived.pace}
						<span class="text-[10px] font-medium" style="color: var(--color-text-dim);">/ km</span>
					</div>
				</div>
				<div class="ml-auto text-[10px]" style="color: var(--color-text-dim-2);">auto</div>
			</section>
		{/if}
	{:else}
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
	{/if}

	{#if sessionSetsForExercise.length > 0}
		<section class="mt-4 flex flex-col gap-2">
			<div class="flex items-baseline justify-between">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					This session · {sessionSetsForExercise.length}
					{isCardio
						? sessionSetsForExercise.length === 1
							? 'log'
							: 'logs'
						: sessionSetsForExercise.length === 1
							? 'set'
							: 'sets'}
				</div>
				{#if !isCardio && restRemaining != null && restRemaining > 0}
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
					{#if isCardio}
						<CardioRow
							index={i}
							durationMin={s.durationMin ?? 0}
							extras={s.extras}
							isLatest={i === sessionSetsForExercise.length - 1}
							pending={s.pending}
							onDelete={() => handleDelete(s.id)}
						/>
					{:else}
						<SetRow
							index={i}
							weight={s.weight ?? 0}
							reps={s.reps ?? 0}
							isLatest={i === sessionSetsForExercise.length - 1}
							pending={s.pending}
							onClone={() => handleClone(s)}
							onDelete={() => handleDelete(s.id)}
						/>
					{/if}
				{/each}
			</div>
			<div
				class="text-center text-[11px]"
				style="color: var(--color-text-dim-2);"
			>
				{isCardio ? '← swipe to delete' : '← swipe to delete · swipe right to clone →'}
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

{#if dateSheetOpen}
	<DateModeSheet {asOfTs} onClose={() => (dateSheetOpen = false)} />
{/if}
