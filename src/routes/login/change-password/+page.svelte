<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (newPassword.length < 6) {
			error = 'New password must be at least 6 characters.';
			return;
		}
		if (newPassword !== confirmPassword) {
			error = 'New password and confirmation do not match.';
			return;
		}

		submitting = true;
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true
			});
			if (result.error) {
				error = result.error.message ?? 'Could not change password.';
				return;
			}
			// Tell the server to clear the mustChangePassword flag.
			const flagRes = await fetch('/api/profile/clear-must-change', { method: 'POST' });
			if (!flagRes.ok) {
				error = 'Password changed but flag clear failed. Sign in again.';
				return;
			}
			// Force a full navigation so hooks.server.ts re-resolves the
			// session (mustChangePassword is now false) and routes the user
			// to first-run or Home as appropriate. A client-side goto here
			// races the page's own load function and sometimes lands back
			// on this screen.
			window.location.href = '/';
		} catch (err) {
			console.error('change-password failed:', err);
			error = 'Something went wrong. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Change password · Trajectory</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	<form
		onsubmit={handleSubmit}
		class="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border p-6"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex flex-col gap-1">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				{data.userName}
			</div>
			<div
				class="text-[20px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				{data.mustChange ? 'Set a new password' : 'Change password'}
			</div>
			{#if data.mustChange}
				<div class="mt-1 text-[12px]" style="color: var(--color-text-dim);">
					You're using a seeded password. Pick a new one before continuing.
				</div>
			{/if}
		</div>

		<label class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Current password
			</span>
			<input
				bind:value={currentPassword}
				name="current-password"
				type="password"
				autocomplete="current-password"
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
				New password
			</span>
			<input
				bind:value={newPassword}
				name="new-password"
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
				Confirm new password
			</span>
			<input
				bind:value={confirmPassword}
				name="confirm-new-password"
				type="password"
				autocomplete="new-password"
				minlength="6"
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
			{submitting ? 'Saving…' : 'Save new password'}
		</button>
	</form>
</main>
