<script lang="ts">
	// Install affordances. Two surfaces:
	//  1. Chrome / Edge / Android: capture beforeinstallprompt and offer
	//     a one-tap "Install" button.
	//  2. iOS Safari: no beforeinstallprompt fires there, so detect iOS +
	//     standalone-not-yet and offer a one-time "Tap Share -> Add to
	//     Home Screen" hint.
	// Dismissal persists in localStorage so we don't nag.

	import { onMount } from 'svelte';

	const DISMISS_KEY = 'trajectory.installPromptDismissed';

	type Choice = 'accepted' | 'dismissed';
	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: Choice }>;
	}

	let installEvent = $state<BeforeInstallPromptEvent | null>(null);
	let isIOSStandalone = $state(false);
	let isIOS = $state(false);
	let dismissed = $state(false);
	let busy = $state(false);

	onMount(() => {
		const stored = localStorage.getItem(DISMISS_KEY);
		if (stored === '1') dismissed = true;

		const ua = navigator.userAgent;
		// iOS Safari ≠ Chrome on iOS, but they all need the same hint.
		isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
		// `navigator.standalone` is iOS-specific; if it's true the app is
		// already launched from the home screen, so we hide the hint.
		isIOSStandalone =
			isIOS && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			installEvent = e as BeforeInstallPromptEvent;
		};
		window.addEventListener('beforeinstallprompt', onBeforeInstall);

		const onInstalled = () => {
			installEvent = null;
			dismissed = true;
			localStorage.setItem(DISMISS_KEY, '1');
		};
		window.addEventListener('appinstalled', onInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	function dismiss() {
		dismissed = true;
		localStorage.setItem(DISMISS_KEY, '1');
	}

	async function install() {
		if (!installEvent) return;
		busy = true;
		try {
			await installEvent.prompt();
			const choice = await installEvent.userChoice;
			if (choice.outcome === 'accepted') {
				dismiss();
			}
			installEvent = null;
		} finally {
			busy = false;
		}
	}

	const showAndroidPrompt = $derived(installEvent !== null && !dismissed);
	const showIOSHint = $derived(isIOS && !isIOSStandalone && !dismissed && installEvent === null);
</script>

{#if showAndroidPrompt}
	<div
		class="flex items-center gap-3 rounded-2xl border p-3"
		style="background: var(--color-amber-dim); border-color: var(--color-amber-line);"
	>
		<div
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
			style="background: var(--color-amber); color: #1b0a00;"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 3v13M6 11l6 6 6-6M4 21h16" />
			</svg>
		</div>
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-amber);"
			>
				Install Trajectory
			</div>
			<div class="text-[12px]" style="color: var(--color-text);">
				Add it to your home screen for one-tap access.
			</div>
		</div>
		<button
			type="button"
			class="rounded-full px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
			style="background: var(--color-amber); color: #1b0a00;"
			onclick={install}
			disabled={busy}
		>
			Install
		</button>
		<button
			type="button"
			class="rounded-full p-1.5"
			style="color: var(--color-text-dim);"
			onclick={dismiss}
			aria-label="Dismiss install prompt"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
			>
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</button>
	</div>
{:else if showIOSHint}
	<div
		class="flex items-center gap-3 rounded-2xl border p-3"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
	>
		<div
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
			style="background: var(--color-amber-dim); color: var(--color-amber);"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 16V4M6 10l6-6 6 6M4 21h16" />
			</svg>
		</div>
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.14em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Add to Home Screen
			</div>
			<div class="text-[12px]" style="color: var(--color-text);">
				Tap <span class="font-semibold">Share</span> in Safari, then
				<span class="font-semibold">Add to Home Screen</span>.
			</div>
		</div>
		<button
			type="button"
			class="rounded-full p-1.5"
			style="color: var(--color-text-dim);"
			onclick={dismiss}
			aria-label="Dismiss install hint"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
			>
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</button>
	</div>
{/if}
