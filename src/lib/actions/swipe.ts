// Horizontal swipe gesture as a Svelte action.
// onLeft / onRight callbacks fire when the drag exceeds the threshold
// (default 80px) and the pointer is released. The element is translated
// during the drag and snaps back on release.

export interface SwipeOptions {
	onLeft?: () => void;
	onRight?: () => void;
	threshold?: number;
	enabled?: boolean;
}

const CAPTURE_THRESHOLD = 8;

export function swipeable(node: HTMLElement, opts: SwipeOptions) {
	let current: SwipeOptions = opts;
	let startX = 0;
	let dx = 0;
	let active = false;
	let captured = false;
	let pointerId: number | null = null;

	function reset() {
		active = false;
		captured = false;
		dx = 0;
		pointerId = null;
		node.style.transition = 'transform 200ms ease';
		node.style.transform = '';
	}

	function onPointerDown(e: PointerEvent) {
		if (current.enabled === false) return;
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		startX = e.clientX;
		dx = 0;
		active = true;
		captured = false;
		pointerId = e.pointerId;
		node.style.transition = '';
		// Don't capture yet — let inner buttons receive their click first.
		// We only steal the pointer once the user has moved horizontally
		// past CAPTURE_THRESHOLD, which signals a swipe (not a tap).
	}
	function onPointerMove(e: PointerEvent) {
		if (!active || pointerId !== e.pointerId) return;
		dx = e.clientX - startX;
		if (!captured && Math.abs(dx) > CAPTURE_THRESHOLD) {
			captured = true;
			try {
				node.setPointerCapture(e.pointerId);
			} catch {
				// some browsers reject — ignore
			}
		}
		if (captured) {
			node.style.transform = `translateX(${dx}px)`;
		}
	}
	function onPointerUp(e: PointerEvent) {
		if (!active || pointerId !== e.pointerId) return;
		const threshold = current.threshold ?? 80;
		const triggerLeft = captured && dx <= -threshold;
		const triggerRight = captured && dx >= threshold;
		const wasCaptured = captured;
		reset();
		if (wasCaptured) {
			try {
				node.releasePointerCapture(e.pointerId);
			} catch {
				// already released — ignore
			}
		}
		if (triggerLeft) current.onLeft?.();
		else if (triggerRight) current.onRight?.();
	}
	function onPointerCancel(e: PointerEvent) {
		if (pointerId !== e.pointerId) return;
		reset();
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);

	return {
		update(next: SwipeOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
		}
	};
}
