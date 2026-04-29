<script lang="ts">
	// Big weight stepper. Tap +/- for one step (default 2.5 kg).
	// Hold either button to auto-increment via the shared holdRepeat
	// action (350 ms grace, then ~80 ms ticks).

	import { holdRepeat } from '$lib/actions/holdRepeat';

	let {
		value,
		onChange,
		step = 2.5,
		min = 0,
		max = 1000,
		label = 'WEIGHT',
		unit = 'kg',
		hint
	}: {
		value: number;
		onChange: (next: number) => void;
		step?: number;
		min?: number;
		max?: number;
		label?: string;
		unit?: string;
		hint?: string;
	} = $props();

	function clamp(v: number): number {
		return Math.max(min, Math.min(max, v));
	}

	function snap(v: number): number {
		// Round to nearest `step` to avoid float drift after long hold.
		const k = Math.round(v / step);
		return clamp(k * step);
	}

	function nudge(direction: 1 | -1) {
		onChange(snap(value + direction * step));
	}

	function fmt(v: number): string {
		if (Number.isInteger(v)) return String(v);
		return v.toFixed(1);
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between">
		<span
			class="text-[10px] font-bold uppercase tracking-[0.16em]"
			style="color: var(--color-text-dim-2);"
		>
			{label}
		</span>
		{#if hint}
			<span class="text-[11px]" style="color: var(--color-text-dim-2);">{hint}</span>
		{/if}
	</div>
	<div
		class="flex items-center gap-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<button
			type="button"
			class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border active:scale-95"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			use:holdRepeat={{ onTick: () => nudge(-1) }}
			aria-label="Decrease"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<path d="M5 12h14"/>
			</svg>
		</button>
		<div class="flex flex-1 items-baseline justify-center gap-2">
			<span
				class="text-[40px] font-bold tabular-nums tracking-[-0.04em]"
				style="color: var(--color-text);"
			>
				{fmt(value)}
			</span>
			<span class="text-[14px] font-medium" style="color: var(--color-text-dim);">
				{unit}
			</span>
		</div>
		<button
			type="button"
			class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border active:scale-95"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			use:holdRepeat={{ onTick: () => nudge(1) }}
			aria-label="Increase"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<path d="M12 5v14M5 12h14"/>
			</svg>
		</button>
	</div>
</div>
