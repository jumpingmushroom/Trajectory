<script lang="ts">
	// Global rest-timer overlay. Rendered once in +layout.svelte so it
	// survives navigation. Reads the shared restTimer store; a single 1s
	// interval drives `now`. The countdown is derived (pure); the alert
	// fires exactly once via shouldFireAlert().

	import { onDestroy } from 'svelte';
	import {
		restTimer,
		remainingSec,
		adjustRest,
		skipRest,
		shouldFireAlert
	} from '$lib/rest/timer';
	import { playRestDone } from '$lib/rest/alert';
	import type { RestSettings } from '$lib/rest/resolve';

	let { settings }: { settings: RestSettings | null } = $props();

	let now = $state(Date.now());
	const handle = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(handle));

	const timerState = $derived($restTimer);
	const remaining = $derived(remainingSec(timerState, now));
	const done = $derived(timerState != null && remaining === 0);

	$effect(() => {
		if (timerState && shouldFireAlert(timerState, now)) {
			playRestDone({ sound: settings?.sound ?? true, vibrate: settings?.vibrate ?? true });
			const finishedId = timerState.setId;
			setTimeout(() => {
				restTimer.update((s) => (s && s.setId === finishedId ? null : s));
			}, 5000);
		}
	});

	function fmt(s: number): string {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}
</script>

{#if timerState}
	<div
		class="fixed inset-x-0 z-20 mx-auto w-full max-w-[480px] px-4"
		style="bottom: calc(max(env(safe-area-inset-bottom, 0px), 12px) + 122px);"
	>
		<div
			class="flex items-stretch gap-2 rounded-2xl border px-3 py-2"
			class:rest-done={done}
			style="background: var(--color-surface); border-color: var(--color-line); backdrop-filter: blur(8px);"
		>
			<div class="flex min-w-0 flex-1 flex-col justify-center">
				<div
					class="truncate text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					{done ? 'Rest done' : 'Resting'} · {timerState.equipmentName}
				</div>
				<div class="text-[20px] font-bold tabular-nums" style="color: var(--color-text);">
					{fmt(remaining)}
				</div>
			</div>
			<button
				type="button"
				onclick={() => adjustRest(-15)}
				class="flex-shrink-0 rounded-xl border px-3 text-[13px] font-semibold active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text);"
				aria-label="Subtract 15 seconds">−15</button
			>
			<button
				type="button"
				onclick={() => adjustRest(15)}
				class="flex-shrink-0 rounded-xl border px-3 text-[13px] font-semibold active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text);"
				aria-label="Add 15 seconds">+15</button
			>
			<button
				type="button"
				onclick={() => skipRest()}
				class="flex w-10 flex-shrink-0 items-center justify-center rounded-xl border active:scale-95"
				style="border-color: var(--color-line-2); color: var(--color-text-dim);"
				aria-label="Skip rest"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.rest-done {
		animation: rest-pulse 0.8s ease-in-out 0s 4;
		border-color: var(--color-green, #4ade80) !important;
	}
	@keyframes rest-pulse {
		0%,
		100% {
			background: var(--color-surface);
		}
		50% {
			background: color-mix(in srgb, var(--color-green, #4ade80) 22%, var(--color-surface));
		}
	}
</style>
