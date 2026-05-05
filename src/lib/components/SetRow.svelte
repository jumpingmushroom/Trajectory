<script lang="ts">
	// One row in the in-session set list. Shows index + a mode-aware summary
	// (weight × reps for strength, mm:ss for timed holds, weight × distance
	// for carries) and reveals delete (left swipe) / clone (right swipe)
	// under the row. Tap the row body to edit in place — only weighted /
	// bodyweight modes are editable today; other modes show the summary
	// without an edit affordance (re-clone via swipe-right works for all).

	import { swipeable } from '$lib/actions/swipe';
	import { formatDurationMinAsClock, type InputMode } from '$lib/input-modes';

	let {
		index,
		weight = 0,
		reps = 0,
		durationMin = null,
		distance = null,
		mode = 'weighted',
		bwLoadKg = 0,
		isLatest,
		pending = false,
		onDelete,
		onClone,
		onEdit
	}: {
		index: number;
		weight?: number;
		reps?: number;
		durationMin?: number | null;
		distance?: number | null;
		mode?: InputMode;
		// Bodyweight contribution snapshotted at log time. When > 0 the row
		// renders effective load (weight + bwLoadKg) as the headline number
		// and shows the breakdown as a subtitle. Defaults to 0 so non-
		// bodyweight equipment renders exactly as before.
		bwLoadKg?: number;
		isLatest: boolean;
		pending?: boolean;
		onDelete: () => void;
		onClone: () => void;
		// onEdit only fires for weighted/bodyweight modes. The Log screen
		// passes undefined for the new modes so the row stays read-only there.
		onEdit?: (weight: number, reps: number) => void;
	} = $props();

	function fmt(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function fmtDistance(m: number): string {
		// Mirror the rower / cardio rule: integer meters under 500 stay as m,
		// everything else collapses to km.
		if (m >= 500 || !Number.isInteger(m)) {
			return `${(m / 1000).toFixed(2)} km`;
		}
		return `${m} m`;
	}

	const isBodyweight = $derived(bwLoadKg > 0);
	const effective = $derived(weight + bwLoadKg);
	const volume = $derived(Math.round(effective * reps));
	const isStrengthMode = $derived(mode === 'weighted' || mode === 'bodyweight');

	// Breakdown subtitle for bodyweight rows. Three flavours:
	//   weight === 0: "bodyweight only" (cleanest reading for a pure
	//                  unweighted set, no algebra noise).
	//   weight > 0:   "5 + 32.0 bw" (added load + bodyweight contribution).
	//   weight < 0:   "−15 + 32.0 bw" (band-assisted; minus sign explicit).
	const breakdown = $derived.by(() => {
		if (!isBodyweight) return '';
		if (weight === 0) return 'bodyweight only';
		const sign = weight < 0 ? '−' : '';
		return `${sign}${fmt(Math.abs(weight))} + ${fmt(bwLoadKg)} bw`;
	});

	let editing = $state(false);
	let editWeight = $state(weight);
	let editReps = $state(reps);

	function startEdit() {
		if (pending || !onEdit) return;
		editWeight = weight;
		editReps = reps;
		editing = true;
	}
	function commit() {
		if (!onEdit) {
			editing = false;
			return;
		}
		// Bodyweight equipment allows negative (assisted) added weight.
		// Non-bodyweight stays clamped at zero.
		const raw = Number(editWeight) || 0;
		const w = isBodyweight ? raw : Math.max(0, raw);
		const r = Math.max(0, Math.round(Number(editReps) || 0));
		if (w !== weight || r !== reps) onEdit(w, r);
		editing = false;
	}
	function cancel() {
		editing = false;
	}
</script>

<div class="relative">
	<div
		class="absolute inset-y-0 left-0 flex items-center px-4 text-[11px] font-bold tracking-[0.14em] uppercase"
		style="color: var(--color-teal);"
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
		</svg>
		<span class="ml-2">Clone</span>
	</div>
	<div
		class="absolute inset-y-0 right-0 flex items-center px-4 text-[11px] font-bold tracking-[0.14em] uppercase"
		style="color: #ff8080;"
	>
		<span class="mr-2">Delete</span>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3" />
		</svg>
	</div>
	<div
		class="relative flex items-center gap-3 rounded-xl border px-4 py-2.5 tabular-nums"
		style="background: {isLatest
			? 'linear-gradient(var(--color-amber-dim), var(--color-amber-dim)), var(--color-surface-2)'
			: 'var(--color-surface-2)'}; border-color: {isLatest
			? 'var(--color-amber-line)'
			: 'var(--color-line)'}; opacity: {pending ? 0.7 : 1};"
		use:swipeable={{
			onLeft: onDelete,
			onRight: onClone,
			threshold: 90,
			enabled: !pending && !editing
		}}
	>
		<div
			class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
			style="background: {isLatest
				? 'var(--color-amber)'
				: 'var(--color-surface-3)'}; color: {isLatest ? '#1b0a00' : 'var(--color-text-dim)'};"
		>
			{index + 1}
		</div>
		{#if editing}
			<div class="flex flex-1 items-center gap-2 text-[14px]">
				<input
					type="number"
					inputmode="decimal"
					step="0.5"
					min={isBodyweight ? -200 : 0}
					bind:value={editWeight}
					class="w-16 rounded-md border px-2 py-1 text-right font-semibold tabular-nums"
					style="background: var(--color-surface-3); border-color: var(--color-line-2); color: var(--color-text);"
					aria-label={isBodyweight ? 'Added weight in kg' : 'Weight in kg'}
				/>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg ×</span>
				<input
					type="number"
					inputmode="numeric"
					step="1"
					min="0"
					bind:value={editReps}
					class="w-12 rounded-md border px-2 py-1 text-right font-semibold tabular-nums"
					style="background: var(--color-surface-3); border-color: var(--color-line-2); color: var(--color-text);"
					aria-label="Reps"
				/>
			</div>
			<button
				type="button"
				onclick={cancel}
				class="rounded-full px-2 py-1 text-[11px] font-bold tracking-[0.12em] uppercase"
				style="color: var(--color-text-dim);"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={commit}
				class="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				Save
			</button>
		{:else}
			<button
				type="button"
				class="flex flex-1 flex-col items-start text-left"
				style="color: var(--color-text);"
				onclick={startEdit}
				disabled={pending || !onEdit || !isStrengthMode}
				aria-label="Edit set"
			>
				<span class="flex items-baseline gap-2 text-[15px]">
					{#if mode === 'timed'}
						<span class="font-semibold">{formatDurationMinAsClock(durationMin ?? 0)}</span>
					{:else if mode === 'timed_weighted'}
						<span class="font-semibold">{formatDurationMinAsClock(durationMin ?? 0)}</span>
						<span style="color: var(--color-text-dim-2);">×</span>
						<span class="font-semibold">{fmt(weight)}</span>
						<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg</span>
					{:else if mode === 'weight_distance'}
						<span class="font-semibold">{fmt(weight)}</span>
						<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg</span>
						<span style="color: var(--color-text-dim-2);">×</span>
						<span class="font-semibold">{fmtDistance(distance ?? 0)}</span>
					{:else}
						<span class="font-semibold">{fmt(isBodyweight ? effective : weight)}</span>
						<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg</span>
						<span style="color: var(--color-text-dim-2);">×</span>
						<span class="font-semibold">{reps}</span>
					{/if}
				</span>
				{#if isBodyweight && isStrengthMode}
					<span class="text-[10px]" style="color: var(--color-text-dim-2);">{breakdown}</span>
				{/if}
			</button>
			{#if pending}
				<span
					class="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase"
					style="background: rgba(244,237,226,0.06); color: var(--color-text-dim);"
				>
					queued
				</span>
			{:else if isStrengthMode}
				<div class="text-[11px]" style="color: var(--color-text-dim-2);">
					{volume} kg
				</div>
			{/if}
			<button
				type="button"
				class="ml-1 hidden rounded-full p-1.5 sm:block"
				style="color: var(--color-text-dim-2);"
				onclick={onDelete}
				aria-label="Delete set"
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
					<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3" />
				</svg>
			</button>
		{/if}
	</div>
</div>
