<script lang="ts">
	// Compact stepper for reps + target sets. Tap +/- for one step;
	// holding repeats via the shared holdRepeat action.

	import { holdRepeat } from '$lib/actions/holdRepeat';

	let {
		value,
		onChange,
		step = 1,
		min = 1,
		max = 99,
		label
	}: {
		value: number;
		onChange: (next: number) => void;
		step?: number;
		min?: number;
		max?: number;
		label: string;
	} = $props();

	function nudge(direction: 1 | -1) {
		// Force integer — reps and target-set counts can never be fractional,
		// so even if `value` arrives non-integer (external set, future bug)
		// we land on a whole number after a single tap.
		const next = Math.round(value + direction * step);
		onChange(Math.max(min, Math.min(max, next)));
	}
</script>

<div
	class="flex flex-col gap-1.5 rounded-xl border p-3"
	style="background: var(--color-surface); border-color: var(--color-line);"
>
	<span
		class="text-[10px] font-bold uppercase tracking-[0.14em]"
		style="color: var(--color-text-dim-2);"
	>
		{label}
	</span>
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border active:scale-95"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			use:holdRepeat={{ onTick: () => nudge(-1) }}
			aria-label="Decrease {label.toLowerCase()}"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<path d="M5 12h14"/>
			</svg>
		</button>
		<span
			class="flex-1 text-center text-[20px] font-bold tabular-nums"
			style="color: var(--color-text);"
		>
			{value}
		</span>
		<button
			type="button"
			class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border active:scale-95"
			style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			use:holdRepeat={{ onTick: () => nudge(1) }}
			aria-label="Increase {label.toLowerCase()}"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<path d="M12 5v14M5 12h14"/>
			</svg>
		</button>
	</div>
</div>
