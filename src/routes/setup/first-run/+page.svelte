<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Set up · Trajectory</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
		class="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border p-6"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex flex-col gap-1">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Welcome, {data.userName}
			</div>
			<div
				class="text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Name your gym
			</div>
			<div class="mt-1 text-[12px]" style="color: var(--color-text-dim);">
				Trajectory is equipment-first. Add a gym now; you'll add machines next.
			</div>
		</div>

		<label class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Gym name
			</span>
			<input
				name="name"
				type="text"
				value={form?.name ?? ''}
				placeholder="Spenst Tønsberg"
				required
				class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			/>
		</label>

		<label class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				City or label (optional)
			</span>
			<input
				name="city"
				type="text"
				value={form?.city ?? ''}
				placeholder="Tønsberg, Home, etc."
				class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			/>
		</label>

		{#if form?.error}
			<div
				class="rounded-md border px-3 py-2 text-[13px]"
				style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
			>
				{form.error}
			</div>
		{/if}

		<button
			type="submit"
			disabled={submitting}
			class="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-full text-[15px] font-bold disabled:opacity-50"
			style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
		>
			{submitting ? 'Creating…' : 'Create gym'}
		</button>
	</form>
</main>
