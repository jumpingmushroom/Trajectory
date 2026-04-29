<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!name || !password) {
			error = 'Name and password are required.';
			return;
		}
		submitting = true;
		try {
			const email = `${name.trim().toLowerCase()}@trajectory.local`;
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				error = 'Wrong name or password.';
				return;
			}
			await invalidateAll();
			await goto(data.next, { invalidateAll: true });
		} catch (err) {
			console.error('sign-in failed:', err);
			error = 'Something went wrong. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Trajectory</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	<form
		onsubmit={handleSubmit}
		class="flex w-full max-w-[340px] flex-col gap-4 rounded-2xl border p-6"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex flex-col gap-1">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Trajectory
			</div>
			<div
				class="text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Sign in
			</div>
		</div>

		<label class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Name
			</span>
			<input
				bind:value={name}
				name="username"
				type="text"
				autocomplete="username"
				autocapitalize="none"
				autocorrect="off"
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
				Password
			</span>
			<input
				bind:value={password}
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			/>
		</label>

		{#if error}
			<div
				class="rounded-md border px-3 py-2 text-[13px]"
				style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
			>
				{error}
			</div>
		{/if}

		<button
			type="submit"
			disabled={submitting}
			class="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-full text-[15px] font-bold disabled:opacity-50"
			style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
		>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</main>
