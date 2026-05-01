<script lang="ts">
	// Renders a full-screen celebration modal for the head of the unread
	// achievement queue. Tap anywhere to dismiss → POSTs the seen-ack →
	// store removes the head → next badge renders or modal closes.
	//
	// Seeded from `data.achievementQueue` (via $page.data); re-seeded on
	// every layout invalidation so newly-awarded badges fire after the
	// next queue drain + invalidateAll().

	import { page } from '$app/stores';
	import { achievementQueue, type QueuedAchievement } from '$lib/stores/achievementQueue';
	import { BADGE_BY_KEY } from '$lib/achievements/definitions';

	// Re-sync the store any time the layout-load achievement list changes.
	// $effect fires after each `$page.data` update — including post-drain
	// invalidations.
	$effect(() => {
		const list = ($page.data as { achievementQueue?: QueuedAchievement[] })
			.achievementQueue;
		if (Array.isArray(list)) {
			achievementQueue.set(list);
		}
	});

	const queue = $derived($achievementQueue);
	const head = $derived(queue[0] ?? null);
	const def = $derived(head ? (BADGE_BY_KEY.get(head.badgeKey) ?? null) : null);

	let dismissing = $state(false);

	async function dismiss() {
		if (!head || dismissing) return;
		dismissing = true;
		try {
			await fetch(`/api/achievement/${head.id}/seen`, { method: 'POST' });
		} catch {
			// Network down — best effort. The next layout reload will pick
			// up the still-unread row and re-pop. Acceptable.
		}
		achievementQueue.consume(head.id);
		dismissing = false;
	}

	function onKey(e: KeyboardEvent) {
		if (!head) return;
		if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dismiss();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#if head && def}
	<button
		type="button"
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
		style="background: rgba(13,15,18,0.92); backdrop-filter: blur(8px);"
		onclick={dismiss}
		aria-label="Dismiss achievement"
	>
		<div
			class="flex h-32 w-32 items-center justify-center rounded-full border-2"
			style="background: var(--color-amber-dim); border-color: var(--color-amber); color: var(--color-amber); box-shadow: 0 0 60px var(--color-amber-glow);"
		>
			<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M8 21h8" />
				<path d="M12 17v4" />
				<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
				<path d="M17 4h3v3a3 3 0 0 1-3 3" />
				<path d="M7 4H4v3a3 3 0 0 0 3 3" />
			</svg>
		</div>
		<div
			class="mt-8 text-[11px] font-bold uppercase tracking-[0.24em]"
			style="color: var(--color-amber);"
		>
			Achievement unlocked
		</div>
		<div
			class="mt-2 text-center text-[28px] font-bold tracking-[-0.02em]"
			style="color: var(--color-text);"
		>
			{def.title}
		</div>
		<div
			class="mt-2 max-w-[320px] text-center text-[14px]"
			style="color: var(--color-text-dim);"
		>
			{def.description}
		</div>
		<div
			class="mt-10 text-[11px]"
			style="color: var(--color-text-dim-2);"
		>
			tap anywhere to dismiss
		</div>
	</button>
{/if}
