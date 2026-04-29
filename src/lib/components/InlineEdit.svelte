<script lang="ts">
	// Click-to-edit text field. Renders the value as plain text until
	// clicked, then swaps in an <input>. Press Enter or blur to commit;
	// Esc to revert. The parent owns the persistence; we just call
	// onCommit(newValue) when the user confirms a change.

	let {
		value,
		onCommit,
		placeholder = '',
		ariaLabel = 'Edit',
		textClass = '',
		inputClass = ''
	}: {
		value: string;
		onCommit: (next: string) => Promise<void> | void;
		placeholder?: string;
		ariaLabel?: string;
		textClass?: string;
		inputClass?: string;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	function start() {
		draft = value;
		editing = true;
		queueMicrotask(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	async function commit() {
		const next = draft.trim();
		if (next === '' || next === value) {
			editing = false;
			return;
		}
		saving = true;
		try {
			await onCommit(next);
		} finally {
			saving = false;
			editing = false;
		}
	}

	function cancel() {
		draft = value;
		editing = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	}
</script>

{#if editing}
	<input
		bind:this={inputEl}
		bind:value={draft}
		type="text"
		{placeholder}
		aria-label={ariaLabel}
		disabled={saving}
		class="rounded-md border px-2 py-1 text-[14px] outline-none {inputClass}"
		style="background: var(--color-surface-2); border-color: var(--color-amber-line); color: var(--color-text);"
		onblur={commit}
		onkeydown={onKey}
	/>
{:else}
	<button
		type="button"
		class="cursor-text bg-transparent text-left {textClass}"
		aria-label={ariaLabel}
		onclick={start}
	>
		{value}
	</button>
{/if}
