<script lang="ts">
	import type { Gym } from '$lib/server/db/schema';

	let {
		gym,
		onClick
	}: {
		gym: Gym;
		onClick: () => void;
	} = $props();

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w.charAt(0).toUpperCase())
			.join('');
	}
</script>

<button
	type="button"
	class="flex items-center gap-2 rounded-full border px-3 py-1.5"
	style="background: linear-gradient(135deg, {gym.tint}, var(--color-bg)); border-color: var(--color-line-2);"
	onclick={onClick}
	aria-label="Switch gym"
>
	<span
		class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
		style="background: var(--color-amber-dim); color: var(--color-amber);"
	>
		{initials(gym.name)}
	</span>
	<span
		class="max-w-[140px] truncate text-[12px] font-semibold tracking-[-0.01em]"
		style="color: var(--color-text);"
	>
		{gym.name}
	</span>
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		style="color: var(--color-text-dim-2);"
	>
		<path d="M6 9l6 6 6-6" />
	</svg>
</button>
