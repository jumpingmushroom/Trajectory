// Rest-timer resolution. The timer fires whenever the resolved value is > 0.
// `restTargetSec` null inherits the user's global default; an explicit 0 on
// the equipment disables the timer for that machine; the master toggle off
// disables it everywhere.

export interface RestSettings {
	enabled: boolean;
	defaultSec: number;
	sound: boolean;
	vibrate: boolean;
}

export function resolveRestSec(restTargetSec: number | null, settings: RestSettings): number {
	if (!settings.enabled) return 0;
	const target = restTargetSec ?? settings.defaultSec;
	return target > 0 ? target : 0;
}
