<script lang="ts">
	// Cardio variant of SetRow. Same swipe affordance, shows duration +
	// any populated extras instead of weight × reps.

	import { swipeable } from '$lib/actions/swipe';

	let {
		index,
		durationMin,
		extras,
		isLatest,
		pending = false,
		onDelete
	}: {
		index: number;
		durationMin: number;
		extras: Record<string, number> | null;
		isLatest: boolean;
		pending?: boolean;
		onDelete: () => void;
	} = $props();

	const summaryBits = $derived.by(() => {
		const out: string[] = [];
		if (!extras) return out;
		if (typeof extras.distance === 'number') {
			// Heuristic unit: meters if it's a big integer (rower), km otherwise.
			if (extras.distance >= 200 && Number.isInteger(extras.distance)) {
				out.push(`${extras.distance} m`);
			} else {
				const v = extras.distance;
				out.push(`${Number.isInteger(v) ? v : v.toFixed(1)} km`);
			}
		}
		if (typeof extras.hr === 'number') out.push(`${extras.hr} bpm`);
		if (typeof extras.calories === 'number') out.push(`${extras.calories} kcal`);
		return out;
	});
</script>

<div class="relative">
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
		use:swipeable={{ onLeft: onDelete, threshold: 90, enabled: !pending }}
	>
		<div
			class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
			style="background: {isLatest ? 'var(--color-amber)' : 'var(--color-surface-3)'}; color: {isLatest ? '#1b0a00' : 'var(--color-text-dim)'};"
		>
			{index + 1}
		</div>
		<div class="flex flex-1 items-baseline gap-2 text-[15px]" style="color: var(--color-text);">
			<span class="font-semibold">{Number.isInteger(durationMin) ? durationMin : durationMin.toFixed(1)}</span>
			<span class="text-[11px]" style="color: var(--color-text-dim-2);">min</span>
		</div>
		{#if pending}
			<span
				class="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
				style="background: rgba(244,237,226,0.06); color: var(--color-text-dim);"
			>
				queued
			</span>
		{:else if summaryBits.length > 0}
			<div class="text-[11px]" style="color: var(--color-text-dim-2);">
				{summaryBits.join(' · ')}
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
