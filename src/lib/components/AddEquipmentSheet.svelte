<script lang="ts">
	import { mutate, ulid } from '$lib/mutate';
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

	let {
		gymId,
		onClose
	}: { gymId: string; onClose: () => void } = $props();

	let step = $state(0);
	let glyph = $state<GlyphKind>('bench');
	let name = $state('');
	let type = $state<EquipmentType>('machine');
	let cardioKind = $state<CardioKind>('treadmill');
	let group = $state<MuscleGroup>('push');
	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(null);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let glyphSearch = $state('');

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
		photoFile = file;
		photoPreview = file ? URL.createObjectURL(file) : null;
	}

	function clearPhoto() {
		photoFile = null;
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoPreview = null;
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
				{photoFile ? 'Replace photo' : 'Add photo'}
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

		{#if step === 0}
			{@render photoAndGlyphSection()}
		{:else if step === 1}
			{@render nameAndTypeSection()}
		{:else}
			{@render groupSection()}
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
		</div>
	</div>
</div>
