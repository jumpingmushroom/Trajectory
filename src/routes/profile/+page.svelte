<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import PhotoCropper from '$lib/components/PhotoCropper.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let signingOut = $state(false);
	let avatarBusy = $state(false);
	let avatarError = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = $state(null);
	// File picked but not yet cropped — drives the cropper sheet.
	let pendingFile = $state<File | null>(null);
	// Cache-bust the avatar URL when it just changed so the browser refetches.
	let avatarVersion = $state(0);

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

	async function pickAvatar() {
		fileInput?.click();
	}

	function handleAvatarChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (fileInput) fileInput.value = '';
		if (!file) return;
		avatarError = null;
		pendingFile = file;
	}

	async function uploadCropped(blob: Blob, name: string) {
		pendingFile = null;
		avatarBusy = true;
		avatarError = null;
		try {
			const fd = new FormData();
			fd.append('photo', new File([blob], name, { type: blob.type }));
			const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				avatarError = body.message ?? 'Upload failed.';
				return;
			}
			avatarVersion++;
			await invalidateAll();
		} finally {
			avatarBusy = false;
		}
	}

	async function removeAvatar() {
		avatarBusy = true;
		try {
			await fetch('/api/profile/avatar', { method: 'DELETE' });
			avatarVersion++;
			await invalidateAll();
		} finally {
			avatarBusy = false;
		}
	}
</script>

{#if pendingFile}
	<PhotoCropper
		file={pendingFile}
		aspect={1}
		outputSize={{ w: 512, h: 512 }}
		title="Crop avatar"
		onConfirm={uploadCropped}
		onCancel={() => (pendingFile = null)}
	/>
{/if}

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
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M15 6l-6 6 6 6" />
			</svg>
		</a>
		<div class="flex flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.16em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Profile
			</div>
			<div class="text-[22px] font-bold tracking-[-0.02em]" style="color: var(--color-text);">
				{data.userName}
			</div>
		</div>
	</div>

	<div
		class="flex items-center gap-4 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			{#if data.userImage}
				<img
					src={`${data.userImage}?v=${avatarVersion}`}
					alt=""
					class="h-full w-full object-cover"
				/>
			{:else}
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="9" r="3.5" />
					<path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
				</svg>
			{/if}
		</div>
		<div class="flex flex-1 flex-col gap-1">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Avatar
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={pickAvatar}
					disabled={avatarBusy}
					class="rounded-full border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
					style="border-color: var(--color-line-2); color: var(--color-text);"
				>
					{avatarBusy ? 'Saving…' : data.userImage ? 'Replace' : 'Upload'}
				</button>
				{#if data.userImage}
					<button
						type="button"
						onclick={removeAvatar}
						disabled={avatarBusy}
						class="rounded-full border px-3 py-1.5 text-[12px] disabled:opacity-50"
						style="border-color: var(--color-line-2); color: var(--color-text-dim);"
					>
						Remove
					</button>
				{/if}
			</div>
			{#if avatarError}
				<div class="text-[11px]" style="color: #ff8080;">{avatarError}</div>
			{/if}
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				class="hidden"
				onchange={handleAvatarChange}
			/>
		</div>
	</div>

	<div
		class="flex flex-col gap-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-center justify-between">
			<span
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
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
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				style="color: var(--color-text-dim-2);"
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
		</a>

		{#if data.userRole === 'admin'}
			<a
				href="/admin/users"
				class="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			>
				<span class="flex items-center gap-2 text-[14px]">
					Manage users
					<span
						class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase"
						style="background: var(--color-amber-dim); color: var(--color-amber);"
					>
						admin
					</span>
				</span>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="color: var(--color-text-dim-2);"
				>
					<path d="M9 6l6 6-6 6" />
				</svg>
			</a>
		{/if}

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
