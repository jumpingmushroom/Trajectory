<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let gymFilter = $state<'all' | string>('all');

	const filteredSessions = $derived(
		gymFilter === 'all' ? data.sessions : data.sessions.filter((s) => s.gymId === gymFilter)
	);

	const heatmapDays = $derived.by<number[]>(() => {
		const map = (gymFilter === 'all' ? data.heatmap.all : data.heatmap[gymFilter]) ?? {};
		const out = new Array(84).fill(0);
		for (const [k, v] of Object.entries(map)) {
			const idx = Number(k);
			if (idx >= 0 && idx < 84) out[idx] = v as number;
		}
		return out;
	});

	const weeks = $derived.by(() => {
		const cols: number[][] = [];
		for (let w = 11; w >= 0; w--) {
			const col: number[] = [];
			for (let d = 0; d < 7; d++) {
				col.push(heatmapDays[w * 7 + d] ?? 0);
			}
			cols.push(col);
		}
		return cols;
	});

	const totalSessions = $derived(filteredSessions.length);
	const totalMinutes = $derived(filteredSessions.reduce((a, s) => a + s.durationMin, 0));
	const totalHours = $derived(Math.floor(totalMinutes / 60));
	const totalRemMin = $derived(totalMinutes % 60);

	const currentStreak = $derived.by(() => {
		let streak = 0;
		for (let i = 0; i < heatmapDays.length; i++) {
			if (heatmapDays[i] > 0) streak++;
			else if (i > 0) break;
		}
		return streak;
	});

	function colorFor(v: number): string {
		if (v === 0) return 'rgba(244,237,226,0.05)';
		if (v === 1) return 'rgba(255,140,66,0.35)';
		if (v === 2) return 'rgba(255,140,66,0.62)';
		return 'var(--color-amber)';
	}

	function dayBadge(s: { dayOffset: number; startedAt: number }): {
		primary: string;
		secondary: string;
	} {
		if (s.dayOffset === 0) return { primary: 'Now', secondary: 'today' };
		if (s.dayOffset === 1) return { primary: '1d', secondary: 'ago' };
		if (s.dayOffset < 14) return { primary: `${s.dayOffset}d`, secondary: 'ago' };
		const weeks = Math.round(s.dayOffset / 7);
		return { primary: `${weeks}w`, secondary: 'ago' };
	}

	function summarize(machineNames: string[]): string {
		if (machineNames.length === 0) return 'Empty session';
		const heads = machineNames.slice(0, 4).map((n) => n.split(' ')[0]);
		if (machineNames.length > 4) heads.push(`+${machineNames.length - 4}`);
		return heads.join(' · ');
	}

	function formatVol(kg: number): string {
		if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
		return `${kg} kg`;
	}
</script>

