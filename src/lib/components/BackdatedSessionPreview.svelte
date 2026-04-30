<script lang="ts">
	import { dayLabel, withDateMode } from '$lib/dateMode';

	let {
		asOfTs,
		session
	}: {
		asOfTs: number;
		session: {
			id: string;
			setCount: number;
			lastEquipmentName: string | null;
			lastEquipmentId: string | null;
		} | null;
	} = $props();

	const label = $derived(dayLabel(asOfTs));
	const href = $derived(session ? `/sessions/${session.id}` : null);
</script>

{#if session && href}
	<a
		href={withDateMode(href, asOfTs)}
		class="fixed inset-x-0 z-10 mx-auto block w-full max-w-[480px] px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 65px);"
	>
		<div
			class="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
			style="background: var(--color-amber-dim); border-color: var(--color-amber-line); backdrop-filter: blur(8px);"
		>
			<div
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="5" width="18" height="16" rx="2" />
					<path d="M16 3v4M8 3v4M3 11h18" />
				</svg>
			</div>
			<div class="flex min-w-0 flex-1 flex-col">
				<div
					class="truncate text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-amber);"
				>
					Logging for {label}
				</div>
				<div class="truncate text-[13px] font-semibold tracking-[-0.01em]" style="color: var(--color-text);">
					{session.setCount} set{session.setCount === 1 ? '' : 's'} on file
					{#if session.lastEquipmentName}
						· last on {session.lastEquipmentName}
					{/if}
				</div>
			</div>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-amber);">
				<path d="M9 6l6 6-6 6" />
			</svg>
		</div>
	</a>
{:else}
	<div
		class="fixed inset-x-0 z-10 mx-auto block w-full max-w-[480px] px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 65px);"
	>
		<div
			class="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
			style="background: var(--color-amber-dim); border-color: var(--color-amber-line); backdrop-filter: blur(8px);"
		>
			<div
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
				style="background: var(--color-amber); color: #1b0a00;"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="5" width="18" height="16" rx="2" />
					<path d="M16 3v4M8 3v4M3 11h18" />
				</svg>
			</div>
			<div class="flex min-w-0 flex-1 flex-col">
				<div
					class="truncate text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-amber);"
				>
					Logging for {label}
				</div>
				<div class="truncate text-[13px]" style="color: var(--color-text-dim);">
					No sets logged yet · tap a tile to start
				</div>
			</div>
		</div>
	</div>
{/if}
