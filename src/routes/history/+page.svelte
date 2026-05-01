<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import type { PageData } from './$types';

	function startOfDay(d: Date): Date {
		const out = new Date(d);
		out.setHours(0, 0, 0, 0);
		return out;
	}

	function addDays(d: Date, n: number): Date {
		const out = new Date(d);
		out.setDate(out.getDate() + n);
		return out;
	}

	// Monday-anchored start-of-week. JS getDay() is 0=Sun..6=Sat; we want
	// 0=Mon..6=Sun, so the offset to subtract is (getDay()+6) % 7.
	function startOfWeekMonday(d: Date): Date {
		const sod = startOfDay(d);
		const offset = (sod.getDay() + 6) % 7;
		return addDays(sod, -offset);
	}

	const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });

	let { data }: { data: PageData } = $props();

	let gymFilter = $state<'all' | string>('all');

	// Only chip-list gyms where this user has actually trained — otherwise
	// every shared/test gym ever seeded shows up forever.
	const visibleGyms = $derived.by(() => {
		const seen = new Set(data.sessions.map((s) => s.gymId));
		return data.gyms.filter((g) => seen.has(g.id));
	});

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

	const today = $derived.by(() => startOfDay(new Date()));
	const thisMonday = $derived.by(() => startOfWeekMonday(today));

	interface HeatmapCell {
		value: number;
		date: Date;
		isFuture: boolean;
	}

	const weekCells = $derived.by<HeatmapCell[][]>(() => {
		const cols: HeatmapCell[][] = [];
		for (let c = 0; c < 12; c++) {
			// Leftmost column (c=0) is the oldest week, rightmost (c=11) is the
			// current in-progress week. Each column's anchor is its Monday.
			const colMonday = addDays(thisMonday, (c - 11) * 7);
			const col: HeatmapCell[] = [];
			for (let r = 0; r < 7; r++) {
				const cellDate = addDays(colMonday, r);
				const offsetDays = Math.round(
					(today.getTime() - cellDate.getTime()) / 86_400_000
				);
				const value =
					offsetDays >= 0 && offsetDays < heatmapDays.length
						? heatmapDays[offsetDays] ?? 0
						: 0;
				col.push({
					value,
					date: cellDate,
					isFuture: offsetDays < 0
				});
			}
			cols.push(col);
		}
		return cols;
	});

	const todayCol = 11; // rightmost column is always the current week
	const todayRow = $derived.by(() => (today.getDay() + 6) % 7);

	interface MonthLabel {
		col: number;
		label: string;
	}

	const monthLabels = $derived.by<MonthLabel[]>(() => {
		const out: MonthLabel[] = [];
		let prevMonth = -1;
		for (let c = 0; c < 12; c++) {
			const colMonday = addDays(thisMonday, (c - 11) * 7);
			const m = colMonday.getMonth();
			if (m !== prevMonth) {
				out.push({ col: c, label: monthFmt.format(colMonday) });
				prevMonth = m;
			}
		}
		// Drop a label that lands on the very last column if there's already
		// one earlier — prevents two month names crowding the right edge.
		if (out.length >= 2 && out[out.length - 1].col === 11) {
			const before = out[out.length - 2];
			if (11 - before.col <= 1) out.pop();
		}
		return out;
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
		if (s.dayOffset === 0) return { primary: 'Today', secondary: '' };
		if (s.dayOffset === 1) return { primary: '1d', secondary: 'ago' };
		if (s.dayOffset < 14) return { primary: `${s.dayOffset}d`, secondary: 'ago' };
		const weeks = Math.round(s.dayOffset / 7);
		return { primary: `${weeks}w`, secondary: 'ago' };
	}

	function summarize(machineNames: string[]): string {
		if (machineNames.length === 0) return 'Empty session';
		// Use the first 2 full equipment names. First word alone (e.g.
		// "Power" from "Power Rack #2") is too ambiguous when several
		// machines share a prefix.
		const heads = machineNames.slice(0, 2);
		if (machineNames.length > 2) {
			return `${heads.join(' · ')} +${machineNames.length - 2}`;
		}
		return heads.join(' · ');
	}

	function formatVol(kg: number): string {
		const rounded = Math.round(kg);
		// Use a thin space as the thousands separator so the unit stays
		// consistent across the list — switching to t for 1000+ kg makes
		// rows incomparable at a glance.
		return `${rounded.toLocaleString('en-US').replace(/,/g, ' ')} kg`;
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
			{#each visibleGyms as g (g.id)}
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
		<div class="relative mt-2 h-[14px]" style="padding-left: 32px;">
			{#each monthLabels as ml (ml.col)}
				<div
					class="absolute top-0 text-[9px] font-bold uppercase tracking-[0.12em]"
					style="left: calc(32px + {ml.col} * 22px); color: var(--color-text-dim-2);"
				>
					{ml.label}
				</div>
			{/each}
		</div>
		<div class="mt-1 flex items-end gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
			<div class="flex flex-col gap-1 pt-[4px]">
				{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as dow (dow)}
					<div
						class="flex h-[18px] items-center text-right text-[9px] font-bold uppercase tracking-[0.12em]"
						style="color: var(--color-text-dim-2); width: 24px;"
					>
						{dow}
					</div>
				{/each}
			</div>
			<div class="flex gap-1">
				{#each weekCells as col, wi (wi)}
					<div class="flex flex-col gap-1">
						{#each col as cell, di (di)}
							<div
								class="h-[18px] w-[18px] rounded-[4px]"
								style="background: {cell.isFuture
									? 'rgba(244,237,226,0.025)'
									: colorFor(cell.value)}; outline: {wi === todayCol &&
								di === todayRow
									? '1px solid var(--color-amber)'
									: 'none'}; outline-offset: 1px;"
								title={cell.isFuture
									? cell.date.toDateString()
									: cell.value > 0
										? `${cell.value} session${cell.value === 1 ? '' : 's'} · ${cell.date.toDateString()}`
										: `no sessions · ${cell.date.toDateString()}`}
							></div>
						{/each}
					</div>
				{/each}
			</div>
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
			<div class="ml-auto flex items-end gap-2">
				{#each [0, 1, 2, 3] as n (n)}
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-[9px] font-bold uppercase tracking-[0.12em]" style="color: var(--color-text-dim-2);">
							{n === 3 ? '3+' : n}
						</span>
						<span class="h-[10px] w-[10px] rounded-[2px]" style="background: {colorFor(n)};"></span>
					</div>
				{/each}
				<span class="ml-1 text-[10px] font-medium" style="color: var(--color-text-dim-2);">
					sessions
				</span>
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
							<span
								class="font-bold leading-none {badge.secondary === '' ? 'text-[12px]' : 'text-[15px]'}"
								style="color: var(--color-text);"
							>
								{badge.primary}
							</span>
							{#if badge.secondary}
								<span
									class="mt-0.5 text-[9px]"
									style="color: var(--color-text-dim-2);"
								>
									{badge.secondary}
								</span>
							{/if}
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
