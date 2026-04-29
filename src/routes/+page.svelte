<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const initial = $derived(data.userName.charAt(0).toUpperCase());
	const equipmentCount = $derived(data.equipmentCount ?? 0);
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

	<a
		href="/setup"
		class="mt-3 flex items-center justify-between gap-3 rounded-2xl border p-5"
		style="background: var(--color-surface); border-color: var(--color-line); color: var(--color-text);"
	>
		<div class="flex flex-col">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Equipment
			</div>
			<div class="text-[16px] font-semibold">
				{equipmentCount === 0 ? 'Add your first machine' : `${equipmentCount} ${equipmentCount === 1 ? 'piece' : 'pieces'} set up`}
			</div>
			<div class="mt-1 text-[12px]" style="color: var(--color-text-dim);">
				Open Setup to add equipment, photos and exercises.
			</div>
		</div>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-dim-2);">
			<path d="M9 6l6 6-6 6"/>
		</svg>
	</a>

	<div
		class="mt-auto pt-6 text-center text-[11px] tabular-nums"
		style="color: var(--color-text-dim-2);"
	>
		Trajectory v{data.version} · M4
	</div>
</main>
