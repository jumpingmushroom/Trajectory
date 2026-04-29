<script lang="ts">
	// One row in the in-session set list. Shows index + weight × reps and
	// reveals delete (left swipe) / clone (right swipe) under the row.
	// Tap the trash icon for keyboard / no-touch fallback.

	import { swipeable } from '$lib/actions/swipe';

	let {
		index,
		weight,
		reps,
		isLatest,
		pending = false,
		onDelete,
		onClone
	}: {
		index: number;
		weight: number;
		reps: number;
		isLatest: boolean;
		pending?: boolean;
		onDelete: () => void;
		onClone: () => void;
	} = $props();

	function fmt(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	const volume = $derived(Math.round(weight * reps));
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
			? 'var(--color-amber-dim)'
			: 'var(--color-surface-2)'}; border-color: {isLatest
			? 'var(--color-amber-line)'
			: 'var(--color-line)'}; opacity: {pending ? 0.7 : 1};"
		use:swipeable={{ onLeft: onDelete, onRight: onClone, threshold: 90, enabled: !pending }}
	>
		<div
			class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
			style="background: {isLatest ? 'var(--color-amber)' : 'var(--color-surface-3)'}; color: {isLatest ? '#1b0a00' : 'var(--color-text-dim)'};"
		>
			{index + 1}
		</div>
		<div class="flex flex-1 items-baseline gap-2 text-[15px]" style="color: var(--color-text);">
			<span class="font-semibold">{fmt(weight)}</span>
			<span class="text-[11px]" style="color: var(--color-text-dim-2);">kg</span>
			<span style="color: var(--color-text-dim-2);">×</span>
			<span class="font-semibold">{reps}</span>
		</div>
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
	</div>
</div>
