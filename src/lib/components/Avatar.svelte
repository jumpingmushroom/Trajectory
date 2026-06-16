<script lang="ts">
	let {
		name,
		image = null,
		version = 0
	}: { name: string; image?: string | null; version?: string | number } = $props();

	const initial = $derived((name ?? '').charAt(0).toUpperCase());
</script>

{#if image}
	<img
		src={`${image}?v=${version}`}
		alt=""
		class="h-9 w-9 flex-shrink-0 rounded-full object-cover"
	/>
{:else}
	<span
		class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
		style="background: var(--color-amber-dim); color: var(--color-amber);"
	>
		{initial}
	</span>
{/if}
