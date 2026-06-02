<script lang="ts">
	// Cardio variant of SetRow. Same swipe affordance, shows duration +
	// any populated extras instead of weight × reps.

	import { swipeable } from '$lib/actions/swipe';
	import type { SetEditFields } from '$lib/input-modes';

	let {
		index,
		durationMin,
		extras,
		isLatest,
		pending = false,
		onDelete,
		onEdit
	}: {
		index: number;
		durationMin: number;
		extras: Record<string, number> | null;
		isLatest: boolean;
		pending?: boolean;
		onDelete: () => void;
		// Edits duration (minutes) + distance (raw stored value — km for
		// treadmill/bike/generic, metres for rower). Other extras keys (hr,
		// calories) are preserved by the server's shallow merge.
		onEdit?: (fields: SetEditFields) => void;
	} = $props();

	let editing = $state(false);
	let editDurationMin = $state(durationMin);
	let editDistance = $state(typeof extras?.distance === 'number' ? extras.distance : 0);

	function startEdit() {
		if (pending || !onEdit) return;
		editDurationMin = durationMin;
		editDistance = typeof extras?.distance === 'number' ? extras.distance : 0;
		editing = true;
	}
	function commit() {
		if (!onEdit) {
			editing = false;
			return;
		}
		const fields: SetEditFields = { durationMin: Math.max(0, Number(editDurationMin) || 0) };
		const d = Math.max(0, Number(editDistance) || 0);
		// Only carry distance when present so a duration-only cardio set doesn't
		// get a spurious distance:0 key injected.
		if (d > 0) fields.extras = { distance: d };
		onEdit(fields);
		editing = false;
	}
	function cancel() {
		editing = false;
	}

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
		use:swipeable={{ onLeft: onDelete, threshold: 90, enabled: !pending && !editing }}
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
			<div class="flex flex-1 flex-wrap items-center gap-1.5 text-[14px]">
				<input
					type="number"
					inputmode="decimal"
					step="1"
					min="0"
					bind:value={editDurationMin}
					class="w-16 rounded-md border px-2 py-1 text-right font-semibold tabular-nums"
					style="background: var(--color-surface-3); border-color: var(--color-line-2); color: var(--color-text);"
					aria-label="Duration in minutes"
				/>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">min</span>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">×</span>
				<input
					type="number"
					inputmode="decimal"
					step="0.1"
					min="0"
					bind:value={editDistance}
					class="w-16 rounded-md border px-2 py-1 text-right font-semibold tabular-nums"
					style="background: var(--color-surface-3); border-color: var(--color-line-2); color: var(--color-text);"
					aria-label="Distance"
				/>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">dist</span>
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
				class="flex flex-1 items-baseline gap-2 text-left text-[15px]"
				style="color: var(--color-text);"
				onclick={startEdit}
				disabled={pending || !onEdit}
				aria-label="Edit set"
			>
				<span class="font-semibold"
					>{Number.isInteger(durationMin) ? durationMin : durationMin.toFixed(1)}</span
				>
				<span class="text-[11px]" style="color: var(--color-text-dim-2);">min</span>
			</button>
			{#if pending}
				<span
					class="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase"
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
