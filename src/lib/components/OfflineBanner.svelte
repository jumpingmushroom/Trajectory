<script lang="ts">
	import { syncStatus } from '$lib/sync/status';

	const status = $derived($syncStatus);
	const visible = $derived(!status.online || status.pending > 0 || status.authExpired);
</script>

{#if visible}
	<div
		class="fixed inset-x-0 top-0 z-30 px-3 pt-2"
		style="pointer-events: none;"
	>
		<div class="mx-auto max-w-[480px]">
			{#if status.authExpired}
				<div
					role="alert"
					class="flex"
					style="pointer-events: auto;"
				>
					<a
						href="/login?next=/"
						class="flex flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tabular-nums no-underline"
						style="background: rgba(255,90,90,0.16); border-color: rgba(255,90,90,0.45); color: #ff8080; backdrop-filter: blur(6px);"
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full" style="background: #ff8080;"></span>
						<span>Sign in again — {status.pending} unsynced</span>
					</a>
				</div>
			{:else}
				<div
					class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tabular-nums"
					style="background: {status.online
						? 'var(--color-amber-dim)'
						: 'rgba(13,15,18,0.85)'}; border-color: {status.online
						? 'var(--color-amber-line)'
						: 'var(--color-line-2)'}; color: {status.online ? 'var(--color-amber)' : 'var(--color-text-dim)'}; backdrop-filter: blur(6px); pointer-events: auto;"
					role="status"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full"
						style="background: {status.online ? 'var(--color-amber)' : '#ff8080'};"
					></span>
					{#if !status.online}
						<span>Offline</span>
					{/if}
					{#if status.pending > 0}
						<span>
							{#if !status.online}·{/if}
							{status.pending}
							change{status.pending === 1 ? '' : 's'} pending
						</span>
					{/if}
					{#if status.draining}
						<span style="color: var(--color-text-dim-2);">syncing…</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
