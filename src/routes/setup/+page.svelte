<script lang="ts">
	import { mutate, ulid } from '$lib/mutate';
	import EquipmentGlyph from '$lib/components/EquipmentGlyph.svelte';
	import InlineEdit from '$lib/components/InlineEdit.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import AddEquipmentSheet from '$lib/components/AddEquipmentSheet.svelte';
	import ManageExercisesSheet from '$lib/components/ManageExercisesSheet.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import type { PageData } from './$types';
	import type { Equipment, Exercise, Gym } from '$lib/server/db/schema';

	let { data }: { data: PageData } = $props();

	// Default-expand the first gym on initial render. We intentionally
	// capture data.gyms[0] only at mount time; later gym creations should
	// not auto-expand the new card.
	let expanded = $state<Set<string>>(new Set());
	$effect(() => {
		if (expanded.size === 0 && data.gyms.length > 0) {
			expanded = new Set([data.gyms[0].id]);
		}
	});
	let addingGym = $state(false);
	let newGymName = $state('');
	let newGymCity = $state('');
	let addingEqForGym = $state<string | null>(null);
	let managingExercisesFor = $state<Equipment | null>(null);
	let editingEq = $state<Equipment | null>(null);
	let pendingEqDelete = $state<Equipment | null>(null);
	let pendingGymDelete = $state<Gym | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const equipmentByGym = $derived.by(() => {
		const map = new Map<string, Equipment[]>();
		for (const e of data.equipments) {
			const list = map.get(e.gymId) ?? [];
			list.push(e);
			map.set(e.gymId, list);
		}
		return map;
	});

	const exercisesByEquipment = $derived.by(() => {
		const map = new Map<string, Exercise[]>();
		for (const e of data.exercises) {
			const list = map.get(e.equipmentId) ?? [];
			list.push(e);
			map.set(e.equipmentId, list);
		}
		return map;
	});

	function toggle(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	async function createGym() {
		const name = newGymName.trim();
		if (!name) return;
		busy = true;
		error = null;
		try {
			await mutate('gym.create', {
				id: ulid(),
				name,
				city: newGymCity.trim() || null,
				isPrimary: data.gyms.length === 0
			});
			newGymName = '';
			newGymCity = '';
			addingGym = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not add gym.';
		} finally {
			busy = false;
		}
	}

	async function renameGym(g: Gym, next: string) {
		try {
			await mutate('gym.update', { id: g.id, name: next });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not rename gym.';
		}
	}

	async function renameEquipment(eq: Equipment, next: string) {
		try {
			await mutate('equipment.update', { id: eq.id, name: next });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not rename equipment.';
		}
	}

	async function deleteEquipment() {
		if (!pendingEqDelete) return;
		try {
			await mutate('equipment.delete', { id: pendingEqDelete.id });
			pendingEqDelete = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not delete equipment.';
		}
	}

	async function deleteGym() {
		if (!pendingGymDelete) return;
		try {
			await mutate('gym.delete', { id: pendingGymDelete.id });
			pendingGymDelete = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not delete gym.';
		}
	}

	function gymInitials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w.charAt(0).toUpperCase())
			.join('');
	}

	function freeWeightLike(type: string): boolean {
		return type === 'freeweight' || type === 'barbell';
	}

	function deleteEquipmentDescription(eq: Equipment): string {
		const count = data.setCountByEquipment[eq.id] ?? 0;
		if (count === 0) return 'No sets logged yet.';
		return `${count.toLocaleString()} set${count === 1 ? '' : 's'} logged. The data stays in the database but the equipment will disappear from Home and Stats.`;
	}

	function deleteGymDescription(g: Gym): string {
		const eqCount = (equipmentByGym.get(g.id) ?? []).length;
		if (eqCount === 0) return 'No equipment in this gym.';
		return `${eqCount} piece${eqCount === 1 ? '' : 's'} of equipment will be removed from Home along with this gym. Logged sets stay in the database.`;
	}
</script>

