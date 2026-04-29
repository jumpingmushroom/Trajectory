<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Trajectory</title>
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center justify-center p-6"
	style="background-image: radial-gradient(1200px 600px at 50% 0%, rgba(255,140,66,0.06), transparent 70%);"
>
	<div class="flex flex-col items-center gap-3">
		<div
			class="text-[10px] font-bold uppercase tracking-[0.16em]"
			style="color: var(--color-text-dim-2);"
		>
			Trajectory
		</div>
		<h1
			class="text-[44px] font-bold leading-none tracking-[-0.02em]"
			style="color: var(--color-text);"
		>
			Hello, gym.
		</h1>
		<div
			class="mt-1 text-[13px] font-medium tabular-nums"
			style="color: var(--color-amber);"
		>
			v{data.version} · M1
		</div>
		<div
			class="mt-6 max-w-[28ch] text-center text-[12px] leading-relaxed"
			style="color: var(--color-text-dim);"
		>
			Equipment-first workout tracker. Self-hosted. Two users. SQLite + bind mount.
			Boot complete.
		</div>
	</div>
</main>
