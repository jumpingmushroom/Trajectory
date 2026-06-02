// Reconciler: derives is_pr + achievements purely from a user's current
// (non-deleted) sets/sessions and writes the DB to match. Unlike the
// incremental set.create path (which can only *add*, so additive awards are
// correct), edits / deletes / backdated inserts can lower, reorder, or fill in
// history — so they re-derive everything and reconcile (award new, revoke gone).
//
// Sync only — runs inside the caller's better-sqlite3 transaction (12.x rejects
// async transaction bodies). Uses .get()/.all()/.run().

import { and, eq, isNull, isNotNull, asc, inArray } from 'drizzle-orm';
import { achievement, equipment, exercise, set as setTable, workoutSession } from './db/schema';
import { newUlid } from './ulid';
import { matchedBadgeKeys, type Tx } from './achievements/evaluator';

// The comparable PR-axis value for a set under a given inputMode, or null when
// the set has no measurable axis (and so can never be a PR). Single source of
// truth shared by the live evaluatePr fast path and the chronological replay
// below — keep these two in lockstep.
export function prAxisValue(
	inputMode: string,
	weight: number | null,
	durationMin: number | null,
	extras: Record<string, number> | null
): number | null {
	if (inputMode === 'distance_time') {
		const d = extras?.distance;
		return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null;
	}
	if (inputMode === 'timed') {
		return typeof durationMin === 'number' && Number.isFinite(durationMin) && durationMin > 0
			? durationMin
			: null;
	}
	// weighted | bodyweight | timed_weighted | weight_distance → effective load.
	if (typeof weight !== 'number' || !Number.isFinite(weight)) return null;
	const bw =
		typeof extras?.bwLoadKg === 'number' && Number.isFinite(extras.bwLoadKg) ? extras.bwLoadKg : 0;
	const eff = weight + bw;
	return eff > 0 ? eff : null;
}

// Recompute is_pr (chronological) for every non-deleted set, then reconcile the
// user's achievement rows to exactly the set derivable from current data.
export function recomputeUser(tx: Tx, userId: string): void {
	recomputeIsPr(tx, userId);
	reconcileAchievements(tx, userId);
}

// ─── Phase A: chronological is_pr replay ────────────────────────────────
// Within each exercise, walk sets oldest-first; a set is a PR iff its axis
// value strictly beats the running max of everything logged before it. Filter
// only on set.deletedAt (matching evaluatePr) — a soft-deleted exercise's sets
// are still real history and shouldn't change is_pr.
function recomputeIsPr(tx: Tx, userId: string): void {
	const rows = tx
		.select({
			id: setTable.id,
			exerciseId: setTable.exerciseId,
			weight: setTable.weight,
			durationMin: setTable.durationMin,
			extras: setTable.extras,
			isPr: setTable.isPr,
			inputMode: equipment.inputMode
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.where(and(eq(setTable.userId, userId), isNull(setTable.deletedAt)))
		.orderBy(asc(setTable.exerciseId), asc(setTable.ts), asc(setTable.id))
		.all() as Array<{
		id: string;
		exerciseId: string;
		weight: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		isPr: boolean;
		inputMode: string;
	}>;

	let curExercise: string | null = null;
	let runningMax: number | null = null;
	const flips: Array<{ id: string; isPr: boolean }> = [];

	for (const r of rows) {
		if (r.exerciseId !== curExercise) {
			curExercise = r.exerciseId;
			runningMax = null;
		}
		const v = prAxisValue(r.inputMode, r.weight, r.durationMin, r.extras);
		const isPr = v != null && (runningMax == null || v > runningMax);
		if (isPr) runningMax = v;
		if (isPr !== r.isPr) flips.push({ id: r.id, isPr });
	}

	for (const f of flips) {
		tx.update(setTable).set({ isPr: f.isPr }).where(eq(setTable.id, f.id)).run();
	}
}

// ─── Phases B + C: derive earned badges, reconcile the table ────────────
// Replay the existing predicate code over the user's whole history: every
// non-deleted set is fed as a 'set.created' evaluation and every ended session
// as 'session.ended', and the union of matched keys is the set the user
// currently qualifies for. Then award the new ones (seenAt null → celebrates)
// and silently delete the ones no longer earned. Must run after Phase A because
// pr-strength-min(0)/easter-pr-day/easter-calendar-day read persisted is_pr.
function reconcileAchievements(tx: Tx, userId: string): void {
	const earned = new Set<string>();

	const sets = tx
		.select({ id: setTable.id, sessionId: setTable.workoutSessionId })
		.from(setTable)
		.where(and(eq(setTable.userId, userId), isNull(setTable.deletedAt)))
		.all() as Array<{ id: string; sessionId: string }>;
	for (const s of sets) {
		for (const key of matchedBadgeKeys(tx, userId, 'set.created', {
			setId: s.id,
			sessionId: s.sessionId
		})) {
			earned.add(key);
		}
	}

	// Only ended sessions ever fired 'session.ended' in production; open
	// sessions never did, so replaying them would award session badges early.
	const endedSessions = tx
		.select({ id: workoutSession.id })
		.from(workoutSession)
		.where(and(eq(workoutSession.userId, userId), isNotNull(workoutSession.endedAt)))
		.all() as Array<{ id: string }>;
	for (const ss of endedSessions) {
		for (const key of matchedBadgeKeys(tx, userId, 'session.ended', { sessionId: ss.id })) {
			earned.add(key);
		}
	}

	const existing = tx
		.select({ id: achievement.id, badgeKey: achievement.badgeKey })
		.from(achievement)
		.where(eq(achievement.userId, userId))
		.all() as Array<{ id: string; badgeKey: string }>;
	const existingKeys = new Set(existing.map((r) => r.badgeKey));

	for (const key of earned) {
		if (existingKeys.has(key)) continue;
		tx.insert(achievement)
			.values({
				id: newUlid(),
				userId,
				badgeKey: key,
				unlockedAt: new Date(),
				sourceSetId: null,
				sourceSessionId: null
			})
			.onConflictDoNothing()
			.run();
	}

	const toDelete = existing.filter((r) => !earned.has(r.badgeKey)).map((r) => r.badgeKey);
	if (toDelete.length > 0) {
		tx.delete(achievement)
			.where(and(eq(achievement.userId, userId), inArray(achievement.badgeKey, toDelete)))
			.run();
	}
}
