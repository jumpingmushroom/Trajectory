<script lang="ts">
	import { mutate, ulid } from '$lib/mutate';
	import { invalidateAll } from '$app/navigation';
	import EquipmentGlyph from './EquipmentGlyph.svelte';
	import {
		GLYPHS,
		CATEGORY_ORDER,
		CATEGORY_LABEL,
		type GlyphKind,
		type GlyphMeta
	} from './glyph-kinds';

	type EquipmentType = 'barbell' | 'machine' | 'cable' | 'freeweight' | 'cardio';
	type MuscleGroup = 'push' | 'pull' | 'legs' | 'cardio';
	type CardioKind = 'treadmill' | 'bike' | 'rower' | 'generic';

	import type { Equipment } from '$lib/server/db/schema';

	type Mode = 'add' | 'edit';

	let {
		mode = 'add',
		gymId,
		equipment: editTarget,
		onClose
	}: {
		mode?: Mode;
		// gymId is required in add mode, optional/ignored in edit mode.
		gymId?: string;
		// equipment is required in edit mode, ignored in add mode.
		equipment?: Equipment;
		onClose: () => void;
	} = $props();

	if (mode === 'add' && !gymId) {
		throw new Error('AddEquipmentSheet: gymId is required in add mode');
	}
	if (mode === 'edit' && !editTarget) {
		throw new Error('AddEquipmentSheet: equipment is required in edit mode');
	}

	const initialPhotoSrc =
		mode === 'edit' && editTarget?.photoPath
			? `/uploads/${editTarget.photoPath}?v=${editTarget.updatedAt.getTime()}`
			: null;

	let step = $state(0);
	let glyph = $state<GlyphKind>(
		mode === 'edit' ? ((editTarget!.glyph as GlyphKind) ?? 'bench') : 'bench'
	);
	let name = $state(mode === 'edit' ? editTarget!.name : '');
	let type = $state<EquipmentType>(
		mode === 'edit' ? (editTarget!.type as EquipmentType) : 'machine'
	);
	let cardioKind = $state<CardioKind>(
		mode === 'edit'
			? ((editTarget!.cardioKind as CardioKind | null) ?? 'treadmill')
			: 'treadmill'
	);
	let group = $state<MuscleGroup>(
		mode === 'edit' ? (editTarget!.group as MuscleGroup) : 'push'
	);
	let notes = $state<string>(mode === 'edit' ? (editTarget!.notes ?? '') : '');
	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(initialPhotoSrc);
	let removePhoto = $state(false);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let glyphSearch = $state('');

	// Captured snapshot for diff at save time. Only meaningful in edit mode.
	const initial = {
		name: mode === 'edit' ? editTarget!.name : '',
		type: mode === 'edit' ? (editTarget!.type as EquipmentType) : 'machine',
		group: mode === 'edit' ? (editTarget!.group as MuscleGroup) : 'push',
		glyph: mode === 'edit' ? ((editTarget!.glyph as GlyphKind) ?? 'bench') : 'bench',
		tint: mode === 'edit' ? editTarget!.tint : '#1c2026',
		cardioKind:
			mode === 'edit' ? (editTarget!.cardioKind as CardioKind | null) : null,
		notes: mode === 'edit' ? (editTarget!.notes ?? '') : '',
		photoPath: mode === 'edit' ? editTarget!.photoPath : null
	};

	// When search is non-empty, render a flat filtered list. When empty,
	// render category-grouped sections in CATEGORY_ORDER.
	const filteredGlyphs = $derived.by<GlyphMeta[] | null>(() => {
		const q = glyphSearch.trim().toLowerCase();
		if (!q) return null;
		return GLYPHS.filter(
			(g) =>
				g.label.toLowerCase().includes(q) ||
				g.aliases.some((a) => a.toLowerCase().includes(q))
		);
	});

	const groupedGlyphs = $derived.by(() =>
		CATEGORY_ORDER.map((category) => ({
			category,
			label: CATEGORY_LABEL[category],
			items: GLYPHS.filter((g) => g.category === category)
		}))
	);

	function pickGeneric() {
		glyph = 'generic';
		glyphSearch = '';
	}

	const types: EquipmentType[] = ['machine', 'cable', 'barbell', 'freeweight', 'cardio'];
	const groups: MuscleGroup[] = ['push', 'pull', 'legs', 'cardio'];
	const cardioKinds: CardioKind[] = ['treadmill', 'bike', 'rower', 'generic'];

	function pickPhoto(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (photoPreview && photoPreview.startsWith('blob:')) {
			URL.revokeObjectURL(photoPreview);
		}
		photoFile = file;
		photoPreview = file ? URL.createObjectURL(file) : null;
		if (file) removePhoto = false;
	}

	function clearPhoto() {
		photoFile = null;
		if (photoPreview && photoPreview.startsWith('blob:')) {
			URL.revokeObjectURL(photoPreview);
		}
		photoPreview = null;
		removePhoto = false;
	}

	function handleRemovePhoto() {
		if (photoPreview && photoPreview.startsWith('blob:')) {
			URL.revokeObjectURL(photoPreview);
		}
		photoFile = null;
		photoPreview = null;
		// Only meaningful in edit mode; in add mode this just acts like clearPhoto.
		if (mode === 'edit' && initial.photoPath) {
			removePhoto = true;
		}
	}

	$effect(() => {
		// Default group to cardio when type is cardio.
		if (type === 'cardio' && group !== 'cardio') group = 'cardio';
	});

	async function handleSubmit() {
		error = null;
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Name is required.';
			step = 1;
			return;
		}
		submitting = true;
		try {
			const id = ulid();
			await mutate('equipment.create', {
				id,
				gymId,
				name: trimmed,
				type,
				group,
				glyph,
				cardioKind: type === 'cardio' ? cardioKind : null
			});
			if (photoFile) {
				const form = new FormData();
				form.append('photo', photoFile);
				const res = await fetch(`/api/equipment/${id}/photo`, {
					method: 'POST',
					body: form
				});
				if (!res.ok) {
					console.error('photo upload failed:', await res.text());
				}
			}
			// mutate() handles invalidation when the queue drains; no need
			// to invalidate explicitly here.
			onClose();
		} catch (err) {
			console.error('add equipment failed:', err);
			error = err instanceof Error ? err.message : 'Could not save equipment.';
		} finally {
			submitting = false;
		}
	}

	async function handleEditSave() {
		if (!editTarget) return;
		error = null;

		// Compute diff against `initial`. Build a payload of only changed fields.
		type DiffPayload = {
			id: string;
			name?: string;
			type?: EquipmentType;
			group?: MuscleGroup;
			glyph?: string;
			cardioKind?: CardioKind | null;
			notes?: string | null;
		};
		const diff: DiffPayload = { id: editTarget.id };
		let hasFieldDiff = false;

		const trimmedName = name.trim();
		if (!trimmedName) {
			error = 'Name is required.';
			return;
		}
		if (trimmedName !== initial.name) {
			diff.name = trimmedName;
			hasFieldDiff = true;
		}
		if (type !== initial.type) {
			diff.type = type;
			hasFieldDiff = true;
		}
		if (group !== initial.group) {
			diff.group = group;
			hasFieldDiff = true;
		}
		if (glyph !== initial.glyph) {
			diff.glyph = glyph;
			hasFieldDiff = true;
		}
		if (notes !== initial.notes) {
			diff.notes = notes.length === 0 ? null : notes;
			hasFieldDiff = true;
		}

		// cardioKind reconciliation (mirrors the server invariant for clean state):
		// - resulting type is cardio: include cardioKind if it differs from initial,
		//   defaulting to 'generic' if somehow null.
		// - resulting type is non-cardio: include cardioKind: null if initial had one.
		if (type === 'cardio') {
			const next = cardioKind ?? 'generic';
			if (next !== initial.cardioKind) {
				diff.cardioKind = next;
				hasFieldDiff = true;
			}
		} else if (initial.cardioKind != null) {
			diff.cardioKind = null;
			hasFieldDiff = true;
		}

		submitting = true;
		try {
			// Photo first: if upload fails, we don't want stale field updates to
			// mask the photo problem. POST overwrites the same path on retry.
			if (photoFile) {
				const form = new FormData();
				form.append('photo', photoFile);
				const res = await fetch(`/api/equipment/${editTarget.id}/photo`, {
					method: 'POST',
					body: form
				});
				if (!res.ok) {
					error = `Photo upload failed (${res.status}).`;
					return;
				}
			} else if (removePhoto && initial.photoPath) {
				const res = await fetch(`/api/equipment/${editTarget.id}/photo`, {
					method: 'DELETE'
				});
				if (!res.ok) {
					error = `Photo remove failed (${res.status}).`;
					return;
				}
			}

			if (hasFieldDiff) {
				await mutate('equipment.update', diff);
			}

			// Photo POST/DELETE doesn't go through mutate(), so its drain doesn't
			// trigger invalidation. Re-fetch the page data so the Setup row reflects
			// the new state immediately.
			if (photoFile || removePhoto) {
				await invalidateAll();
			}

			onClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save changes.';
		} finally {
			submitting = false;
		}
	}

	function next() {
		if (step === 1 && !name.trim()) {
			error = 'Name is required.';
			return;
		}
		error = null;
		if (step < 2) step += 1;
		else handleSubmit();
	}

	function back() {
		error = null;
		if (step > 0) step -= 1;
	}
