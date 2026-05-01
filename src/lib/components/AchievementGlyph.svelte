<script lang="ts">
	// Per-badge glyph. Maps the `icon` key from a BadgeDefinition to one of
	// the inline SVGs below. Unknown keys fall back to a generic trophy.
	// Keep the SVG set small; v1 ships a handful of category-coded shapes.
	let { kind, size = 48 }: { kind: string; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	{#if kind === 'medal'}
		<circle cx="12" cy="14" r="6" />
		<path d="M8 8 6 3l2 1 2-1 2 4" />
		<path d="m16 8 2-5-2 1-2-1-2 4" />
	{:else if kind === 'plate-1' || kind === 'plate-2' || kind === 'plate-3' || kind === 'plate-4' || kind === 'plate-5'}
		<rect x="2" y="6" width="2" height="12" rx="0.5" />
		<rect x="20" y="6" width="2" height="12" rx="0.5" />
		<rect x="5" y="10" width="3" height="4" />
		<rect x="16" y="10" width="3" height="4" />
		<rect x="9" y="11" width="6" height="2" />
	{:else if kind === 'heart'}
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
	{:else if kind === 'distance'}
		<path d="M3 12h4l3-8 4 16 3-8h4" />
	{:else if kind === 'stopwatch'}
		<circle cx="12" cy="13" r="8" />
		<path d="M12 9v4l2.5 2M9 2h6" />
	{:else if kind === 'flame'}
		<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c2 0 3-1 3.5-2 .5-2-1-4-1-4-1 .5-2.5 1-3.5 0s-.5-2 0-3c-2 .5-4 2-4 5a4.5 4.5 0 0 0 2.5 4Z" />
	{:else if kind === 'sparkle'}
		<path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1" />
		<circle cx="12" cy="12" r="3" />
	{:else if kind === 'compass'}
		<circle cx="12" cy="12" r="10" />
		<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" />
	{:else if kind === 'moon'}
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
	{:else if kind === 'sunrise'}
		<path d="M17 18a5 5 0 0 0-10 0" />
		<path d="M12 2v7" />
		<path d="M5.6 10.6 4 12" />
		<path d="m20 12-1.6-1.4" />
		<path d="M2 18h20" />
		<path d="m9 5 3-3 3 3" />
	{:else if kind === 'sandwich'}
		<path d="M3 11v3a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-3" />
		<path d="M3 11h18" />
		<path d="M5 11V8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3" />
		<path d="M7 11v.01" />
		<path d="M11 11v.01" />
		<path d="M15 11v.01" />
	{:else if kind === 'hourglass'}
		<path d="M5 22h14" />
		<path d="M5 2h14" />
		<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
		<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
	{:else if kind === 'lightning'}
		<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
	{:else if kind === 'grid'}
		<rect x="3" y="3" width="7" height="7" />
		<rect x="14" y="3" width="7" height="7" />
		<rect x="3" y="14" width="7" height="7" />
		<rect x="14" y="14" width="7" height="7" />
	{:else if kind === 'trophy'}
		<path d="M8 21h8" />
		<path d="M12 17v4" />
		<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
		<path d="M17 4h3v3a3 3 0 0 1-3 3" />
		<path d="M7 4H4v3a3 3 0 0 0 3 3" />
	{:else if kind === 'firework'}
		<circle cx="12" cy="12" r="2" />
		<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
	{:else}
		<!-- Fallback: trophy -->
		<path d="M8 21h8" />
		<path d="M12 17v4" />
		<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
		<path d="M17 4h3v3a3 3 0 0 1-3 3" />
		<path d="M7 4H4v3a3 3 0 0 0 3 3" />
	{/if}
</svg>
