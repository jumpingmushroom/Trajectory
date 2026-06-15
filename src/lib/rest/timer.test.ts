import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	restTimer,
	remainingSec,
	startRest,
	adjustRest,
	skipRest,
	shouldFireAlert,
	hydrateRest,
	__resetRestModule
} from './timer';
import type { RestSettings } from './resolve';

const settings: RestSettings = { enabled: true, defaultSec: 90, sound: true, vibrate: true };
const T0 = 1_000_000_000_000;

beforeEach(() => __resetRestModule());

describe('startRest + remainingSec', () => {
	it('starts a countdown from the set timestamp', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 90, equipmentId: 'e', equipmentName: 'Rack' });
		expect(remainingSec(get(restTimer), T0)).toBe(90);
		expect(remainingSec(get(restTimer), T0 + 30_000)).toBe(60);
		expect(remainingSec(get(restTimer), T0 + 200_000)).toBe(0);
	});

	it('resets adjust and clears any prior set on a new start', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 90, equipmentId: 'e', equipmentName: 'Rack' });
		adjustRest(15);
		startRest({ setId: 'b', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(get(restTimer)?.setId).toBe('b');
		expect(get(restTimer)?.adjustSec).toBe(0);
	});
});

describe('adjustRest', () => {
	it('extends and shortens without going below zero base', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		adjustRest(15);
		expect(remainingSec(get(restTimer), T0)).toBe(75);
		adjustRest(-15);
		adjustRest(-15);
		adjustRest(-60); // clamped so base+adjust >= 0
		expect(remainingSec(get(restTimer), T0)).toBe(0);
	});
});

describe('skipRest', () => {
	it('clears the timer', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		skipRest();
		expect(get(restTimer)).toBeNull();
	});
});

describe('shouldFireAlert', () => {
	it('fires exactly once when the countdown first hits zero', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(shouldFireAlert(get(restTimer), T0 + 30_000)).toBe(false); // still running
		expect(shouldFireAlert(get(restTimer), T0 + 60_000)).toBe(true); // hits zero
		expect(shouldFireAlert(get(restTimer), T0 + 61_000)).toBe(false); // already fired
	});

	it('fires again for a fresh set after a restart', () => {
		startRest({ setId: 'a', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		shouldFireAlert(get(restTimer), T0 + 60_000);
		startRest({ setId: 'b', startTs: T0, baseSec: 60, equipmentId: 'e', equipmentName: 'Rack' });
		expect(shouldFireAlert(get(restTimer), T0 + 60_000)).toBe(true);
	});
});

describe('hydrateRest', () => {
	const open = {
		setId: 'a',
		ts: T0,
		equipmentId: 'e',
		equipmentName: 'Rack',
		restTargetSec: null
	};

	it('resumes a still-running rest and will alert when it crosses zero', () => {
		hydrateRest(open, settings, T0 + 30_000);
		expect(remainingSec(get(restTimer), T0 + 30_000)).toBe(60);
		expect(shouldFireAlert(get(restTimer), T0 + 90_000)).toBe(true);
	});

	it('resumes a past-due rest without beeping on load', () => {
		hydrateRest(open, settings, T0 + 200_000);
		expect(remainingSec(get(restTimer), T0 + 200_000)).toBe(0);
		expect(shouldFireAlert(get(restTimer), T0 + 200_000)).toBe(false);
	});

	it('does nothing when resolved rest is 0', () => {
		hydrateRest({ ...open, restTargetSec: 0 }, settings, T0);
		expect(get(restTimer)).toBeNull();
	});
});
