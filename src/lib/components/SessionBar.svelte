<script lang="ts">
	// Sticky bar shown above the TabBar on Home when there's an open
	// workout session. Tapping it jumps the user back into the Log screen
	// for the equipment they last logged against.

	import { onDestroy } from 'svelte';

	let {
		id,
		startedAt,
		setCount,
		lastSetTs,
		lastEquipmentName,
		lastEquipmentId
	}: {
		id: string;
		startedAt: number;
		setCount: number;
		lastSetTs: number | null;
		lastEquipmentName: string | null;
		lastEquipmentId: string | null;
	} = $props();

	let now = $state(Date.now());
	const handle = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(handle));

	const elapsed = $derived(Math.max(0, Math.floor((now - startedAt) / 1000)));
	const elapsedLabel = $derived.by(() => {
		const m = Math.floor(elapsed / 60);
		const s = elapsed % 60;
		const h = Math.floor(m / 60);
		if (h > 0) return `${h}h ${m % 60}m`;
		return `${m}:${String(s).padStart(2, '0')}`;
	});

	const restRemaining = $derived(
		lastSetTs == null ? null : Math.max(0, 90 - Math.floor((now - lastSetTs) / 1000))
	);

	function fmtRest(s: number): string {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	// With sets: jump back to the last-equipment Log screen. Without sets
	// (manual start, no sets logged yet): land on SessionDetail so the user
	// can End or Delete an empty session without round-tripping via History.
	const href = $derived(lastEquipmentId ? `/log/${lastEquipmentId}` : `/sessions/${id}`);
</script>

<a
	{href}
	class="fixed inset-x-0 z-10 mx-auto block w-full max-w-[480px] px-4"
	style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 65px);"
>
	<div
		class="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
		style="background: var(--color-amber-dim); border-color: var(--color-amber-line); backdrop-filter: blur(8px);"
	>
		<div
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
			style="background: var(--color-amber); color: #1b0a00;"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M12 7v5l3 2"/>
			</svg>
		</div>
		<div class="flex min-w-0 flex-1 flex-col">
			<div
				class="truncate text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-amber);"
			>
				Active session · {elapsedLabel}
			</div>
			<div class="truncate text-[13px] font-semibold tracking-[-0.01em]" style="color: var(--color-text);">
				{#if setCount === 0}
					No sets logged yet · tap to manage
				{:else}
					{setCount} set{setCount === 1 ? '' : 's'} logged
					{#if lastEquipmentName}
						· last on {lastEquipmentName}
					{/if}
				{/if}
			</div>
		</div>
		{#if restRemaining != null && restRemaining > 0}
			<div
				class="flex flex-col items-end text-[11px] font-bold tabular-nums"
				style="color: var(--color-amber);"
			>
				<span>rest</span>
				<span class="text-[14px]">{fmtRest(restRemaining)}</span>
			</div>
		{:else}
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-amber);">
				<path d="M9 6l6 6-6 6"/>
			</svg>
		{/if}
	</div>
</a>
