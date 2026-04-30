// Press-and-hold-to-repeat for stepper-style +/- buttons. One tap fires
// the callback once; holding past `delayMs` (350 ms) starts an interval
// firing every `intervalMs` (80 ms) until pointerup/leave/cancel.
//
// Used by Stepper (weight), SmallStepper (reps + target sets) and the
// cardio extras mini-steppers in /log/[id]. Keeps all "+/-" buttons in
// the app feeling the same.

import type { Action } from 'svelte/action';

export interface HoldRepeatOptions {
	onTick: () => void;
	delayMs?: number;
	intervalMs?: number;
}

export const holdRepeat: Action<HTMLElement, HoldRepeatOptions> = (node, opts) => {
	let current = opts;
	let delayHandle: ReturnType<typeof setTimeout> | null = null;
	let tickHandle: ReturnType<typeof setInterval> | null = null;

	function clearTimers() {
		if (delayHandle) {
			clearTimeout(delayHandle);
			delayHandle = null;
		}
		if (tickHandle) {
			clearInterval(tickHandle);
			tickHandle = null;
		}
	}

	function start(e: PointerEvent) {
		// Only react to primary button (left mouse / single touch).
		if (e.button !== undefined && e.button !== 0) return;
		clearTimers();
		current.onTick();
		const delay = current.delayMs ?? 350;
		const interval = current.intervalMs ?? 80;
		delayHandle = setTimeout(() => {
			tickHandle = setInterval(() => current.onTick(), interval);
		}, delay);
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', clearTimers);
	node.addEventListener('pointerleave', clearTimers);
	node.addEventListener('pointercancel', clearTimers);
	// If the user backgrounds the app or switches tabs mid-hold, the
	// pointer events may never fire. Stop the interval so the value
	// doesn't keep rocketing while the screen is off.
	window.addEventListener('blur', clearTimers);
	document.addEventListener('visibilitychange', clearTimers);

	return {
		update(next: HoldRepeatOptions) {
			current = next;
		},
		destroy() {
			clearTimers();
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointerup', clearTimers);
			node.removeEventListener('pointerleave', clearTimers);
			node.removeEventListener('pointercancel', clearTimers);
			window.removeEventListener('blur', clearTimers);
			document.removeEventListener('visibilitychange', clearTimers);
		}
	};
};
