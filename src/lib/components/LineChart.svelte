<script lang="ts">
	// Top-set progression chart on Detail screen. Renders a single
	// series with light gridlines + Y-axis labels in tabular-nums.

	let {
		data,
		width = 338,
		height = 170,
		color = 'var(--color-amber)',
		unit = 'kg',
		ySteps = 4
	}: {
		data: number[];
		width?: number;
		height?: number;
		color?: string;
		unit?: string;
		ySteps?: number;
	} = $props();

	const layout = $derived.by(() => {
		if (data.length === 0) return null;
		const padLeft = 36;
		const padRight = 8;
		const padTop = 12;
		const padBottom = 16;
		const innerW = width - padLeft - padRight;
		const innerH = height - padTop - padBottom;
		const rawMin = Math.min(...data);
		const rawMax = Math.max(...data);
		// When the data is flat (or nearly flat), auto-fitting produces a
		// chart full of meaningless 0.x decimals. Expand the y-range so the
		// line sits in the middle of a sensible window.
		const rawSpan = rawMax - rawMin;
		const refMag = Math.max(Math.abs(rawMax), Math.abs(rawMin), 1);
		const minSpan = Math.max(refMag * 0.1, unit === 'kg' ? 5 : 2);
		let min = rawMin;
		let max = rawMax;
		if (rawSpan < minSpan) {
			const center = (rawMin + rawMax) / 2;
			const half = minSpan / 2;
			min = center - half;
			max = center + half;
			// Snap bounds outward to whole-step values so ySteps gridlines
			// land on integers (or sensible 0.5 increments) instead of
			// 78.75 / 81.25 noise.
			const stepGuess = (max - min) / ySteps;
			const niceStep = stepGuess >= 1 ? Math.ceil(stepGuess) : 0.5;
			min = Math.floor(min / niceStep) * niceStep;
			max = min + niceStep * ySteps;
		}
		const span = max - min || 1;
		const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
		const points = data.map((v, i) => ({
			x: padLeft + i * stepX,
			y: padTop + innerH * (1 - (v - min) / span),
			value: v
		}));
		const path = points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' ');
		const lastPoint = points[points.length - 1];
		const fillPath = `${path} L ${lastPoint.x.toFixed(1)} ${height - padBottom} L ${padLeft.toFixed(1)} ${height - padBottom} Z`;
		const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
			const v = min + (span * i) / ySteps;
			const y = padTop + innerH * (1 - i / ySteps);
			return { v, y, label: roundLabel(v) };
		});
		return { points, path, fillPath, lastPoint, yLabels, padLeft, padTop, innerW, innerH };
	});

	function roundLabel(v: number): string {
		if (Math.abs(v) >= 100) return v.toFixed(0);
		if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, '');
		return v.toFixed(1).replace(/\.0$/, '');
	}
</script>

{#if layout}
	<svg viewBox="0 0 {width} {height}" {width} {height} style="overflow:visible;display:block">
		<!-- gridlines -->
		{#each layout.yLabels as gl, i (i)}
			<line
				x1={layout.padLeft}
				x2={width - 8}
				y1={gl.y}
				y2={gl.y}
				stroke="rgba(255,255,255,0.05)"
				stroke-dasharray="2 4"
			/>
			<text
				x={layout.padLeft - 6}
				y={gl.y + 3.5}
				font-size="9"
				font-family="Inter, sans-serif"
				font-weight="500"
				fill="rgba(244,237,226,0.38)"
				text-anchor="end"
			>
				{gl.label}
			</text>
		{/each}

		<!-- area + line -->
		<path d={layout.fillPath} fill={color} opacity="0.12" />
		<path d={layout.path} stroke={color} stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />

		<!-- last point dot + value -->
		<circle cx={layout.lastPoint.x} cy={layout.lastPoint.y} r="3.5" fill={color} />
		<text
			x={Math.min(layout.lastPoint.x + 8, width - 8)}
			y={Math.max(layout.lastPoint.y - 6, 12)}
			font-size="10"
			font-family="Inter, sans-serif"
			font-weight="700"
			fill={color}
			text-anchor={layout.lastPoint.x > width - 60 ? 'end' : 'start'}
		>
			{roundLabel(layout.lastPoint.value)}
			{unit}
		</text>
	</svg>
{:else}
	<div
		class="flex items-center justify-center"
		style="width:{width}px;height:{height}px;color:var(--color-text-dim-2);font-size:12px"
	>
		No data yet
	</div>
{/if}
