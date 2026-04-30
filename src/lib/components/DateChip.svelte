<script lang="ts">
	import { dayLabel, exitDateMode } from '$lib/dateMode';

	let {
		asOfTs,
		onOpen
	}: {
		asOfTs: number | null;
		onOpen: () => void;
	} = $props();

	const isActive = $derived(asOfTs != null);
	const label = $derived(asOfTs == null ? 'Today' : dayLabel(asOfTs));
</script>

{#if isActive}
	<div
		class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5"
		style="background: var(--color-amber-dim); border-color: var(--color-amber-line);"
	>
		<button
			type="button"
			class="text-[14px] font-bold tracking-[-0.01em]"
			style="color: var(--color-amber);"
			onclick={onOpen}
		>
			{label}
		</button>
		<button
			type="button"
			class="-mr-1 flex h-5 w-5 items-center justify-center rounded-full"
			style="color: var(--color-amber);"
			onclick={() => exitDateMode()}
			aria-label="Exit backdate mode"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round">
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</button>
	</div>
{:else}
	<button
		type="button"
		class="text-left text-[22px] font-bold tracking-[-0.02em]"
		style="color: var(--color-text);"
		onclick={onOpen}
	>
		{label}
	</button>
{/if}