<svelte:head>
	<title>History · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-4 pb-28 pt-12">
	<header class="flex flex-col gap-3">
		<div class="flex items-end gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.16em]"
					style="color: var(--color-text-dim-2);"
				>
					History
				</div>
				<div
					class="mt-0.5 text-[22px] font-bold tracking-[-0.02em]"
					style="color: var(--color-text);"
				>
					Last 12 weeks
				</div>
			</div>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
			<button
				type="button"
				class="flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium"
				style="background: {gymFilter === 'all'
					? 'var(--color-amber-dim)'
					: 'transparent'}; border-color: {gymFilter === 'all'
					? 'var(--color-amber-line)'
					: 'var(--color-line-2)'}; color: {gymFilter === 'all'
					? 'var(--color-amber)'
					: 'var(--color-text-dim)'};"
				onclick={() => (gymFilter = 'all')}
				aria-pressed={gymFilter === 'all'}
			>
				All gyms
			</button>
			{#each data.gyms as g (g.id)}
				<button
					type="button"
					class="flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium"
					style="background: {gymFilter === g.id
						? 'var(--color-amber-dim)'
						: 'transparent'}; border-color: {gymFilter === g.id
						? 'var(--color-amber-line)'
						: 'var(--color-line-2)'}; color: {gymFilter === g.id
						? 'var(--color-amber)'
						: 'var(--color-text-dim)'};"
					onclick={() => (gymFilter = g.id)}
					aria-pressed={gymFilter === g.id}
				>
					{g.name}
				</button>
			{/each}
		</div>
	</header>

	<section
		class="mt-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div class="flex items-baseline justify-between">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Workout frequency
			</div>
			<div class="text-[12px] tabular-nums" style="color: var(--color-text-dim);">
				{totalSessions} session{totalSessions === 1 ? '' : 's'}
			</div>
		</div>
		<div class="mt-3 flex gap-1 overflow-x-auto pb-1" style="scrollbar-width: none;">
			{#each weeks as col, wi (wi)}
				<div class="flex flex-col gap-1">
					{#each col as v, di (di)}
						<div
							class="h-[18px] w-[18px] rounded-[4px]"
							style="background: {colorFor(v)};"
							title={v > 0 ? `${v} session${v === 1 ? '' : 's'}` : 'no sessions'}
						></div>
					{/each}
				</div>
			{/each}
		</div>
		<div
			class="mt-3 flex items-center gap-4 text-[11px] tabular-nums"
			style="color: var(--color-text-dim-2);"
		>
			<div>
				<span class="font-bold" style="color: var(--color-amber);">{currentStreak}</span>
				day streak
			</div>
			<div>
				<span class="font-bold" style="color: var(--color-text);">
					{totalHours}h {totalRemMin}m
				</span>
				total
			</div>
			<div class="ml-auto flex items-center gap-1">
				<span>less</span>
				<span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(0)};"></span>
				<span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(1)};"></span>
				<span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(2)};"></span>
				<span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(3)};"></span>
				<span>more</span>
			</div>
		</div>
	</section>

	<div class="mt-5 px-1 pb-2">
		<div
			class="text-[10px] font-bold uppercase tracking-[0.14em]"
			style="color: var(--color-text-dim-2);"
		>
			Recent sessions
		</div>
	</div>

	{#if filteredSessions.length === 0}
		<div
			class="rounded-2xl border-2 border-dashed p-8 text-center text-[13px]"
			style="border-color: var(--color-line-2); color: var(--color-text-dim);"
		>
			No sessions yet. Log a set on Home to start one.
		</div>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each filteredSessions as s (s.id)}
				{@const badge = dayBadge(s)}
				<li>
					<a
						href={`/sessions/${s.id}`}
						class="flex items-center gap-3 rounded-xl border px-3 py-2.5"
						style="background: var(--color-surface); border-color: var(--color-line);"
					>
						<div
							class="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl border tabular-nums"
							style="background: var(--color-surface-2); border-color: var(--color-line-2);"
						>
							<span class="text-[15px] font-bold leading-none" style="color: var(--color-text);">
								{badge.primary}
							</span>
							<span
								class="mt-0.5 text-[9px]"
								style="color: var(--color-text-dim-2);"
							>
								{badge.secondary}
							</span>
						</div>
						<div class="flex flex-1 flex-col">
							<div
								class="truncate text-[14px] font-semibold tracking-[-0.01em]"
								style="color: var(--color-text);"
							>
								{summarize(s.machineNames)}
							</div>
							<div class="truncate text-[11px] tabular-nums" style="color: var(--color-text-dim);">
								{#if gymFilter === 'all'}
									<span style="color: var(--color-amber);">·</span>
									{s.gymName} ·
								{/if}
								{s.machineCount} machine{s.machineCount === 1 ? '' : 's'} · {s.durationMin} min{#if s.totalVolume > 0}
									 · {formatVol(s.totalVolume)} vol{/if}
							</div>
						</div>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-dim-2);">
							<path d="M9 6l6 6-6 6"/>
						</svg>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<TabBar active="history" />