</script>

{#snippet photoAndGlyphSection()}
	<div class="flex flex-col gap-3">
		<div
			class="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border"
			style="background: linear-gradient(135deg, var(--color-surface-2), var(--color-bg)); border-color: var(--color-line-2);"
		>
			{#if photoPreview}
				<img src={photoPreview} alt="preview" class="h-full w-full object-cover" />
			{:else}
				<div class="p-6">
					<div class="h-24 w-24">
						<EquipmentGlyph kind={glyph} />
					</div>
				</div>
			{/if}
		</div>

		<div class="flex gap-2">
			<label
				class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border py-3 text-[13px] font-semibold"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			>
				<input type="file" accept="image/*" class="hidden" onchange={pickPhoto} />
				{photoFile || photoPreview ? 'Replace photo' : 'Add photo'}
			</label>
			{#if photoFile}
				<button
					type="button"
					class="rounded-full border px-4 py-3 text-[13px] font-semibold"
					style="background: transparent; border-color: var(--color-line-2); color: var(--color-text-dim);"
					onclick={clearPhoto}
				>
					Clear
				</button>
			{:else if mode === 'edit' && photoPreview}
				<button
					type="button"
					class="rounded-full border px-4 py-3 text-[13px] font-semibold"
					style="background: transparent; border-color: var(--color-line-2); color: var(--color-text-dim);"
					onclick={handleRemovePhoto}
				>
					Remove
				</button>
			{/if}
		</div>

		<div class="mt-1 flex flex-col gap-2">
			<div
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Glyph
			</div>

			<input
				bind:value={glyphSearch}
				type="text"
				placeholder="Search glyphs (e.g. lat pulldown, kettlebell)"
				class="rounded-lg border px-3 py-2 text-[13px] outline-none"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				aria-label="Search glyphs"
			/>

			{#if filteredGlyphs === null}
				{#each groupedGlyphs as section (section.category)}
					<div class="mt-2 flex flex-col gap-2">
						<div
							class="text-[10px] font-bold uppercase tracking-[0.14em]"
							style="color: var(--color-text-dim-2);"
						>
							{section.label}
						</div>
						<div class="grid grid-cols-4 gap-2">
							{#each section.items as g (g.kind)}
								<button
									type="button"
									class="flex aspect-square items-center justify-center rounded-xl border p-2"
									style="background: {glyph === g.kind
										? 'var(--color-amber-dim)'
										: 'var(--color-surface-2)'}; border-color: {glyph === g.kind
										? 'var(--color-amber-line)'
										: 'var(--color-line-2)'};"
									onclick={() => (glyph = g.kind)}
									aria-pressed={glyph === g.kind}
									aria-label={g.label}
									title={g.label}
								>
									<EquipmentGlyph
										kind={g.kind}
										accent={glyph === g.kind ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
									/>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{:else if filteredGlyphs.length === 0}
				<div class="mt-2 flex flex-col gap-2">
					<div
						class="text-[12px]"
						style="color: var(--color-text-dim);"
					>
						No glyph matches "{glyphSearch}". Pick <span style="color: var(--color-text);">Generic</span> and name it whatever you like.
					</div>
					<div class="grid grid-cols-4 gap-2">
						<button
							type="button"
							class="flex aspect-square items-center justify-center rounded-xl border p-2"
							style="background: {glyph === 'generic'
								? 'var(--color-amber-dim)'
								: 'var(--color-surface-2)'}; border-color: {glyph === 'generic'
								? 'var(--color-amber-line)'
								: 'var(--color-line-2)'};"
							onclick={pickGeneric}
							aria-pressed={glyph === 'generic'}
							aria-label="Generic"
							title="Generic"
						>
							<EquipmentGlyph
								kind="generic"
								accent={glyph === 'generic' ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
							/>
						</button>
					</div>
				</div>
			{:else}
				<div class="mt-2 grid grid-cols-4 gap-2">
					{#each filteredGlyphs as g (g.kind)}
						<button
							type="button"
							class="flex aspect-square items-center justify-center rounded-xl border p-2"
							style="background: {glyph === g.kind
								? 'var(--color-amber-dim)'
								: 'var(--color-surface-2)'}; border-color: {glyph === g.kind
								? 'var(--color-amber-line)'
								: 'var(--color-line-2)'};"
							onclick={() => (glyph = g.kind)}
							aria-pressed={glyph === g.kind}
							aria-label={g.label}
							title={g.label}
						>
							<EquipmentGlyph
								kind={g.kind}
								accent={glyph === g.kind ? 'var(--color-amber)' : 'rgba(244,237,226,0.55)'}
							/>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet nameAndTypeSection()}
	<div class="flex flex-col gap-4">
		<label class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Name
			</span>
			<input
				bind:value={name}
				name="equipment-name"
				type="text"
				placeholder="Cable Row by the mirror"
				required
				class="rounded-lg border px-3.5 py-3 text-[15px] outline-none"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
			/>
		</label>

		<div class="flex flex-col gap-1">
			<span
				class="text-[10px] font-bold uppercase tracking-[0.14em]"
				style="color: var(--color-text-dim-2);"
			>
				Type
			</span>
			<div class="flex flex-wrap gap-2">
				{#each types as t (t)}
					<button
						type="button"
						class="rounded-full border px-3 py-2 text-[13px] font-medium capitalize"
						style="background: {type === t
							? 'var(--color-amber-dim)'
							: 'var(--color-surface-2)'}; border-color: {type === t
							? 'var(--color-amber-line)'
							: 'var(--color-line-2)'}; color: {type === t
							? 'var(--color-amber)'
							: 'var(--color-text)'};"
						onclick={() => (type = t)}
						aria-pressed={type === t}
					>
						{t}
					</button>
				{/each}
			</div>
		</div>

		{#if type === 'cardio'}
			<div class="flex flex-col gap-1">
				<span
					class="text-[10px] font-bold uppercase tracking-[0.14em]"
					style="color: var(--color-text-dim-2);"
				>
					Cardio kind
				</span>
				<div class="flex flex-wrap gap-2">
					{#each cardioKinds as k (k)}
						<button
							type="button"
							class="rounded-full border px-3 py-2 text-[13px] font-medium capitalize"
							style="background: {cardioKind === k
								? 'var(--color-amber-dim)'
								: 'var(--color-surface-2)'}; border-color: {cardioKind === k
								? 'var(--color-amber-line)'
								: 'var(--color-line-2)'}; color: {cardioKind === k
								? 'var(--color-amber)'
								: 'var(--color-text)'};"
							onclick={() => (cardioKind = k)}
							aria-pressed={cardioKind === k}
						>
							{k}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet groupSection()}
	<div class="flex flex-col gap-3">
		<div
			class="text-[12px]"
			style="color: var(--color-text-dim);"
		>
			Used by Stats screen for the muscle-group distribution bars.
		</div>
		<div class="flex flex-wrap gap-2">
			{#each groups as g (g)}
				<button
					type="button"
					class="rounded-full border px-3.5 py-2.5 text-[14px] font-medium capitalize"
					style="background: {group === g
						? 'var(--color-amber-dim)'
						: 'var(--color-surface-2)'}; border-color: {group === g
						? 'var(--color-amber-line)'
						: 'var(--color-line-2)'}; color: {group === g
						? 'var(--color-amber)'
						: 'var(--color-text)'};"
					onclick={() => (group = g)}
					aria-pressed={group === g}
				>
					{g}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

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
		class="flex max-h-[88vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border-t p-5 pb-7 sm:max-w-[440px] sm:rounded-3xl sm:border"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="mx-auto h-1 w-10 rounded-full" style="background: rgba(255,255,255,0.18);"></div>

		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				{#if mode === 'add'}
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Step {step + 1} of 3
					</div>
					<div
						class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
						style="color: var(--color-text);"
					>
						{step === 0 ? 'Photo & glyph' : step === 1 ? 'Name & type' : 'Muscle group'}
					</div>
				{:else}
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Edit
					</div>
					<div
						class="mt-0.5 text-[18px] font-bold tracking-[-0.01em]"
						style="color: var(--color-text);"
					>
						{editTarget!.name}
					</div>
				{/if}
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

		{#if mode === 'add'}
			{#if step === 0}
				{@render photoAndGlyphSection()}
			{:else if step === 1}
				{@render nameAndTypeSection()}
			{:else}
				{@render groupSection()}
			{/if}
		{:else}
			<div class="flex flex-col gap-6">
				<section class="flex flex-col gap-2">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Photo & glyph
					</div>
					{@render photoAndGlyphSection()}
				</section>
				<section class="flex flex-col gap-2">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Name & type
					</div>
					{@render nameAndTypeSection()}
				</section>
				<section class="flex flex-col gap-2">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Muscle group
					</div>
					{@render groupSection()}
				</section>
				<section class="flex flex-col gap-2">
					<div
						class="text-[10px] font-bold uppercase tracking-[0.14em]"
						style="color: var(--color-text-dim-2);"
					>
						Notes
					</div>
					<textarea
						bind:value={notes}
						rows="3"
						placeholder="e.g. seat height 4, arms wide for chest"
						maxlength="4000"
						class="rounded-lg border px-3 py-2 text-[14px] outline-none"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text); resize: vertical;"
					></textarea>
				</section>
			</div>
		{/if}

		{#if error}
			<div
				class="rounded-md border px-3 py-2 text-[13px]"
				style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
			>
				{error}
			</div>
		{/if}

		<div class="flex gap-2 pt-1">
			{#if mode === 'add'}
				{#if step > 0}
					<button
						type="button"
						class="flex-1 rounded-full border py-3 text-[14px] font-semibold"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
						onclick={back}
						disabled={submitting}
					>
						Back
					</button>
				{/if}
				<button
					type="button"
					class="flex-[2] rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
					style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
					onclick={next}
					disabled={submitting}
				>
					{submitting ? 'Saving…' : step === 2 ? 'Add to gym' : 'Continue'}
				</button>
			{:else}
				<button
					type="button"
					class="w-full rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
					style="background: var(--color-amber); color: #1b0a00; box-shadow: 0 8px 24px var(--color-amber-glow);"
					onclick={handleEditSave}
					disabled={submitting}
				>
					{submitting ? 'Saving…' : 'Save'}
				</button>
			{/if}
		</div>
	</div>
</div>
