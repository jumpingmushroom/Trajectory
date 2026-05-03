<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let inviteOpen = $state(false);
	let inviteEmail = $state('');
	let inviteName = $state('');
	let inviteError = $state<string | null>(null);
	let inviteBusy = $state(false);
	let actionBusy = $state<string | null>(null);
	let toast = $state<string | null>(null);

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 3000);
	}

	async function submitInvite(e: SubmitEvent) {
		e.preventDefault();
		inviteError = null;
		inviteBusy = true;
		try {
			const res = await fetch('/api/admin/invite', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), name: inviteName.trim() })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				inviteError = readErr(body) ?? 'Invite failed.';
				return;
			}
			inviteEmail = '';
			inviteName = '';
			inviteOpen = false;
			showToast('Invite sent.');
			await invalidateAll();
		} catch (err) {
			console.error('invite failed', err);
			inviteError = 'Network error.';
		} finally {
			inviteBusy = false;
		}
	}

	// SvelteKit's `error(status, msg)` emits `{ message }`; our own json
	// responses use `{ error }`. Read either so toasts show the real reason
	// (e.g. "cannot remove yourself") instead of a generic fallback.
	function readErr(body: unknown): string | null {
		if (body && typeof body === 'object') {
			const b = body as Record<string, unknown>;
			if (typeof b.error === 'string') return b.error;
			if (typeof b.message === 'string') return b.message;
		}
		return null;
	}

	async function resendInvite(userId: string) {
		actionBusy = userId;
		try {
			const res = await fetch(`/api/admin/users/${userId}/resend-invite`, { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				showToast(readErr(body) ?? 'Resend failed.');
				return;
			}
			showToast('Invite resent.');
			await invalidateAll();
		} finally {
			actionBusy = null;
		}
	}

	async function removeUser(userId: string, email: string) {
		if (
			!confirm(
				`Remove ${email}? This deletes their account and all their workout data. Cannot be undone.`
			)
		) {
			return;
		}
		actionBusy = userId;
		try {
			const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				showToast(readErr(body) ?? 'Remove failed.');
				return;
			}
			showToast('User removed.');
			await invalidateAll();
		} finally {
			actionBusy = null;
		}
	}
</script>

<svelte:head>
	<title>Users · Admin · Trajectory</title>
</svelte:head>

<main class="mx-auto max-w-[860px] px-4 py-6 sm:py-10">
	<header class="flex items-center justify-between gap-3 pb-5">
		<div class="flex flex-col gap-1">
			<div
				class="text-[10px] font-bold tracking-[0.16em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Admin
			</div>
			<h1 class="text-[24px] font-bold tracking-[-0.02em]" style="color: var(--color-text);">
				Users ({data.users.length})
			</h1>
		</div>
		<button
			type="button"
			onclick={() => (inviteOpen = !inviteOpen)}
			class="rounded-full px-4 py-2 text-[13px] font-bold"
			style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
		>
			{inviteOpen ? 'Cancel' : 'Invite user'}
		</button>
	</header>

	{#if toast}
		<div
			role="status"
			class="mb-4 rounded-md border px-3 py-2 text-[13px]"
			style="background: var(--color-amber-dim); border-color: var(--color-amber-line); color: var(--color-amber);"
		>
			{toast}
		</div>
	{/if}

	{#if inviteOpen}
		<form
			onsubmit={submitInvite}
			class="mb-6 flex flex-col gap-3 rounded-2xl border p-5"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[11px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				New user
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span
						class="text-[10px] font-bold tracking-[0.14em] uppercase"
						style="color: var(--color-text-dim-2);"
					>
						Email
					</span>
					<input
						bind:value={inviteEmail}
						name="email"
						type="email"
						required
						autocomplete="off"
						autocapitalize="none"
						class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span
						class="text-[10px] font-bold tracking-[0.14em] uppercase"
						style="color: var(--color-text-dim-2);"
					>
						Name
					</span>
					<input
						bind:value={inviteName}
						name="name"
						type="text"
						required
						class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
					/>
				</label>
			</div>
			{#if inviteError}
				<div
					class="rounded-md border px-3 py-2 text-[13px]"
					style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
				>
					{inviteError}
				</div>
			{/if}
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="submit"
					disabled={inviteBusy}
					class="rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-50"
					style="background: var(--color-amber); color: #1b0a00;"
				>
					{inviteBusy ? 'Sending…' : 'Send invite'}
				</button>
			</div>
		</form>
	{/if}

	<div
		class="overflow-hidden rounded-2xl border"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<table class="w-full text-left text-[13px]">
			<thead style="color: var(--color-text-dim-2);">
				<tr class="border-b" style="border-color: var(--color-line);">
					<th class="px-4 py-3 text-[10px] font-bold tracking-[0.14em] uppercase">Email</th>
					<th class="px-4 py-3 text-[10px] font-bold tracking-[0.14em] uppercase">Name</th>
					<th class="px-4 py-3 text-[10px] font-bold tracking-[0.14em] uppercase">Status</th>
					<th class="px-4 py-3 text-[10px] font-bold tracking-[0.14em] uppercase">Created</th>
					<th class="px-4 py-3 text-right text-[10px] font-bold tracking-[0.14em] uppercase">
						Actions
					</th>
				</tr>
			</thead>
			<tbody style="color: var(--color-text);">
				{#each data.users as u (u.id)}
					<tr class="border-b last:border-0" style="border-color: var(--color-line);">
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<span>{u.email}</span>
								{#if u.role === 'admin'}
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase"
										style="background: var(--color-amber-dim); color: var(--color-amber);"
									>
										admin
									</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3">{u.name}</td>
						<td class="px-4 py-3">
							{#if u.status === 'invited'}
								<span style="color: var(--color-text-dim);">Invited</span>
							{:else}
								<span>Active</span>
							{/if}
						</td>
						<td class="px-4 py-3" style="color: var(--color-text-dim);">
							{new Date(u.createdAt).toLocaleDateString()}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-2">
								{#if u.status === 'invited'}
									<button
										type="button"
										onclick={() => resendInvite(u.id)}
										disabled={actionBusy === u.id}
										class="rounded-full border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
										style="border-color: var(--color-line-2); color: var(--color-text);"
									>
										Resend
									</button>
								{/if}
								<button
									type="button"
									onclick={() => removeUser(u.id, u.email)}
									disabled={actionBusy === u.id}
									class="rounded-full border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
									style="border-color: rgba(255,90,90,0.32); color: #ff8080;"
								>
									Remove
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>
