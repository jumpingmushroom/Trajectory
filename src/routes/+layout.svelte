<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import { startSyncRuntime } from '$lib/sync/sync';

	let { children } = $props();

	onMount(() => {
		startSyncRuntime();
		// Register the Workbox-generated service worker. injectRegister:'auto'
		// in vite.config doesn't reliably patch SvelteKit's HTML output, so
		// we do it explicitly here. Dynamic import keeps the virtual module
		// out of the SSR bundle.
		if ('serviceWorker' in navigator) {
			import('virtual:pwa-register')
				.then(({ registerSW }) => registerSW({ immediate: true }))
				.catch((err) => console.warn('[trajectory] SW register failed:', err));
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<OfflineBanner />

{@render children()}
