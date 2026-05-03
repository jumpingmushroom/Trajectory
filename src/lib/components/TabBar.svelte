<script lang="ts">
	// Sticky bottom tab bar shown on Home / History / Stats / Setup.
	// Hidden on Log + Detail (focus screens).

	let { active }: { active: 'home' | 'history' | 'stats' | 'setup' } = $props();

	const tabs: {
		id: 'home' | 'history' | 'stats' | 'setup';
		label: string;
		href: string;
		icon: string;
	}[] = [
		{
			id: 'home',
			label: 'Today',
			href: '/',
			icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z'
		},
		{
			id: 'history',
			label: 'History',
			href: '/history',
			icon: 'M3 12a9 9 0 1 0 3-6.7L3 8;M3 3v5h5;M12 7v5l3 2'
		},
		{
			id: 'stats',
			label: 'Stats',
			href: '/stats',
			icon: 'M3 3v18h18;M7 15l4-5 3 3 5-7'
		},
		{
			id: 'setup',
			label: 'Setup',
			href: '/setup',
			icon: 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1A2 2 0 117 4.3l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1A2 2 0 1119.7 7l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z;M12 9a3 3 0 100 6 3 3 0 000-6'
		}
	];
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-20 border-t pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
	style="background: rgba(13,15,18,0.92); border-color: var(--color-line); backdrop-filter: blur(8px);"
	aria-label="Primary"
>
	<div class="mx-auto grid w-full max-w-[480px] grid-cols-4 gap-1 px-2">
		{#each tabs as t (t.id)}
			<a
				href={t.href}
				class="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold tracking-[0.04em]"
				style="color: {active === t.id ? 'var(--color-amber)' : 'var(--color-text-dim-2)'};"
				aria-current={active === t.id ? 'page' : undefined}
			>
				<svg
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{#each t.icon.split(';') as d (d)}
						<path {d} />
					{/each}
				</svg>
				<span class="uppercase">{t.label}</span>
			</a>
		{/each}
	</div>
</nav>
