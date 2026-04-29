<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const initial = $derived(data.userName.charAt(0).toUpperCase());
</script>

<svelte:head>
	<title>Trajectory</title>
</svelte:head>

<main
	class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-6 pt-14"
	style="background-image: radial-gradient(1200px 600px at 50% 0%, rgba(255,140,66,0.06), transparent 70%);"
>
	<header class="flex items-start gap-3">
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Trajectory
			</div>
			<div
				class="mt-0.5 text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Today
			</div>
		</div>
		<a
			href="/profile"
			class="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
			style="background: var(--color-amber-dim); color: var(--color-amber);"
			aria-label="Open profile"
		>
			{initial}
		</a>
	</header>

	<section
		class="mt-6 flex flex-col gap-2 rounded-2xl border p-5"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div
			class="text-[10px] font-bold uppercase tracking-[0.14em]"
			style="color: var(--color-text-dim-2);"
		>
			Active gym
		</div>
		<div
			class="text-[18px] font-semibold tracking-[-0.01em]"
			style="color: var(--color-text);"
		>
			{data.gymName}
		</div>
		{#if data.gymCity}
			<div class="text-[12px]" style="color: var(--color-text-dim);">
				{data.gymCity}
			</div>
		{/if}
		<div class="mt-3 text-[12px]" style="color: var(--color-text-dim);">
			Equipment, sessions and stats land here as the milestones ship.
		</div>
	</section>

	<section
		class="mt-3 flex flex-col gap-1 rounded-2xl border p-5"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div
			class="text-[10px] font-bold uppercase tracking-[0.14em]"
			style="color: var(--color-text-dim-2);"
		>
			Signed in as
		</div>
		<div class="text-[16px] font-semibold" style="color: var(--color-text);">
			{data.userName}
		</div>
	</section>

	<div
		class="mt-auto pt-6 text-center text-[11px] tabular-nums"
		style="color: var(--color-text-dim-2);"
	>
		Trajectory v{data.version} · M3
	</div>
</main>
