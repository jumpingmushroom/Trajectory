<script lang="ts">
	// Tile shown on Home for one piece of equipment. Renders a tinted
	// gradient background with either the user-uploaded photo or the
	// schematic glyph as the visual. The bottom strip shows the user's
	// last set on this equipment (or 'Never logged' if nothing yet).

	import EquipmentGlyph from './EquipmentGlyph.svelte';
	import type { GlyphKind } from './glyph-kinds';
	import type { Equipment } from '$lib/server/db/schema';
	import { formatDurationMinAsClock } from '$lib/input-modes';

	let {
		equipment,
		lastWeight,
		lastReps,
		lastDurationMin,
		lastDistance = null,
		lastBwLoadKg = null,
		daysSince,
		href
	}: {
		equipment: Equipment;
		lastWeight: number | null;
		lastReps: number | null;
		lastDurationMin: number | null;
		// Distance from the most recent set's extras. Used to render the
		// last-set summary on weight_distance equipment (carries).
		lastDistance?: number | null;
		// Bodyweight contribution snapshotted on the most recent set. Adds
		// to lastWeight when present so the tile shows effective load.
		lastBwLoadKg?: number | null;
		daysSince: number | null;
		href: string;
	} = $props();

	const mode = $derived(equipment.inputMode ?? 'weighted');
	const photoSrc = $derived(
		equipment.photoPath
			? `/uploads/${equipment.photoPath}?v=${equipment.updatedAt.getTime()}`
			: null
	);

	function formatDistance(m: number): string {
		if (m >= 500 || !Number.isInteger(m)) return `${(m / 1000).toFixed(2)} km`;
		return `${m} m`;
	}

	function formatLast(): { primary: string; secondary: string } {
		if (daysSince == null) return { primary: 'Never logged', secondary: '' };
		const ago = daysSince === 0 ? 'today' : daysSince === 1 ? '1d ago' : `${daysSince}d ago`;
		if (mode === 'distance_time') {
			if (lastDurationMin != null) {
				return { primary: `${formatNum(lastDurationMin)} min`, secondary: ago };
			}
			return { primary: 'Logged', secondary: ago };
		}
		if (mode === 'timed') {
			if (lastDurationMin != null) {
				return { primary: formatDurationMinAsClock(lastDurationMin), secondary: ago };
			}
			return { primary: 'Logged', secondary: ago };
		}
		if (mode === 'timed_weighted') {
			if (lastDurationMin != null && lastWeight != null) {
				return {
					primary: `${formatDurationMinAsClock(lastDurationMin)} × ${formatNum(lastWeight)} kg`,
					secondary: ago
				};
			}
			return { primary: 'Logged', secondary: ago };
		}
		if (mode === 'weight_distance') {
			if (lastWeight != null && lastDistance != null) {
				return {
					primary: `${formatNum(lastWeight)} kg × ${formatDistance(lastDistance)}`,
					secondary: ago
				};
			}
			return { primary: 'Logged', secondary: ago };
		}
		if (lastWeight != null && lastReps != null) {
			const display = lastWeight + (lastBwLoadKg ?? 0);
			return {
				primary: `${formatNum(display)} kg × ${lastReps}`,
				secondary: ago
			};
		}
		return { primary: 'Logged', secondary: ago };
	}

	function formatNum(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	const last = $derived(formatLast());
</script>

<a
	{href}
	class="group flex flex-col overflow-hidden rounded-2xl border transition-transform active:scale-[0.98]"
	style="background: linear-gradient(135deg, {equipment.tint} 0%, var(--color-bg) 100%); border-color: var(--color-line);"
>
	<div class="relative aspect-[4/3] flex-1 overflow-hidden">
		{#if photoSrc}
			<img
				src={photoSrc}
				alt={equipment.name}
				class="absolute inset-0 h-full w-full object-cover"
			/>
			<div
				class="absolute inset-0"
				style="background: linear-gradient(180deg, rgba(13,15,18,0) 40%, rgba(13,15,18,0.7) 100%);"
			></div>
		{:else}
			<div class="absolute inset-5">
				<EquipmentGlyph kind={equipment.glyph as GlyphKind} />
			</div>
		{/if}
	</div>

	<div
		class="flex flex-col gap-0.5 px-3 pt-2 pb-3"
		style="background: rgba(13,15,18,0.75); backdrop-filter: blur(6px);"
	>
		<div
			class="truncate text-[13px] font-semibold tracking-[-0.01em]"
			style="color: var(--color-text);"
		>
			{equipment.name}
		</div>
		<div class="flex items-baseline justify-between gap-2 tabular-nums">
			<span class="truncate text-[12px] font-medium" style="color: var(--color-text-dim);">
				{last.primary}
			</span>
			{#if last.secondary}
				<span class="flex-shrink-0 text-[10px]" style="color: var(--color-text-dim-2);">
					{last.secondary}
				</span>
			{/if}
		</div>
	</div>
</a>
