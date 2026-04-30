<script lang="ts">
	// Schematic SVG motif per equipment kind. 11 glyphs ported from the
	// design handoff (components.jsx → EquipmentGlyph). Used as the
	// equipment tile illustration when no photo is uploaded. Stroke-only,
	// no stock photos / no brand marks (per the handoff README).

	import type { GlyphKind } from './glyph-kinds';

	let { kind = 'bench' as GlyphKind, accent = 'var(--color-amber)' }: { kind?: GlyphKind; accent?: string } = $props();

	const stroke = 'rgba(244,237,226,0.85)';
	const sw = 1.5;
	const aSw = 1.75;
</script>

<svg viewBox="0 0 80 60" style="width:100%;height:100%;display:block" stroke-linecap="round" stroke-linejoin="round" fill="none">
	{#if kind === 'legpress'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<rect x="10" y="38" width="20" height="12" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M28 44l32 -28" stroke={accent} stroke-width={aSw}/>
		<path d="M58 16l8 8" stroke={accent} stroke-width={aSw}/>
		<circle cx="62" cy="20" r="4" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'cable'}
		<path d="M12 6v46" stroke={stroke} stroke-width={sw}/>
		<path d="M12 6h28" stroke={stroke} stroke-width={sw}/>
		<path d="M40 6v10c0 4-4 6-8 8l-10 6" stroke={accent} stroke-width={aSw}/>
		<rect x="18" y="32" width="16" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M46 48h26" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'pulldown'}
		<path d="M10 10h60" stroke={stroke} stroke-width={sw}/>
		<path d="M40 10v12" stroke={accent} stroke-width={aSw}/>
		<path d="M26 22h28" stroke={accent} stroke-width={aSw}/>
		<path d="M40 22v10" stroke={accent} stroke-width={aSw}/>
		<rect x="30" y="40" width="20" height="8" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M14 54h52" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'smith'}
		<path d="M14 6v48" stroke={stroke} stroke-width={sw}/>
		<path d="M66 6v48" stroke={stroke} stroke-width={sw}/>
		<path d="M14 28h52" stroke={accent} stroke-width={aSw}/>
		<circle cx="20" cy="28" r="4" stroke={stroke} stroke-width={sw}/>
		<circle cx="60" cy="28" r="4" stroke={stroke} stroke-width={sw}/>
		<path d="M18 54h44" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'bench'}
		<path d="M8 28h64" stroke={accent} stroke-width={aSw}/>
		<circle cx="14" cy="28" r="6" stroke={stroke} stroke-width={sw}/>
		<circle cx="66" cy="28" r="6" stroke={stroke} stroke-width={sw}/>
		<rect x="26" y="34" width="28" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M30 40v12M50 40v12" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'squat'}
		<path d="M16 6v48M64 6v48" stroke={stroke} stroke-width={sw}/>
		<path d="M16 20h48" stroke={stroke} stroke-width={sw}/>
		<path d="M8 34h64" stroke={accent} stroke-width={aSw}/>
		<circle cx="14" cy="34" r="5" stroke={stroke} stroke-width={sw}/>
		<circle cx="66" cy="34" r="5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'preacher'}
		<path d="M8 54h64" stroke={stroke} stroke-width={sw}/>
		<path d="M30 54v-22" stroke={stroke} stroke-width={sw}/>
		<rect x="22" y="44" width="18" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M30 32l28 -14" stroke={accent} stroke-width={aSw}/>
		<path d="M58 18l8 4" stroke={accent} stroke-width={aSw}/>
		<circle cx="68" cy="22" r="3" stroke={accent} stroke-width={aSw}/>
	{:else if kind === 'chestpress'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<rect x="14" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
		<rect x="20" y="38" width="20" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M22 28h28" stroke={accent} stroke-width={aSw}/>
		<path d="M22 36h28" stroke={accent} stroke-width={aSw}/>
		<circle cx="52" cy="28" r="3" stroke={accent} stroke-width={aSw}/>
		<circle cx="52" cy="36" r="3" stroke={accent} stroke-width={aSw}/>
		<rect x="58" y="22" width="8" height="22" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'treadmill'}
		<path d="M10 42l50-14" stroke={accent} stroke-width={aSw}/>
		<path d="M10 42h50" stroke={stroke} stroke-width={sw}/>
		<path d="M60 28v18" stroke={stroke} stroke-width={sw}/>
		<path d="M60 28l8-12v30" stroke={stroke} stroke-width={sw}/>
		<circle cx="16" cy="46" r="3" stroke={stroke} stroke-width={sw}/>
		<circle cx="54" cy="46" r="3" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'bike'}
		<circle cx="22" cy="40" r="10" stroke={stroke} stroke-width={sw}/>
		<circle cx="58" cy="40" r="10" stroke={accent} stroke-width={aSw}/>
		<path d="M22 40l14-16h10l12 16" stroke={stroke} stroke-width={sw}/>
		<path d="M36 24v-8h8" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'rower'}
		<path d="M8 36h64" stroke={accent} stroke-width={aSw}/>
		<circle cx="14" cy="36" r="3" stroke={stroke} stroke-width={sw}/>
		<circle cx="66" cy="36" r="3" stroke={stroke} stroke-width={sw}/>
		<path d="M22 36l18-10h6l10 10" stroke={stroke} stroke-width={sw}/>
		<path d="M46 26l14-14" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'shoulderpress'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<rect x="22" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
		<rect x="28" y="38" width="20" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M30 28v-12" stroke={accent} stroke-width={aSw}/>
		<path d="M46 28v-12" stroke={accent} stroke-width={aSw}/>
		<circle cx="30" cy="14" r="3" stroke={accent} stroke-width={aSw}/>
		<circle cx="46" cy="14" r="3" stroke={accent} stroke-width={aSw}/>
		<rect x="58" y="20" width="8" height="24" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'captainschair'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M40 52v-40" stroke={stroke} stroke-width={sw}/>
		<rect x="32" y="14" width="16" height="20" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M32 24h-12" stroke={accent} stroke-width={aSw}/>
		<path d="M48 24h12" stroke={accent} stroke-width={aSw}/>
		<path d="M40 34v10" stroke={accent} stroke-width={aSw}/>
		<path d="M36 44l4 6 4-6" stroke={accent} stroke-width={aSw}/>
	{:else if kind === 'stairmaster'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M14 52v-6h8v-6h8v-6h8v-6h8v-6h8" stroke={accent} stroke-width={aSw}/>
		<path d="M62 22v-12" stroke={stroke} stroke-width={sw}/>
		<rect x="56" y="6" width="12" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'elliptical'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<circle cx="22" cy="34" r="8" stroke={accent} stroke-width={aSw}/>
		<path d="M22 34l28 12" stroke={accent} stroke-width={aSw}/>
		<path d="M22 34l28 -8" stroke={accent} stroke-width={aSw}/>
		<path d="M50 46h6" stroke={stroke} stroke-width={sw}/>
		<path d="M50 26v-12" stroke={stroke} stroke-width={sw}/>
		<circle cx="50" cy="12" r="2" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'legcurl'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<rect x="12" y="32" width="36" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M16 38v12" stroke={stroke} stroke-width={sw}/>
		<path d="M44 38v12" stroke={stroke} stroke-width={sw}/>
		<path d="M48 32l14 -10" stroke={accent} stroke-width={aSw}/>
		<circle cx="64" cy="22" r="3" stroke={accent} stroke-width={aSw}/>
		<path d="M48 32l4 14" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'legextension'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<rect x="14" y="20" width="6" height="28" rx="2" stroke={stroke} stroke-width={sw}/>
		<rect x="20" y="38" width="22" height="6" rx="2" stroke={stroke} stroke-width={sw}/>
		<path d="M42 38l16 -16" stroke={accent} stroke-width={aSw}/>
		<circle cx="60" cy="20" r="3" stroke={accent} stroke-width={aSw}/>
		<rect x="50" y="44" width="10" height="6" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'hyperextension'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M20 52l28 -32" stroke={accent} stroke-width={aSw}/>
		<path d="M28 52l24 -28" stroke={accent} stroke-width={aSw}/>
		<path d="M44 28l8 -2" stroke={stroke} stroke-width={sw}/>
		<rect x="14" y="42" width="6" height="10" rx="1" stroke={stroke} stroke-width={sw}/>
		<path d="M52 44h8v8" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'pullupbar'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M16 52v-44" stroke={stroke} stroke-width={sw}/>
		<path d="M64 52v-44" stroke={stroke} stroke-width={sw}/>
		<path d="M16 12h48" stroke={accent} stroke-width={aSw}/>
		<path d="M22 16v6" stroke={stroke} stroke-width={sw}/>
		<path d="M30 16v6" stroke={stroke} stroke-width={sw}/>
		<path d="M50 16v6" stroke={stroke} stroke-width={sw}/>
		<path d="M58 16v6" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'dipstation'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M14 52v-26" stroke={stroke} stroke-width={sw}/>
		<path d="M50 36v16" stroke={stroke} stroke-width={sw}/>
		<path d="M14 36h36" stroke={accent} stroke-width={aSw}/>
		<path d="M22 52v-22" stroke={stroke} stroke-width={sw}/>
		<path d="M58 30v22" stroke={stroke} stroke-width={sw}/>
		<path d="M22 30h36" stroke={accent} stroke-width={aSw}/>
	{:else if kind === 'cablecrossover'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M14 52v-44" stroke={stroke} stroke-width={sw}/>
		<path d="M66 52v-44" stroke={stroke} stroke-width={sw}/>
		<path d="M14 8h52" stroke={stroke} stroke-width={sw}/>
		<path d="M14 14l26 24" stroke={accent} stroke-width={aSw}/>
		<path d="M66 14l-26 24" stroke={accent} stroke-width={aSw}/>
		<rect x="36" y="36" width="8" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
	{:else if kind === 'dumbbells'}
		<rect x="14" y="18" width="28" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
		<rect x="10" y="14" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
		<rect x="40" y="14" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
		<rect x="36" y="38" width="28" height="6" rx="1.5" stroke={accent} stroke-width={aSw}/>
		<rect x="32" y="34" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
		<rect x="62" y="34" width="6" height="14" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'barbell'}
		<path d="M8 30h64" stroke={accent} stroke-width={aSw}/>
		<rect x="10" y="20" width="6" height="20" rx="1.5" stroke={stroke} stroke-width={sw}/>
		<rect x="18" y="16" width="4" height="28" rx="1" stroke={stroke} stroke-width={sw}/>
		<rect x="58" y="16" width="4" height="28" rx="1" stroke={stroke} stroke-width={sw}/>
		<rect x="64" y="20" width="6" height="20" rx="1.5" stroke={stroke} stroke-width={sw}/>
	{:else if kind === 'kettlebell'}
		<path d="M8 52h64" stroke={stroke} stroke-width={sw}/>
		<path d="M30 18c0-6 4-10 10-10s10 4 10 10" stroke={stroke} stroke-width={sw}/>
		<path d="M30 18v6" stroke={stroke} stroke-width={sw}/>
		<path d="M50 18v6" stroke={stroke} stroke-width={sw}/>
		<path d="M22 28c0-4 8-6 18-6s18 2 18 6" stroke={accent} stroke-width={aSw}/>
		<path d="M22 28c0 16 6 22 18 22s18-6 18-22" stroke={accent} stroke-width={aSw}/>
	{:else if kind === 'generic'}
		<rect x="20" y="10" width="40" height="40" rx="6" stroke={stroke} stroke-width={sw}/>
		<path d="M40 24v10" stroke={accent} stroke-width={aSw}/>
		<path d="M34 22a6 6 0 0 1 12 0c0 4-6 6-6 8" stroke={accent} stroke-width={aSw}/>
		<circle cx="40" cy="40" r="2" stroke={accent} stroke-width={aSw}/>
	{/if}
</svg>
