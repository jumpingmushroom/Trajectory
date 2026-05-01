<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Set your password · Trajectory</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	{#if !data.valid}
		<div
			class="flex w-full max-w-[360px] flex-col gap-3 rounded-2xl border p-6 text-center"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Trajectory
			</div>
			<div
				class="text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Invite link is invalid or expired
			</div>
			<p class="text-[13px]" style="color: var(--color-text-dim);">
				Ask the admin to send you a fresh invite.
			</p>
		</div>
	{:else}
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
					Welcome, {data.name}
				</div>
				<div
					class="text-[22px] font-bold tracking-[-0.02em]"
					style="color: var(--color-text);"
				>
					Set your password
				</div>
				<div class="mt-1 text-[12px]" style="color: var(--color-text-dim);">
					Account: {data.email}
				</div>
			</div>

			<label class="flex flex-col gap-1">
				<span
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					New password
				</span>
				<input
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="6"
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
					Confirm password
				</span>
				<input
					name="confirm"
					type="password"
					autocomplete="new-password"
					minlength="6"
					required
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
				{submitting ? 'Saving…' : 'Save password'}
			</button>
		</form>
	{/if}
</main>
