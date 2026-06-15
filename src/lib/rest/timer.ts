// Rest-timer store (Approach A). The store holds a descriptor of the
// triggering set, not a ticking counter; remaining() is derived from
// Date.now() each tick. `firedFor` guarantees the end-alert plays exactly
// once even as the 1s tick re-evaluates.

import { writable } from 'svelte/store';
import { resolveRestSec, type RestSettings } from './resolve';

export interface RestState {
	setId: string;
	startTs: number; // ms — the set's ts
	baseSec: number;
	adjustSec: number;
	equipmentId: string;
	equipmentName: string;
}

export const restTimer = writable<RestState | null>(null);

let firedFor: string | null = null;

export function remainingSec(state: RestState | null, now: number): number {
	if (!state) return 0;
	const endMs = state.startTs + (state.baseSec + state.adjustSec) * 1000;
	return Math.max(0, Math.round((endMs - now) / 1000));
}

export function startRest(desc: Omit<RestState, 'adjustSec'>): void {
	firedFor = null;
	restTimer.set({ ...desc, adjustSec: 0 });
}

export function adjustRest(deltaSec: number): void {
	restTimer.update((s) => {
		if (!s) return s;
		// Never let base + adjust drop below 0.
		const nextAdjust = Math.max(-s.baseSec, s.adjustSec + deltaSec);
		return { ...s, adjustSec: nextAdjust };
	});
}

export function skipRest(): void {
	firedFor = null;
	restTimer.set(null);
}

// Returns true exactly once — when `state` first reaches 0 and its alert
// hasn't fired. Has the side effect of marking the alert fired.
export function shouldFireAlert(state: RestState | null, now: number): boolean {
	if (!state) return false;
	if (firedFor === state.setId) return false;
	if (remainingSec(state, now) > 0) return false;
	firedFor = state.setId;
	return true;
}

// Rehydrate from the open session's last set after a reload. If already
// past-due, mark the alert fired so a finished timer doesn't beep on load.
export function hydrateRest(
	openRest: {
		setId: string;
		ts: number;
		equipmentId: string;
		equipmentName: string;
		restTargetSec: number | null;
	} | null,
	settings: RestSettings,
	now: number
): void {
	if (!openRest) return;
	const baseSec = resolveRestSec(openRest.restTargetSec, settings);
	if (baseSec <= 0) return;
	const state: RestState = {
		setId: openRest.setId,
		startTs: openRest.ts,
		baseSec,
		adjustSec: 0,
		equipmentId: openRest.equipmentId,
		equipmentName: openRest.equipmentName
	};
	firedFor = remainingSec(state, now) <= 0 ? openRest.setId : null;
	restTimer.set(state);
}

// Test-only: reset module state between cases.
export function __resetRestModule(): void {
	firedFor = null;
	restTimer.set(null);
}
