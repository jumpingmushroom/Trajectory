<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import AchievementBadge from '$lib/components/AchievementBadge.svelte';
	import { BADGE_DEFINITIONS } from '$lib/achievements/definitions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const earnedMap = $derived(
		new Map(data.earnedAchievements.map((a) => [a.badgeKey, a.unlockedAt]))
	);

	// Earned (any badge the user has unlocked) sorted newest first.
	// Locked-visible (non-hidden, not yet earned) sorted in definition order.
	// Hidden+locked badges are not rendered at all.
	const earnedList = $derived(
		BADGE_DEFINITIONS.filter((d) => earnedMap.has(d.key)).sort(
			(a, b) => (earnedMap.get(b.key) ?? 0) - (earnedMap.get(a.key) ?? 0)
		)
	);
	const lockedList = $derived(BADGE_DEFINITIONS.filter((d) => !d.hidden && !earnedMap.has(d.key)));
</script>

<svelte:head>
	<title>Achievements · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pt-12 pb-28">
	<header class="flex items-end gap-3">
		<a
			href="/stats"
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Back to Stats"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M15 6l-6 6 6 6" />
			</svg>
		</a>
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.16em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Collection
			</div>
			<div
				class="mt-0.5 text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Achievements
			</div>
		</div>
		<div class="text-[12px] tabular-nums" style="color: var(--color-text-dim);">
			{earnedList.length}<span style="color: var(--color-text-dim-2);"
				>/{earnedList.length + lockedList.length}</span
			>
		</div>
	</header>

	{#if earnedList.length > 0}
		<section class="mt-5 flex flex-col gap-3">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Earned
			</div>
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
				{#each earnedList as def (def.key)}
					<AchievementBadge {def} earned={true} unlockedAt={earnedMap.get(def.key)} size="lg" />
				{/each}
			</div>
		</section>
	{/if}

	{#if lockedList.length > 0}
		<section class="mt-6 flex flex-col gap-3">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Locked
			</div>
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
				{#each lockedList as def (def.key)}
					<AchievementBadge {def} earned={false} size="lg" />
				{/each}
			</div>
		</section>
	{/if}

	{#if earnedList.length === 0 && lockedList.length === 0}
		<section class="mt-10 flex flex-col items-center gap-3 text-center">
			<div class="text-[14px]" style="color: var(--color-text-dim);">No achievements yet.</div>
			<div class="text-[12px]" style="color: var(--color-text-dim-2);">
				Log a set to start earning badges.
			</div>
		</section>
	{/if}
</main>

<TabBar active="stats" />
