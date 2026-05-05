<script lang="ts">
	// Crop / position / scale a picked image inside a fixed-aspect frame,
	// then render the cropped region to a canvas and emit a JPEG blob.
	//
	// Why this exists:
	// - The browser decodes HEIC into <img> natively (sharp on Alpine
	//   doesn't), so re-encoding via canvas yields a universally-readable
	//   JPEG.
	// - Output dimensions are bounded, so phone-camera multi-MB files
	//   shrink to a few hundred KB before they hit the network.
	// - Lets the user frame the shot rather than relying on server-side
	//   `cover` cropping the wrong region.

	import { onDestroy } from 'svelte';

	let {
		file,
		aspect,
		outputSize,
		title = 'Position photo',
		onConfirm,
		onCancel
	}: {
		file: File;
		aspect: number;
		outputSize: { w: number; h: number };
		title?: string;
		onConfirm: (blob: Blob, name: string) => void;
		onCancel: () => void;
	} = $props();

	let frame: HTMLDivElement | null = $state(null);
	let img: HTMLImageElement | null = $state(null);

	let imgW = $state(0);
	let imgH = $state(0);
	let frameW = $state(0);
	let frameH = $state(0);

	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);

	let busy = $state(false);
	let loadError = $state<string | null>(null);

	const objectUrl = URL.createObjectURL(file);

	onDestroy(() => URL.revokeObjectURL(objectUrl));

	const minScale = $derived(
		imgW > 0 && imgH > 0 && frameW > 0 && frameH > 0 ? Math.max(frameW / imgW, frameH / imgH) : 1
	);
	const maxScale = $derived(minScale * 4);

	function clampTransform(s: number, x: number, y: number) {
		const dispW = imgW * s;
		const dispH = imgH * s;
		const minTx = frameW - dispW;
		const minTy = frameH - dispH;
		return {
			s,
			x: Math.min(0, Math.max(minTx, x)),
			y: Math.min(0, Math.max(minTy, y))
		};
	}

	function onImgLoad() {
		if (!img) return;
		imgW = img.naturalWidth;
		imgH = img.naturalHeight;
		measureFrame();
		// Start at cover-fit, centered.
		scale = minScale;
		tx = (frameW - imgW * scale) / 2;
		ty = (frameH - imgH * scale) / 2;
	}

	function onImgError() {
		loadError = 'Could not read image. Try a different photo.';
	}

	function measureFrame() {
		if (!frame) return;
		const rect = frame.getBoundingClientRect();
		frameW = rect.width;
		frameH = rect.height;
	}

	$effect(() => {
		const r = () => measureFrame();
		window.addEventListener('resize', r);
		return () => window.removeEventListener('resize', r);
	});

	// Pointer tracking for drag + pinch. We deliberately don't use a
	// library — two pointers, one ratio, one midpoint, that's it.
	type Pt = { id: number; x: number; y: number };
	let pointers = $state<Pt[]>([]);
	let dragStart: { tx: number; ty: number; px: number; py: number } | null = null;
	let pinchStart: {
		dist: number;
		mid: { x: number; y: number };
		scale: number;
		tx: number;
		ty: number;
	} | null = null;

	function relativeTo(frameEl: HTMLElement, clientX: number, clientY: number) {
		const r = frameEl.getBoundingClientRect();
		return { x: clientX - r.left, y: clientY - r.top };
	}

	function onPointerDown(e: PointerEvent) {
		if (!frame) return;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
		const p = relativeTo(frame, e.clientX, e.clientY);
		pointers = [...pointers.filter((q) => q.id !== e.pointerId), { id: e.pointerId, ...p }];
		if (pointers.length === 1) {
			dragStart = { tx, ty, px: p.x, py: p.y };
			pinchStart = null;
		} else if (pointers.length === 2) {
			const [a, b] = pointers;
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			pinchStart = { dist, mid, scale, tx, ty };
			dragStart = null;
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!frame) return;
		if (!pointers.some((p) => p.id === e.pointerId)) return;
		const p = relativeTo(frame, e.clientX, e.clientY);
		pointers = pointers.map((q) => (q.id === e.pointerId ? { id: q.id, ...p } : q));

		if (pointers.length === 1 && dragStart) {
			const dx = p.x - dragStart.px;
			const dy = p.y - dragStart.py;
			const next = clampTransform(scale, dragStart.tx + dx, dragStart.ty + dy);
			tx = next.x;
			ty = next.y;
		} else if (pointers.length === 2 && pinchStart) {
			const [a, b] = pointers;
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			const ratio = dist / pinchStart.dist;
			const newScale = Math.min(maxScale, Math.max(minScale, pinchStart.scale * ratio));
			// Anchor the image point under the original midpoint.
			const m = pinchStart.mid;
			const imgPtX = (m.x - pinchStart.tx) / pinchStart.scale;
			const imgPtY = (m.y - pinchStart.ty) / pinchStart.scale;
			const newTx = m.x - imgPtX * newScale;
			const newTy = m.y - imgPtY * newScale;
			const next = clampTransform(newScale, newTx, newTy);
			scale = next.s;
			tx = next.x;
			ty = next.y;
		}
	}

	function onPointerUp(e: PointerEvent) {
		pointers = pointers.filter((p) => p.id !== e.pointerId);
		if (pointers.length < 2) pinchStart = null;
		if (pointers.length === 0) dragStart = null;
		// If we drop from 2 → 1, reset drag origin to the remaining pointer
		// so dragging continues smoothly.
		if (pointers.length === 1) {
			dragStart = { tx, ty, px: pointers[0].x, py: pointers[0].y };
		}
	}

	function onWheel(e: WheelEvent) {
		if (!frame) return;
		e.preventDefault();
		const p = relativeTo(frame, e.clientX, e.clientY);
		const factor = Math.exp(-e.deltaY * 0.0015);
		const newScale = Math.min(maxScale, Math.max(minScale, scale * factor));
		const imgPtX = (p.x - tx) / scale;
		const imgPtY = (p.y - ty) / scale;
		const next = clampTransform(newScale, p.x - imgPtX * newScale, p.y - imgPtY * newScale);
		scale = next.s;
		tx = next.x;
		ty = next.y;
	}

	function zoomBy(factor: number) {
		if (!frame) return;
		const newScale = Math.min(maxScale, Math.max(minScale, scale * factor));
		// Anchor at frame center.
		const cx = frameW / 2;
		const cy = frameH / 2;
		const imgPtX = (cx - tx) / scale;
		const imgPtY = (cy - ty) / scale;
		const next = clampTransform(newScale, cx - imgPtX * newScale, cy - imgPtY * newScale);
		scale = next.s;
		tx = next.x;
		ty = next.y;
	}

	async function confirm() {
		if (!img || !imgW || !imgH || !frameW || !frameH) return;
		busy = true;
		try {
			// Map the visible region (frame in screen px) back to source image
			// pixels, then draw that rect into a canvas at the requested
			// output dimensions.
			const sx = -tx / scale;
			const sy = -ty / scale;
			const sw = frameW / scale;
			const sh = frameH / scale;

			const canvas = document.createElement('canvas');
			canvas.width = outputSize.w;
			canvas.height = outputSize.h;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('canvas 2d unsupported');
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputSize.w, outputSize.h);

			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', 0.9)
			);
			if (!blob) throw new Error('canvas.toBlob returned null');

			const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
			onConfirm(blob, `${baseName}.jpg`);
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not encode photo.';
			busy = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-end bg-black/80 sm:items-center sm:justify-center"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onkeydown={(e) => {
		if (e.key === 'Escape') onCancel();
	}}
