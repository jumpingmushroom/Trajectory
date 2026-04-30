<script lang="ts">
	import EquipmentTile from '$lib/components/EquipmentTile.svelte';
	import GymChip from '$lib/components/GymChip.svelte';
	import GymSheet from '$lib/components/GymSheet.svelte';
	import SessionBar from '$lib/components/SessionBar.svelte';
	import BackdatedSessionPreview from '$lib/components/BackdatedSessionPreview.svelte';
	import DateChip from '$lib/components/DateChip.svelte';
	import DateModeSheet from '$lib/components/DateModeSheet.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import { withDateMode } from '$lib/dateMode';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Filter = 'all' | 'push' | 'pull' | 'legs' | 'core' | 'cardio';
	const filters: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'push', label: 'Push' },
		{ id: 'pull', label: 'Pull' },
		{ id: 'legs', label: 'Legs' },
		{ id: 'core', label: 'Core' },
		{ id: 'cardio', label: 'Cardio' }
	];

	let filter = $state<Filter>('all');
	let gymSheetOpen = $state(false);
	let dateSheetOpen = $state(false);

	const asOfTs = $derived(data.asOfTs);

	const visibleTiles = $derived(
		filter === 'all'
			? [...data.tiles].sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999))
			: data.tiles
					.filter((t) => t.equipment.group === filter)
					.sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999))
	);

	const initial = $derived(data.userName.charAt(0).toUpperCase());
</script>

<svelte:head>
	<title>Trajectory</title>
</svelte:head>

<main
	class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pb-32 pt-12"
	style="background-image: radial-gradient(1200px 600px at 50% 0%, rgba(255,140,66,0.06), transparent 70%);"
>
	<header class="flex flex-col gap-3">
		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.16em]"
					style="color: var(--color-text-dim-2);"
				>
					Trajectory
				</div>
				<div class="mt-0.5">
					<DateChip {asOfTs} onOpen={() => (dateSheetOpen = true)} />
				</div>
			</div>
			<GymChip gym={data.activeGym} onClick={() => (gymSheetOpen = true)} />
			<a
				href="/profile"
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
				style="background: var(--color-amber-dim); color: var(--color-amber);"
				aria-label="Open profile"
			>
				{initial}
			</a>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
			{#each filters as f (f.id)}
				<button
					type="button"
					class="flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium"
					style="background: {filter === f.id
						? 'var(--color-amber-dim)'
						: 'transparent'}; border-color: {filter === f.id
						? 'var(--color-amber-line)'
						: 'var(--color-line-2)'}; color: {filter === f.id
						? 'var(--color-amber)'
						: 'var(--color-text-dim)'};"
					onclick={() => (filter = f.id)}
					aria-pressed={filter === f.id}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</header>

	<div class="mt-3">
		<InstallPrompt />
	</div>

	{#if data.tiles.length === 0}
		<section
			class="mt-8 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center"
			style="border-color: var(--color-line-2);"
		>
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				{data.activeGym.name}
			</div>
			<div class="text-[16px] font-semibold" style="color: var(--color-text);">
				No equipment yet
			</div>
			<div class="max-w-[28ch] text-[13px]" style="color: var(--color-text-dim);">
				Add your first machine in Setup so you have something to log against.
			</div>
			<a
				href="/setup"
				class="mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				Open Setup
			</a>
		</section>
	{:else if visibleTiles.length === 0}
		<section
			class="mt-6 rounded-2xl border-2 border-dashed p-6 text-center text-[13px]"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			Nothing in this category yet.
		</section>
	{:else}
		<section class="mt-3 grid grid-cols-2 gap-3">
			{#each visibleTiles as tile (tile.equipment.id)}
				<EquipmentTile
					equipment={tile.equipment}
					lastWeight={tile.lastWeight}
					lastReps={tile.lastReps}
					lastDurationMin={tile.lastDurationMin}
					daysSince={tile.daysSince}
					href={withDateMode(`/equipment/${tile.equipment.id}`, asOfTs)}
				/>
			{/each}
		</section>
	{/if}

	<a
		href="/setup"
		class="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-dashed py-3 text-[13px] font-semibold"
		style="border-color: var(--color-line-2); color: var(--color-amber);"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12 5v14M5 12h14"/>
		</svg>
		Add equipment
	</a>
</main>

{#if asOfTs != null}
	<BackdatedSessionPreview {asOfTs} session={data.backdatedSession} />
{:else if data.activeSession}
	<SessionBar
		startedAt={data.activeSession.startedAt}
		setCount={data.activeSession.setCount}
		lastSetTs={data.activeSession.lastSetTs}
		lastEquipmentName={data.activeSession.lastEquipmentName}
		lastEquipmentId={data.activeSession.lastEquipmentId}
	/>
{/if}

<TabBar active="home" />

{#if gymSheetOpen}
	<GymSheet
		gyms={data.gyms}
		activeGymId={data.activeGym.id}
		onClose={() => (gymSheetOpen = false)}
	/>
{/if}

{#if dateSheetOpen}
	<DateModeSheet {asOfTs} onClose={() => (dateSheetOpen = false)} />
{/if}
