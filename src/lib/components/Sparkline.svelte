<script lang="ts">
	// Tiny inline trend line. Used on Detail (over the equipment glyph)
	// and on Stats (per-machine cards). Not interactive.

	let {
		data,
		width = 120,
		height = 36,
		color = 'var(--color-amber)',
		fill = true
	}: {
		data: number[];
		width?: number;
		height?: number;
		color?: string;
		fill?: boolean;
	} = $props();

	const points = $derived.by(() => {
		if (data.length === 0) return null;
		const min = Math.min(...data);
		const max = Math.max(...data);
		const span = max - min || 1;
		const stepX = data.length > 1 ? width / (data.length - 1) : 0;
		const padY = 2;
		return data.map((v, i) => ({
			x: i * stepX,
			y: padY + (height - padY * 2) * (1 - (v - min) / span)
		}));
	});

	const path = $derived.by(() => {
		if (!points || points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' ');
	});

	const fillPath = $derived.by(() => {
		if (!points || points.length === 0 || !fill) return '';
		const last = points[points.length - 1];
		return `${path} L ${last.x.toFixed(1)} ${height} L 0 ${height} Z`;
	});
</script>

{#if points && points.length > 0}
	<svg viewBox="0 0 {width} {height}" {width} {height} style="overflow:visible;display:block">
		{#if fill}
			<path d={fillPath} fill={color} opacity="0.14" />
		{/if}
		<path
			d={path}
			stroke={color}
			stroke-width="1.5"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/if}
