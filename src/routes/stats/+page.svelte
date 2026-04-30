<script lang="ts">
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import type { GlyphKind } from '$lib/components/glyph-kinds';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const groupOrder: { id: 'push' | 'pull' | 'legs'; label: string }[] = [
		{ id: 'push', label: 'Push' },
		{ id: 'pull', label: 'Pull' },
		{ id: 'legs', label: 'Legs' }
	];

	function fmtNum(n: number): string {
		if (Number.isInteger(n)) return String(n);
		return n.toFixed(1);
	}

	function fmtMin(n: number): string {
		return `${Math.round(n)} min`;
	}

	function fmtKm(n: number): string {
		return `${n.toFixed(1)} km`;
	}
</script>

<svelte:head>
	<title>Stats · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pb-28 pt-12">
	<header class="flex items-end gap-3">
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.16em]"
				style="color: var(--color-text-dim-2);"
			>
				Progression
			</div>
			<div
				class="mt-0.5 text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Stats
			</div>
		</div>
		<a
			href="/api/export.csv?scope=user"
			class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
			style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text);"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 3v13M6 11l6 6 6-6M4 21h16"/>
			</svg>
			CSV
		</a>
	</header>

	<section
		class="mt-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div
			class="text-[10px] font-bold uppercase tracking-[0.14em]"
			style="color: var(--color-text-dim-2);"
		>
			Distribution · last 30 days
		</div>
		<div class="mt-3 flex flex-col gap-2.5">
			{#each groupOrder as g (g.id)}
				{@const v = data.groupCounts[g.id] ?? 0}
				{@const pct = (v / data.groupMax) * 100}
				<div class="flex flex-col gap-1">
					<div class="flex items-baseline justify-between text-[12px] tabular-nums">
						<span class="font-semibold capitalize" style="color: var(--color-text);">
							{g.label}
						</span>
						<span style="color: var(--color-text-dim);">
							{v} set{v === 1 ? '' : 's'}
						</span>
					</div>
					<div
						class="h-[6px] overflow-hidden rounded-full"
						style="background: rgba(244,237,226,0.06);"
					>
						<div
							class="h-full rounded-full transition-[width] duration-500"
							style="width: {pct.toFixed(1)}%; background: var(--color-amber);"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	{#if data.cardioSummary.sessions > 0}
		<section
			class="mt-3 rounded-2xl border p-4"
			style="background: var(--color-surface); border-color: var(--color-line);"
		>
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Cardio · last 30 days
			</div>
			<div class="mt-3 grid grid-cols-3 gap-2">
				<div
					class="flex flex-col gap-0.5 rounded-xl border p-2.5"
					style="background: var(--color-surface-2); border-color: var(--color-line);"
				>
					<span class="text-[10px] font-bold uppercase tracking-[0.12em]" style="color: var(--color-text-dim-2);">
						Total time
					</span>
					<span class="text-[18px] font-bold tabular-nums tracking-[-0.02em]" style="color: var(--color-text);">
						{Math.round(data.cardioSummary.totalMin)}<span class="ml-0.5 text-[11px] font-semibold" style="color: var(--color-text-dim);">min</span>
					</span>
				</div>
				<div
					class="flex flex-col gap-0.5 rounded-xl border p-2.5"
					style="background: var(--color-surface-2); border-color: var(--color-line);"
				>
					<span class="text-[10px] font-bold uppercase tracking-[0.12em]" style="color: var(--color-text-dim-2);">
						Sessions
					</span>
					<span class="text-[18px] font-bold tabular-nums tracking-[-0.02em]" style="color: var(--color-text);">
						{data.cardioSummary.sessions}
					</span>
				</div>
				<div
					class="flex flex-col gap-0.5 rounded-xl border p-2.5"
					style="background: var(--color-surface-2); border-color: var(--color-line);"
				>
					<span class="text-[10px] font-bold uppercase tracking-[0.12em]" style="color: var(--color-text-dim-2);">
						Distance
					</span>
					<span class="text-[18px] font-bold tabular-nums tracking-[-0.02em]" style="color: var(--color-text);">
						{data.cardioSummary.totalKm > 0 ? fmtNum(data.cardioSummary.totalKm) : '—'}<span class="ml-0.5 text-[11px] font-semibold" style="color: var(--color-text-dim);">{data.cardioSummary.totalKm > 0 ? 'km' : ''}</span>
					</span>
				</div>
			</div>
			{#if data.cardioSummary.rows.length > 0}
				<ul class="mt-3 flex flex-col gap-1.5">
					{#each data.cardioSummary.rows as r (r.equipmentId)}
						<li
							class="flex items-center gap-3 rounded-xl border px-3 py-2"
							style="background: var(--color-surface-2); border-color: var(--color-line);"
						>
							<div
								class="h-9 w-9 flex-shrink-0 rounded-lg border p-1.5"
								style="background: linear-gradient(135deg, {r.tint}, var(--color-bg)); border-color: var(--color-line-2);"
							>
								<EquipmentGlyph kind={r.glyph as GlyphKind} />
							</div>
							<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
								<span class="truncate text-[13px] font-semibold tracking-[-0.01em]" style="color: var(--color-text);">
									{r.name}
								</span>
								<span class="text-[11px] tabular-nums" style="color: var(--color-text-dim);">
									{fmtMin(r.totalMin)} · {r.sessions} session{r.sessions === 1 ? '' : 's'}{r.totalKm > 0 ? ` · ${fmtKm(r.totalKm)}` : ''}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<div class="mt-5 px-1 pb-2">
		<div
			class="text-[10px] font-bold uppercase tracking-[0.14em]"
			style="color: var(--color-text-dim-2);"
		>
			By machine
		</div>
	</div>

	{#if data.machineCards.length === 0}
		<div
			class="rounded-2xl border-2 border-dashed p-8 text-center text-[13px]"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			No top-set data yet. Log a few sets and your progression appears here.
		</div>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.machineCards as m (m.equipmentId)}
				{@const hasComparison = m.series.length > 1}
				<li>
					<a
						href={`/equipment/${m.equipmentId}`}
						class="flex items-center gap-3 rounded-xl border px-3 py-3"
						style="background: var(--color-surface); border-color: var(--color-line);"
					>
						<div
							class="h-12 w-12 flex-shrink-0 rounded-xl border p-2"
							style="background: linear-gradient(135deg, {m.tint}, var(--color-bg)); border-color: var(--color-line-2);"
						>
							<EquipmentGlyph kind={m.glyph as GlyphKind} />
						</div>
						<div class="flex flex-1 flex-col gap-1 overflow-hidden">
							<div class="flex items-baseline justify-between gap-3">
								<span
									class="truncate text-[13px] font-semibold tracking-[-0.01em]"
									style="color: var(--color-text);"
								>
									{m.name}
								</span>
								{#if hasComparison}
									<span
										class="text-[12px] font-bold tabular-nums"
										style="color: {m.delta > 0
											? 'var(--color-amber)'
											: m.delta < 0
												? '#ff8080'
												: 'var(--color-text-dim-2)'};"
									>
										{m.delta > 0 ? '+' : ''}{fmtNum(m.delta)}
										{m.unit}
									</span>
								{:else}
									<span
										class="text-[12px] font-bold tabular-nums"
										style="color: var(--color-text-dim-2);"
									>
										{fmtNum(m.lastValue)}
										{m.unit}
									</span>
								{/if}
							</div>
							<div class="h-[28px]">
								<Sparkline data={m.series} width={260} height={28} />
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<a
		href="/api/export.csv?scope=user"
		class="mt-4 flex items-center justify-center gap-2 rounded-2xl border py-3 text-[14px] font-semibold"
		style="background: var(--color-surface); border-color: var(--color-line-2); color: var(--color-text);"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12 3v13M6 11l6 6 6-6M4 21h16"/>
		</svg>
		Export your data as CSV
	</a>
	<a
		href="/api/export.csv?scope=all"
		class="mt-2 text-center text-[11px] underline-offset-2 hover:underline"
		style="color: var(--color-text-dim-2);"
	>
		Export everyone's data as CSV
	</a>
	<div class="mt-2 text-center text-[10px]" style="color: var(--color-text-dim-2);">
		Your data is portable. Always.
	</div>
</main>

<TabBar active="stats" />
