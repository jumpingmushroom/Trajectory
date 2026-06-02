// Effective per-rep load on bodyweight equipment is `set.weight` (added
// external load — can be negative for assisted reps) plus the bodyweight
// snapshot in `set.extras.bwLoadKg`. Non-bodyweight sets carry no extras
// snapshot, so the result reduces to `weight ?? 0`. Centralised so PR,
// volume, and chart consumers don't drift from the log-time calculation.

export interface EffectiveLoadInput {
	weight: number | null;
	extras: Record<string, number> | null;
}

export function effectiveSetLoad(set: EffectiveLoadInput): number {
	const base = set.weight ?? 0;
	const bw = set.extras?.bwLoadKg;
	if (typeof bw === 'number' && Number.isFinite(bw)) return base + bw;
	return base;
}
