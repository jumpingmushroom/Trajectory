<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toast';
</script>

{#if $toasts.length > 0}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-3"
		role="region"
		aria-label="Notifications"
	>
		{#each $toasts as t (t.id)}
			<button
				type="button"
				onclick={() => dismissToast(t.id)}
				class="pointer-events-auto flex w-full max-w-[420px] items-start gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium shadow-lg"
				style="background: {t.kind === 'error'
					? 'rgba(40,12,12,0.96)'
					: 'rgba(13,15,18,0.96)'}; border-color: {t.kind === 'error'
					? 'rgba(255,90,90,0.45)'
					: 'var(--color-line-2)'}; color: {t.kind === 'error'
					? '#ffb3b3'
					: 'var(--color-text)'}; backdrop-filter: blur(6px);"
			>
				<span
					class="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
					style="background: {t.kind === 'error' ? '#ff8080' : 'var(--color-amber)'};"
				></span>
				<span class="flex-1">{t.message}</span>
				<span
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Dismiss
				</span>
			</button>
		{/each}
	</div>
{/if}
