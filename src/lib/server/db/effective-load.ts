import { sql } from 'drizzle-orm';
import { set as setTable } from './schema';

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

// SQL fragment for the same calculation, used by aggregate queries
// (MAX/SUM/etc.) that can't ferry rows through the JS helper.
// COALESCE handles two layers: (a) sets with NULL weight (cardio rows that
// shouldn't reach a strength aggregate, but defending the boundary is
// cheap) and (b) sets without a bwLoadKg extras key (regular loaded sets).
export const effectiveLoadSql = sql<number>`(
	COALESCE(${setTable.weight}, 0)
	+ COALESCE(json_extract(${setTable.extras}, '$.bwLoadKg'), 0)
)`;
