<script lang="ts">
	import AchievementGlyph from './AchievementGlyph.svelte';
	import type { BadgeDefinition } from '$lib/achievements/types';

	let {
		def,
		earned,
		unlockedAt = null,
		size = 'sm'
	}: {
		def: BadgeDefinition;
		earned: boolean;
		unlockedAt?: number | null;
		size?: 'sm' | 'lg';
	} = $props();

	const dim = $derived(size === 'lg' ? 80 : 56);
	const glyphSize = $derived(size === 'lg' ? 40 : 28);

	function fmtDate(ms: number): string {
		const d = new Date(ms);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="flex flex-col items-center gap-1.5">
	<div
		class="flex items-center justify-center rounded-full border-2"
		style="width: {dim}px; height: {dim}px; background: {earned
			? 'var(--color-amber-dim)'
			: 'rgba(244,237,226,0.04)'}; border-color: {earned
			? 'var(--color-amber)'
			: 'var(--color-line-2)'}; color: {earned
			? 'var(--color-amber)'
			: 'var(--color-text-dim-2)'}; opacity: {earned ? 1 : 0.55};"
	>
		<AchievementGlyph kind={def.icon} size={glyphSize} />
	</div>
	{#if size === 'lg'}
		<div
			class="mt-1 max-w-[120px] text-center text-[11px] leading-tight font-semibold"
			style="color: {earned ? 'var(--color-text)' : 'var(--color-text-dim-2)'};"
		>
			{def.title}
		</div>
		<div
			class="max-w-[140px] text-center text-[10px] leading-snug"
			style="color: var(--color-text-dim-2);"
		>
			{def.description}
		</div>
		{#if earned && unlockedAt}
			<div class="text-[10px] font-medium tabular-nums" style="color: var(--color-amber);">
				{fmtDate(unlockedAt)}
			</div>
		{/if}
	{/if}
</div>
