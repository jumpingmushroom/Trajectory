<script lang="ts">
	let {
		title,
		description = '',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		onConfirm,
		onCancel
	}: {
		title: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onConfirm: () => Promise<void> | void;
		onCancel: () => void;
	} = $props();

	let working = $state(false);

	async function confirm() {
		working = true;
		try {
			await onConfirm();
		} finally {
			working = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={onCancel}
	onkeydown={(e) => {
		if (e.key === 'Escape') onCancel();
	}}
>
	<div
		class="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border p-5"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="flex flex-col gap-1">
			<div
				class="text-[16px] font-semibold tracking-[-0.01em]"
				style="color: var(--color-text);"
			>
				{title}
			</div>
			{#if description}
				<div class="text-[13px] leading-relaxed" style="color: var(--color-text-dim);">
					{description}
				</div>
			{/if}
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				class="flex-1 rounded-full border py-3 text-[14px] font-semibold disabled:opacity-50"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				onclick={onCancel}
				disabled={working}
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="flex-1 rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
				style="background: {danger
					? '#c44545'
					: 'var(--color-amber)'}; color: {danger ? '#fff' : '#1b0a00'};"
				onclick={confirm}
				disabled={working}
			>
				{working ? 'Working…' : confirmLabel}
			</button>
		</div>
	</div>
</div>
