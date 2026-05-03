<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { syncStatus } from '$lib/sync/status';
	import type { Gym } from '$lib/server/db/schema';

	let {
		gyms,
		activeGymId,
		onClose
	}: {
		gyms: Gym[];
		activeGymId: string;
		onClose: () => void;
	} = $props();

	let switching = $state(false);

	async function pick(g: Gym) {
		if (g.id === activeGymId) {
			onClose();
			return;
		}
		switching = true;
		try {
			const res = await fetch('/api/active-gym', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ gymId: g.id })
			});
			if (!res.ok) {
				console.error('switch gym failed:', await res.text());
				return;
			}
			if ($syncStatus.online) await invalidateAll();
			onClose();
		} finally {
			switching = false;
		}
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w.charAt(0).toUpperCase())
			.join('');
	}
</script>

<div
	class="fixed inset-0 z-40 flex items-end bg-black/60 sm:items-center sm:justify-center"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
>
	<div
		class="flex max-h-[80vh] w-full flex-col gap-3 overflow-y-auto rounded-t-3xl border-t p-5 pb-7 sm:max-w-[420px] sm:rounded-3xl sm:border"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="mx-auto h-1 w-10 rounded-full" style="background: rgba(255,255,255,0.18);"></div>

		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Switch gym
				</div>
				<div
					class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
					style="color: var(--color-text);"
				>
					Where are you?
				</div>
			</div>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full"
				style="color: var(--color-text-dim);"
				onclick={onClose}
				aria-label="Close"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
				>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</div>

		<ul class="flex flex-col gap-2">
			{#each gyms as g (g.id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-50"
						style="background: linear-gradient(135deg, {g.tint}, var(--color-bg)); border-color: {g.id ===
						activeGymId
							? 'var(--color-amber-line)'
							: 'var(--color-line-2)'};"
						onclick={() => pick(g)}
						disabled={switching}
					>
						<span
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border text-[13px] font-bold"
							style="background: var(--color-surface-2); border-color: var(--color-line-2); color: {g.id ===
							activeGymId
								? 'var(--color-amber)'
								: 'var(--color-text-dim)'};"
						>
							{initials(g.name)}
						</span>
						<span class="flex flex-1 flex-col">
							<span
								class="text-[14px] font-semibold tracking-[-0.01em]"
								style="color: var(--color-text);"
							>
								{g.name}
							</span>
							<span class="text-[11px]" style="color: var(--color-text-dim);">
								{g.city ?? 'No city'}
							</span>
						</span>
						{#if g.id === activeGymId}
							<span
								class="rounded-md px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] uppercase"
								style="background: var(--color-amber-dim); color: var(--color-amber);"
							>
								Active
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		<a
			href="/setup"
			class="flex items-center justify-center gap-2 rounded-full border-2 border-dashed py-2.5 text-[13px] font-semibold"
			style="border-color: var(--color-line-2); color: var(--color-amber);"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 5v14M5 12h14" />
			</svg>
			Manage gyms in Setup
		</a>
	</div>
</div>
