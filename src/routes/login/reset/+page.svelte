<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Reset password · Trajectory</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	{#if data.mode === 'request'}
		{#if form && 'sent' in form && form.sent}
			<div
				class="flex w-full max-w-[360px] flex-col gap-3 rounded-2xl border p-6 text-center"
				style="background: var(--color-surface); border-color: var(--color-line);"
			>
				<div
					class="text-[10px] font-bold tracking-[0.16em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Trajectory
				</div>
				<div class="text-[20px] font-bold tracking-[-0.02em]" style="color: var(--color-text);">
					Check your email
				</div>
				<p class="text-[13px]" style="color: var(--color-text-dim);">
					If an account exists for {form.email}, a reset link is on its way. The link expires
					shortly — open it on the same browser you're using now.
				</p>
				<a
					href="/login"
					class="text-center text-[12px] underline-offset-2 hover:underline"
					style="color: var(--color-text-dim);"
				>
					Back to sign in
				</a>
			</div>
		{:else}
			<form
				method="POST"
				action="?/request"
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
						class="text-[10px] font-bold tracking-[0.16em] uppercase"
						style="color: var(--color-text-dim-2);"
					>
						Trajectory
					</div>
					<div class="text-[22px] font-bold tracking-[-0.02em]" style="color: var(--color-text);">
						Reset password
					</div>
					<div class="mt-1 text-[12px]" style="color: var(--color-text-dim);">
						We'll email you a link to choose a new one.
					</div>
				</div>

				<label class="flex flex-col gap-1">
					<span
						class="text-[10px] font-bold tracking-[0.14em] uppercase"
						style="color: var(--color-text-dim-2);"
					>
						Email
					</span>
					<input
						name="email"
						type="email"
						autocomplete="email"
						autocapitalize="none"
						autocorrect="off"
						required
						class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
					/>
				</label>

				{#if form && 'error' in form && form.error}
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
					{submitting ? 'Sending…' : 'Send reset link'}
				</button>

				<a
					href="/login"
					class="text-center text-[12px] underline-offset-2 hover:underline"
					style="color: var(--color-text-dim);"
				>
					Back to sign in
				</a>
			</form>
		{/if}
	{:else}
		<form
			method="POST"
			action="?/confirm"
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
			<input type="hidden" name="token" value={data.token ?? ''} />

			<div class="flex flex-col gap-1">
				<div
					class="text-[10px] font-bold tracking-[0.16em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Trajectory
				</div>
				<div class="text-[22px] font-bold tracking-[-0.02em]" style="color: var(--color-text);">
					Choose a new password
				</div>
			</div>

			<label class="flex flex-col gap-1">
				<span
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
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
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
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

			{#if data.linkError && !form}
				<div
					class="rounded-md border px-3 py-2 text-[13px]"
					style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
				>
					{data.linkError}
				</div>
			{/if}
			{#if form && 'error' in form && form.error}
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
				{submitting ? 'Saving…' : 'Save new password'}
			</button>
		</form>
	{/if}
</main>
