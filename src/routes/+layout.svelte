<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import { startSyncRuntime } from '$lib/sync/sync';

	let { children } = $props();

	onMount(() => {
		startSyncRuntime();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<OfflineBanner />

{@render children()}
