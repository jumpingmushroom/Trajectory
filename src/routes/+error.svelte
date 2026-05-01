<script lang="ts">
	import { page } from '$app/state';

	const status = $derived(page.status);
	const message = $derived(page.error?.message || 'Something went wrong.');
	const isNotFound = $derived(status === 404);
</script>

<main
	class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-6 pb-24 text-center"
>
	<p class="mb-2 text-xs tracking-[0.2em] uppercase opacity-60">
		{isNotFound ? 'Not found' : `Error ${status}`}
	</p>
	<h1 class="mb-3 text-2xl font-semibold">
		{isNotFound ? "We couldn't find that." : 'Something went wrong.'}
	</h1>
	<p class="mb-8 text-sm opacity-70">{message}</p>

	<div class="flex flex-col gap-3 self-stretch">
		<a
			href="/"
			class="block rounded-full px-5 py-3 text-sm font-medium"
			style="background: var(--color-amber); color: #0d0f12;"
		>
			Back to Today
		</a>
		<a
			href="/history"
			class="block rounded-full border px-5 py-3 text-sm font-medium"
			style="border-color: var(--color-line); color: var(--color-text);"
		>
			Open History
		</a>
	</div>
</main>
