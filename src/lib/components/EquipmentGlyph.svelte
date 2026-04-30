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
		<path d="M8 48h44" stroke={stroke} stroke-width={sw}/>
		<path d="M12 48v-8h36v8" stroke={stroke} stroke-width={sw}/>
		<path d="M50 20l18-6v20l-18-6z" stroke={accent} stroke-width={aSw}/>
		<path d="M52 26l-6 4v8" stroke={stroke} stroke-width={sw}/>
		<circle cx="52" cy="14" r="3" stroke={stroke} stroke-width={sw}/>
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
		<rect x="18" y="14" width="16" height="32" rx="3" stroke={stroke} stroke-width={sw}/>
		<path d="M34 22l14-4v20l-14-4" stroke={accent} stroke-width={aSw}/>
		<circle cx="52" cy="28" r="3" stroke={stroke} stroke-width={sw}/>
		<path d="M12 52h46" stroke={stroke} stroke-width={sw}/>
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
	{/if}
</svg>
