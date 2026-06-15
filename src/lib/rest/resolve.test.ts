import { describe, it, expect } from 'vitest';
import { resolveRestSec, type RestSettings } from './resolve';

const on: RestSettings = { enabled: true, defaultSec: 90, sound: true, vibrate: true };
const off: RestSettings = { ...on, enabled: false };

describe('resolveRestSec', () => {
	it('returns 0 when the master toggle is off', () => {
		expect(resolveRestSec(120, off)).toBe(0);
		expect(resolveRestSec(null, off)).toBe(0);
	});

	it('inherits the global default when equipment target is null', () => {
		expect(resolveRestSec(null, on)).toBe(90);
	});

	it('uses the equipment target when set', () => {
		expect(resolveRestSec(180, on)).toBe(180);
	});

	it('treats an explicit 0 on equipment as "no timer"', () => {
		expect(resolveRestSec(0, on)).toBe(0);
	});

	it('treats a 0 global default with null equipment as "no timer"', () => {
		expect(resolveRestSec(null, { ...on, defaultSec: 0 })).toBe(0);
	});
});