>
	<div
		class="flex max-h-[100vh] w-full flex-col gap-3 overflow-hidden rounded-t-3xl border-t p-4 pb-6 sm:max-h-[90vh] sm:max-w-[480px] sm:rounded-3xl sm:border"
		style="background: var(--color-surface); border-color: var(--color-line-2);"
	>
		<div class="mx-auto h-1 w-10 rounded-full" style="background: rgba(255,255,255,0.18);"></div>

		<div class="flex items-start gap-3">
			<div class="flex flex-1 flex-col">
				<div
					class="text-[10px] font-bold tracking-[0.14em] uppercase"
					style="color: var(--color-text-dim-2);"
				>
					{title}
				</div>
				<div
					class="mt-0.5 text-[16px] font-bold tracking-[-0.01em]"
					style="color: var(--color-text);"
				>
					Drag · pinch to zoom
				</div>
			</div>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full"
				style="color: var(--color-text-dim);"
				onclick={onCancel}
				aria-label="Cancel"
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

		<div
			bind:this={frame}
			class="relative w-full touch-none overflow-hidden rounded-2xl border select-none"
			style="aspect-ratio: {aspect}; background: var(--color-bg); border-color: var(--color-line-2);"
			role="application"
			aria-label="Drag and pinch to position photo"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onwheel={onWheel}
		>
			<!-- svelte-ignore a11y_missing_attribute -->
			<img
				bind:this={img}
				src={objectUrl}
				onload={onImgLoad}
				onerror={onImgError}
				draggable="false"
				class="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
				style="width: {imgW}px; height: {imgH}px; transform: translate({tx}px, {ty}px) scale({scale});"
			/>
			<!-- subtle grid overlay to help framing -->
			<div class="pointer-events-none absolute inset-0">
				<div
					class="absolute inset-y-0 left-1/3 w-px"
					style="background: rgba(255,255,255,0.15);"
				></div>
				<div
					class="absolute inset-y-0 left-2/3 w-px"
					style="background: rgba(255,255,255,0.15);"
				></div>
				<div
					class="absolute inset-x-0 top-1/3 h-px"
					style="background: rgba(255,255,255,0.15);"
				></div>
				<div
					class="absolute inset-x-0 top-2/3 h-px"
					style="background: rgba(255,255,255,0.15);"
				></div>
			</div>
		</div>

		<div class="flex items-center justify-center gap-3">
			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center rounded-full border text-[20px] font-bold disabled:opacity-40"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				onclick={() => zoomBy(1 / 1.25)}
				disabled={scale <= minScale + 0.001}
				aria-label="Zoom out"
			>
				−
			</button>
			<input
				type="range"
				class="flex-1 accent-current"
				min={minScale}
				max={maxScale}
				step="0.001"
				value={scale}
				oninput={(e) => {
					const target = e.currentTarget as HTMLInputElement;
					const next = clampTransform(parseFloat(target.value), tx, ty);
					scale = next.s;
					tx = next.x;
					ty = next.y;
				}}
				aria-label="Zoom"
			/>
			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center rounded-full border text-[20px] font-bold disabled:opacity-40"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text);"
				onclick={() => zoomBy(1.25)}
				disabled={scale >= maxScale - 0.001}
				aria-label="Zoom in"
			>
				+
			</button>
		</div>

		{#if loadError}
			<div class="text-center text-[12px]" style="color: #ff8080;">{loadError}</div>
		{/if}

		<div class="flex gap-2">
			<button
				type="button"
				class="flex-1 rounded-full border py-3 text-[13px] font-semibold disabled:opacity-50"
				style="background: var(--color-surface-2); border-color: var(--color-line-2); color: var(--color-text-dim);"
				onclick={onCancel}
				disabled={busy}
			>
				Cancel
			</button>
			<button
				type="button"
				class="flex-1 rounded-full py-3 text-[13px] font-bold disabled:opacity-50"
				style="background: var(--color-text); color: var(--color-bg);"
				onclick={confirm}
				disabled={busy || !imgW || loadError != null}
			>
				{busy ? 'Saving…' : 'Use photo'}
			</button>
		</div>
	</div>
</div>
