<script lang="ts">
	// One row in the in-session set list. Shows index + weight × reps and
	// reveals delete (left swipe) / clone (right swipe) under the row.
	// Tap the row body to edit weight/reps in place.

	import { swipeable } from '$lib/actions/swipe';

	let {
		index,
		weight,
		reps,
		isLatest,
		pending = false,
		onDelete,
		onClone,
		onEdit
	}: {
		index: number;
		weight: number;
		reps: number;
		isLatest: boolean;
		pending?: boolean;
		onDelete: () => void;
		onClone: () => void;
		onEdit?: (weight: number, reps: number) => void;
	} = $props();

	function fmt(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	const volume = $derived(Math.round(weight * reps));

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
		const w = Math.max(0, Number(editWeight) || 0);
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
		class="absolute inset-y-0 left-0 flex items-center px-4 text-[11px] font-bold uppercase tracking-[0.14em]"
		style="color: var(--color-teal);"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<rect x="8" y="8" width="12" height="12" rx="2"/>
			<path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>
		</svg>
		<span class="ml-2">Clone</span>
	</div>
	<div
		class="absolute inset-y-0 right-0 flex items-center px-4 text-[11px] font-bold uppercase tracking-[0.14em]"
		style="color: #ff8080;"
	>
		<span class="mr-2">Delete</span>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"/>
		</svg>
	</div>
	<div
		class="relative flex items-center gap-3 rounded-xl border px-4 py-2.5 tabular-nums"
		style="background: {isLatest
			? 'linear-gradient(var(--color-amber-dim), var(--color-amber-dim)), var(--color-surface-2)'
			: 'var(--color-surface-2)'}; border-color: {isLatest
			? 'var(--color-amber-line)'
			: 'var(--color-line)'}; opacity: {pending ? 0.7 : 1};"
		use:swipeable={{ onLeft: onDelete, onRight: onClone, threshold: 90, enabled: !pending && !editing }}
	>
		<div
			class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
			style="background: {isLatest ? 'var(--color-amber)' : 'var(--color-surface-3)'}; color: {isLatest ? '#1b0a00' : 'var(--color-text-dim)'};"
		>
			{index + 1}
		</div>
		{#if editing}
			<div class="flex flex-1 items-center gap-2 text-[14px]">
				<input
					type="number"
					inputmode="decimal"
					step="0.5"
					min="0"
					bind:value={editWeight}
					class="w-16 rounded-md border px-2 py-1 text-right font-semibold tabular-nums"
					style="background: var(--color-surface-3); border-color: var(--color-line-2); color: var(--color-text);"
					aria-label="Weight in kg"
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
				class="rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
				style="color: var(--color-text-dim);"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={commit}
				class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				Save
			</button>
		{:else}
			<button
				type="button"
				class="flex flex-1 items-baseline gap-2 text-left text-[15px]"
				style="color: var(--color-text);"
				onclick={startEdit}
				disabled={pending || !onEdit}
				aria-label="Edit set"
			>
				<span class="font-semibold">{fmt(weight)}</span>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg</span>
				<span style="color: var(--color-text-dim-2);">×</span>
				<span class="font-semibold">{reps}</span>
			</button>
			{#if pending}
				<span
					class="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
					style="background: rgba(244,237,226,0.06); color: var(--color-text-dim);"
				>
					queued
				</span>
			{:else}
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
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"/>
				</svg>
			</button>
		{/if}
	</div>
</div>
