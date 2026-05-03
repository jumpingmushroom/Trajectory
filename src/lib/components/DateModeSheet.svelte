<script lang="ts">
	import { enterDateMode, exitDateMode, projectNowOntoDate } from '$lib/dateMode';

	let {
		asOfTs,
		onClose
	}: {
		asOfTs: number | null;
		onClose: () => void;
	} = $props();

	const today = new Date();
	const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const yesterdayMid = new Date(todayMid.getTime() - 86_400_000);
	const twoDaysMid = new Date(todayMid.getTime() - 2 * 86_400_000);

	// Bound the native picker.
	const todayIso = todayMid.toISOString().slice(0, 10);
	let pickedIso = $state('');

	async function pickQuick(targetMid: Date) {
		await enterDateMode(projectNowOntoDate(targetMid));
		onClose();
	}

	async function backToToday() {
		await exitDateMode();
		onClose();
	}

	async function onPickerChange(ev: Event) {
		const iso = (ev.currentTarget as HTMLInputElement).value;
		if (!iso) return;
		// "YYYY-MM-DD" → local-midnight Date so projectNowOnto puts the
		// time-of-day on that local day.
		const [y, m, d] = iso.split('-').map(Number);
		if (!y || !m || !d) return;
		const targetMid = new Date(y, m - 1, d);
		if (targetMid.getTime() > todayMid.getTime()) return;
		await enterDateMode(projectNowOntoDate(targetMid));
		onClose();
	}

	function fmt(d: Date): string {
		return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

<div
	class="fixed inset-0 z-40 flex items-end bg-black/60 sm:items-center sm:justify-center"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
>
	<div
		class="flex max-h-[80vh] w-full flex-col gap-3 overflow-y-auto rounded-t-3xl border-t p-5 pb-7 sm:max-w-[420px] sm:rounded-3xl sm:border"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="mx-auto h-1 w-10 rounded-full" style="background: rgba(255,255,255,0.18);"></div>

		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					Log for a past day
				</div>
				<div
					class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
					style="color: var(--color-text);"
				>
					Pick a date
				</div>
			</div>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full"
				style="color: var(--color-text-dim);"
				onclick={onClose}
				aria-label="Close"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
				>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</div>

		<ul class="flex flex-col gap-2">
			{#if asOfTs != null}
				<li>
					<button
						type="button"
						class="flex w-full items-center justify-between rounded-xl border p-3 text-left"
						style="background: var(--color-surface-2); border-color: var(--color-line-2);"
						onclick={backToToday}
					>
						<span class="flex flex-col">
							<span class="text-[14px] font-semibold" style="color: var(--color-text);">
								Back to Today
							</span>
							<span class="text-[11px]" style="color: var(--color-text-dim);">
								{fmt(today)} · log in real time
							</span>
						</span>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							style="color: var(--color-text-dim-2);"
						>
							<path d="M9 6l6 6-6 6" />
						</svg>
					</button>
				</li>
			{/if}
			<li>
				<button
					type="button"
					class="flex w-full items-center justify-between rounded-xl border p-3 text-left"
					style="background: var(--color-surface-2); border-color: var(--color-line-2);"
					onclick={() => pickQuick(yesterdayMid)}
				>
					<span class="flex flex-col">
						<span class="text-[14px] font-semibold" style="color: var(--color-text);">
							Yesterday
						</span>
						<span class="text-[11px]" style="color: var(--color-text-dim);">
							{fmt(yesterdayMid)}
						</span>
					</span>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
						style="color: var(--color-text-dim-2);"
					>
						<path d="M9 6l6 6-6 6" />
					</svg>
				</button>
			</li>
			<li>
				<button
					type="button"
					class="flex w-full items-center justify-between rounded-xl border p-3 text-left"
					style="background: var(--color-surface-2); border-color: var(--color-line-2);"
					onclick={() => pickQuick(twoDaysMid)}
				>
					<span class="flex flex-col">
						<span class="text-[14px] font-semibold" style="color: var(--color-text);">
							2 days ago
						</span>
						<span class="text-[11px]" style="color: var(--color-text-dim);">
							{fmt(twoDaysMid)}
						</span>
					</span>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
						style="color: var(--color-text-dim-2);"
					>
						<path d="M9 6l6 6-6 6" />
					</svg>
				</button>
			</li>
			<li>
				<label
					class="flex w-full items-center justify-between rounded-xl border p-3 text-left"
					style="background: var(--color-surface-2); border-color: var(--color-line-2);"
				>
					<span class="flex flex-col">
						<span class="text-[14px] font-semibold" style="color: var(--color-text);">
							Pick a date…
						</span>
						<span class="text-[11px]" style="color: var(--color-text-dim);"> Any past date </span>
					</span>
					<input
						type="date"
						class="appearance-none bg-transparent text-[12px]"
						style="color: var(--color-text-dim); color-scheme: dark;"
						max={todayIso}
						bind:value={pickedIso}
						onchange={onPickerChange}
					/>
				</label>
			</li>
		</ul>
	</div>
</div>