<svelte:head>
	<title>Setup · Trajectory</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-[480px] flex-col p-6 pt-14 pb-28">
	<header class="flex items-start gap-3">
		<div class="flex flex-1 flex-col">
			<div
				class="text-[10px] font-bold tracking-[0.16em] uppercase"
				style="color: var(--color-text-dim-2);"
			>
				Setup
			</div>
			<div
				class="mt-0.5 text-[22px] font-bold tracking-[-0.02em]"
				style="color: var(--color-text);"
			>
				Your gyms
			</div>
		</div>
		<a
			href="/profile"
			class="flex h-9 w-9 items-center justify-center rounded-full"
			style="background: var(--color-amber-dim); color: var(--color-amber);"
			aria-label="Open profile"
		>
			{data.userName.charAt(0).toUpperCase()}
		</a>
	</header>

	<section
		class="mt-5 flex items-center gap-3 rounded-2xl border p-4"
		style="background: var(--color-surface); border-color: var(--color-line);"
	>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-full"
			style="background: var(--color-amber-dim); color: var(--color-amber);"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M5 12l5 5L20 7" />
			</svg>
		</div>
		<div class="flex flex-1 flex-col">
			<div class="text-[14px] font-semibold" style="color: var(--color-text);">
				{data.gyms.length}
				{data.gyms.length === 1 ? 'gym' : 'gyms'} · {data.equipments.length}
				{data.equipments.length === 1 ? 'machine' : 'machines'}
			</div>
			<div class="text-[12px]" style="color: var(--color-text-dim);">
				Add more when you train somewhere new.
			</div>
		</div>
	</section>

	<section class="mt-3 flex flex-col gap-2">
		{#each data.gyms as g (g.id)}
			{@const equipments = equipmentByGym.get(g.id) ?? []}
			{@const isOpen = expanded.has(g.id)}
			<div
				class="flex flex-col rounded-2xl border"
				style="background: var(--color-surface); border-color: var(--color-line);"
			>
				<div class="flex items-center gap-3 px-4 py-3">
					<div
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-[15px] font-bold"
						style="background: linear-gradient(135deg, {g.tint}, var(--color-bg)); border-color: var(--color-line-2); color: var(--color-text-dim);"
					>
						{gymInitials(g.name)}
					</div>
					<div class="flex flex-1 flex-col">
						<InlineEdit
							value={g.name}
							onCommit={(next) => renameGym(g, next)}
							ariaLabel="Rename gym"
							textClass="text-[15px] font-semibold tracking-[-0.01em]"
						/>
						<div class="mt-0.5 text-[12px] tabular-nums" style="color: var(--color-text-dim);">
							{g.city ?? 'No city'} · {equipments.length}
							{equipments.length === 1 ? 'machine' : 'machines'}
						</div>
					</div>
					<button
						type="button"
						class="flex h-9 w-9 items-center justify-center rounded-full"
						onclick={() => toggle(g.id)}
						aria-label={isOpen ? 'Collapse gym' : 'Expand gym'}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="transition-transform"
							style="color: var(--color-text-dim-2); transform: rotate({isOpen ? 180 : 0}deg);"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</button>
				</div>

				{#if isOpen}
					<div
						class="flex flex-col gap-2 border-t px-3 pt-3 pb-3"
						style="border-color: var(--color-line);"
					>
						{#each equipments as eq (eq.id)}
							<div
								class="flex items-center gap-3 rounded-xl border px-3 py-2"
								style="background: var(--color-surface-2); border-color: var(--color-line);"
							>
								<button
									type="button"
									class="h-9 w-9 flex-shrink-0 rounded-lg border p-1.5 transition-transform active:scale-95"
									style="background: linear-gradient(135deg, {eq.tint}, var(--color-bg)); border-color: var(--color-line-2);"
									onclick={() => (editingEq = eq)}
									aria-label="Edit equipment"
								>
									<EquipmentGlyph kind={eq.glyph as never} />
								</button>
								<div class="flex flex-1 flex-col">
									<InlineEdit
										value={eq.name}
										onCommit={(next) => renameEquipment(eq, next)}
										ariaLabel="Rename equipment"
										textClass="text-[13px] font-medium"
									/>
									<div
										class="mt-0.5 text-[10px] capitalize"
										style="color: var(--color-text-dim-2);"
									>
										{eq.type} · {eq.group}{eq.cardioKind ? ` · ${eq.cardioKind}` : ''}
									</div>
								</div>
								<button
									type="button"
									class="rounded-full p-1.5"
									style="color: var(--color-text-dim);"
									onclick={() => (editingEq = eq)}
									aria-label="Edit equipment photo, glyph, and tint"
									title="Edit photo & glyph"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.75"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M12 20h9" />
										<path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
									</svg>
								</button>
								{#if freeWeightLike(eq.type)}
									<button
										type="button"
										class="rounded-full p-1.5"
										style="color: var(--color-text-dim);"
										onclick={() => (managingExercisesFor = eq)}
										aria-label="Manage exercises"
										title="Manage exercises"
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.75"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line x1="8" y1="6" x2="21" y2="6" />
											<line x1="8" y1="12" x2="21" y2="12" />
											<line x1="8" y1="18" x2="21" y2="18" />
											<line x1="3" y1="6" x2="3.01" y2="6" />
											<line x1="3" y1="12" x2="3.01" y2="12" />
											<line x1="3" y1="18" x2="3.01" y2="18" />
										</svg>
									</button>
								{/if}
								<button
									type="button"
									class="rounded-full p-1.5"
									style="color: var(--color-text-dim);"
									onclick={() => (pendingEqDelete = eq)}
									aria-label="Delete equipment"
									title="Delete equipment"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.75"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"
										/>
									</svg>
								</button>
							</div>
						{/each}

						<button
							type="button"
							class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-[13px] font-semibold"
							style="border-color: var(--color-line-2); color: var(--color-amber);"
							onclick={() => (addingEqForGym = g.id)}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M12 5v14M5 12h14" />
							</svg>
							Add equipment to {g.name}
						</button>

						{#if data.gyms.length > 1}
							<button
								type="button"
								class="mt-1 inline-flex items-center justify-center gap-2 self-start rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase"
								style="border-color: rgba(255,128,128,0.3); color: #ff8080;"
								onclick={() => (pendingGymDelete = g)}
							>
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"
									/>
								</svg>
								Remove this gym
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		{#if !addingGym}
			<button
				type="button"
				class="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 text-[14px] font-semibold"
				style="border-color: var(--color-line-2); color: var(--color-amber);"
				onclick={() => (addingGym = true)}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add another gym
			</button>
		{:else}
			<form
				class="flex flex-col gap-3 rounded-2xl border p-4"
				style="background: var(--color-surface); border-color: var(--color-amber-line);"
				onsubmit={(e) => {
					e.preventDefault();
					createGym();
				}}
			>
				<div
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-amber);"
				>
					New gym
				</div>
				<input
					bind:value={newGymName}
					name="gym-name"
					type="text"
					placeholder="Gym name"
					required
					class="rounded-lg border px-3 py-2.5 text-[14px] outline-none"
					style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				/>
				<input
					bind:value={newGymCity}
					name="gym-city"
					type="text"
					placeholder="City or label (optional)"
					class="rounded-lg border px-3 py-2.5 text-[14px] outline-none"
					style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				/>
				<div class="flex gap-2">
					<button
						type="button"
						class="flex-1 rounded-full border py-2.5 text-[13px] font-semibold"
						style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
						onclick={() => {
							addingGym = false;
							newGymName = '';
							newGymCity = '';
						}}
						disabled={busy}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="flex-[2] rounded-full py-2.5 text-[13px] font-bold disabled:opacity-50"
						style="background: var(--color-amber); color: #1b0a00;"
						disabled={busy || !newGymName.trim()}
					>
						{busy ? 'Saving…' : 'Create gym'}
					</button>
				</div>
			</form>
		{/if}
	</section>

	{#if error}
		<div
			class="mt-3 rounded-md border px-3 py-2 text-[13px]"
			style="background: rgba(255,90,90,0.08); border-color: rgba(255,90,90,0.32); color: #ff8080;"
		>
			{error}
		</div>
	{/if}

	<div
		class="mt-auto pt-6 text-center text-[11px] tabular-nums"
		style="color: var(--color-text-dim-2);"
	>
		Trajectory v{data.version}
	</div>
</main>

{#if addingEqForGym}
	<AddEquipmentSheet gymId={addingEqForGym} onClose={() => (addingEqForGym = null)} />
{/if}

{#if editingEq}
	<AddEquipmentSheet mode="edit" equipment={editingEq} onClose={() => (editingEq = null)} />
{/if}

{#if managingExercisesFor}
	<ManageExercisesSheet
		equipmentId={managingExercisesFor.id}
		equipmentName={managingExercisesFor.name}
		equipmentType={managingExercisesFor.type}
		exercises={exercisesByEquipment.get(managingExercisesFor.id) ?? []}
		onClose={() => (managingExercisesFor = null)}
	/>
{/if}

{#if pendingEqDelete}
	<ConfirmDialog
		title="Delete {pendingEqDelete.name}?"
		description={deleteEquipmentDescription(pendingEqDelete)}
		confirmLabel="Delete"
		danger
		onConfirm={deleteEquipment}
		onCancel={() => (pendingEqDelete = null)}
	/>
{/if}

{#if pendingGymDelete}
	<ConfirmDialog
		title="Remove {pendingGymDelete.name}?"
		description={deleteGymDescription(pendingGymDelete)}
		confirmLabel="Remove"
		danger
		onConfirm={deleteGym}
		onCancel={() => (pendingGymDelete = null)}
	/>
{/if}

<TabBar active="setup" />
