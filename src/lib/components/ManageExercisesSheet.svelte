<script lang="ts">
	// Exercise CRUD for free-weight + barbell stations. Lists current
	// exercises (excluding the auto-hidden equipment-named one) with
	// inline rename + delete, and offers a curated picker (with custom
	// fallback) for adding new ones.

	import { mutate, ulid } from '$lib/mutate';
	import { exerciseSuggestionsFor } from '$lib/exercises';
	import InlineEdit from './InlineEdit.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import type { Exercise } from '$lib/server/db/schema';

	let {
		equipmentId,
		equipmentName,
		equipmentType,
		exercises,
		onClose
	}: {
		equipmentId: string;
		equipmentName: string;
		equipmentType: string;
		exercises: Exercise[];
		onClose: () => void;
	} = $props();

	const visible = $derived(exercises.filter((e) => !e.isHidden));
	const usedNames = $derived(new Set(visible.map((e) => e.name.toLowerCase())));
	const suggestions = $derived(
		exerciseSuggestionsFor(equipmentType).filter((s) => !usedNames.has(s.toLowerCase()))
	);

	let customName = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);
	let pendingDelete = $state<Exercise | null>(null);

	async function add(name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;
		error = null;
		saving = true;
		try {
			await mutate('exercise.create', {
				id: ulid(),
				equipmentId,
				name: trimmed,
				isHidden: false
			});
			customName = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not add exercise.';
		} finally {
			saving = false;
		}
	}

	async function rename(ex: Exercise, next: string) {
		try {
			await mutate('exercise.update', { id: ex.id, name: next });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not rename.';
		}
	}

	async function remove() {
		if (!pendingDelete) return;
		try {
			await mutate('exercise.delete', { id: pendingDelete.id });
			pendingDelete = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not delete.';
		}
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
		class="flex max-h-[88vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border-t p-5 pb-7 sm:max-w-[460px] sm:rounded-3xl sm:border"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="mx-auto h-1 w-10 rounded-full" style="background: rgba(255,255,255,0.18);"></div>

		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					{equipmentName}
				</div>
				<div
					class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
					style="color: var(--color-text);"
				>
					Exercises
				</div>
			</div>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full"
				style="color: var(--color-text-dim);"
				onclick={onClose}
				aria-label="Close"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
					<path d="M6 6l12 12M18 6L6 18"/>
				</svg>
			</button>
		</div>

		{#if visible.length === 0}
			<div
				class="rounded-xl border border-dashed p-4 text-center text-[12px]"
				style="border-color: var(--color-line-2); color: var(--color-text-dim);"
			>
				No exercises yet. Pick one below or type a custom name.
			</div>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each visible as ex (ex.id)}
					<li
						class="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
						style="background: var(--color-surface-2); border-color: var(--color-line);"
					>
						<InlineEdit
							value={ex.name}
							onCommit={(next) => rename(ex, next)}
							ariaLabel="Rename exercise"
							textClass="text-[14px]"
							inputClass="flex-1"
						/>
						<button
							type="button"
							class="rounded-full p-1.5"
							style="color: var(--color-text-dim);"
							onclick={() => (pendingDelete = ex)}
							aria-label="Delete exercise"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"/>
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if suggestions.length > 0}
			<div class="flex flex-col gap-2">
				<div
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					Common for {equipmentType}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each suggestions as s (s)}
						<button
							type="button"
							class="rounded-full border px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
							style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
							onclick={() => add(s)}
							disabled={saving}
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex flex-col gap-2">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Custom
			</div>
			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					add(customName);
				}}
			>
				<input
					bind:value={customName}
					name="exercise-name"
					type="text"
					placeholder="Single-leg RDL"
					class="flex-1 rounded-lg border px-3 py-2.5 text-[14px] outline-none"
					style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				/>
				<button
					type="submit"
					class="rounded-full px-4 text-[13px] font-bold disabled:opacity-50"
					style="background: var(--color-amber); color: #1b0a00;"
					disabled={!customName.trim() || saving}
				>
					Add
				</button>
			</form>
		</div>

		{#if error}
			<div
				class="rounded-md border px-3 py-2 text-[13px]"
				style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
			>
				{error}
			</div>
		{/if}
	</div>
</div>

{#if pendingDelete}
	<ConfirmDialog
		title="Delete {pendingDelete.name}?"
		description="Sets logged against this exercise will keep their data but the exercise will no longer appear when logging new sets."
		confirmLabel="Delete"
		danger
		onConfirm={remove}
		onCancel={() => (pendingDelete = null)}
	/>
{/if}
