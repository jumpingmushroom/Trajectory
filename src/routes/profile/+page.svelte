<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await goto('/login', { invalidateAll: true });
		} catch (err) {
			console.error('sign-out failed:', err);
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Profile · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col gap-4 p-6 pt-14">
	<div class="flex items-center gap-3">
		<a
			href="/"
			class="flex h-9 w-9 items-center justify-center rounded-full border"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
			aria-label="Back"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<path d="M15 6l-6 6 6 6"/>
			</svg>
		</a>
		<div class="flex flex-col">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Profile
			</div>
			<div
				class="text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{data.userName}
			</div>
		</div>
	</div>

	<div
		class="flex flex-col gap-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-center justify-between">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Email
			</span>
			<span class="text-[14px] tabular-nums" style="color: var(--color-text);">
				{data.userEmail}
			</span>
		</div>

		<a
			href="/login/change-password"
			class="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
		>
			<span class="text-[14px]">Change password</span>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-dim-2);">
				<path d="M9 6l6 6-6 6"/>
			</svg>
		</a>

		<button
			type="button"
			onclick={handleSignOut}
			disabled={signingOut}
			class="flex min-h-[44px] items-center justify-center rounded-lg border text-[14px] disabled:opacity-50"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
		>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</button>
	</div>

	<div
		class="mt-auto pt-6 text-center text-[11px] tabular-nums"
		style="color: var(--color-text-dim-2);"
	>
		Trajectory v{data.version} · {data.buildSha}
	</div>
</main>
