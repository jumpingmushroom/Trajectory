// Achievement evaluator. One entry point — evaluateAchievements — called
// from inside the same SQLite transaction as the triggering mutation.
// Each badge definition declares which triggers it cares about and a
// data-shaped predicate; this file owns the per-`kind` query builders
// that turn those predicates into boolean results, plus the idempotent
// INSERT ... ON CONFLICT DO NOTHING that records the unlock.
//
// Sync only — better-sqlite3 12.x rejects async transaction bodies.
// Use drizzle's .get()/.all()/.run() to execute synchronously.
//
// Local-time predicates (easter eggs) read the host's timezone via
// Node's Date object. Single-deploy homelab assumption: the server is
// roughly in the user's timezone. Multi-tenant or distributed deploys
// would need a per-user TZ stored alongside the user record.

import { and, eq, isNull, lt, gte, desc, sql, countDistinct } from 'drizzle-orm';
import { db } from '../db';
import {
	achievement,
	equipment,
	exercise,
	set as setTable,
	workoutSession,
	type Set as SetRow,
	type WorkoutSession as WorkoutSessionRow
} from '../db/schema';
import { newUlid } from '../ulid';
import { BADGE_DEFINITIONS } from '$lib/achievements/definitions';
import type { AchievementTrigger, Predicate } from '$lib/achievements/types';

// Tx is the parameter type drizzle hands the transaction callback.
// Inferred from the runtime `db` value to avoid a circular type import
// from mutations.ts (which will import this evaluator in step 3).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface EvalContext {
	setId?: string;
	sessionId?: string;
}

interface EvalState {
	set: SetRow | null;
	setEquipmentType: string | null;
	setEquipmentGroup: string | null;
	setCardioKind: string | null;
	setEquipmentInputMode: string | null;
	session: WorkoutSessionRow | null;
}

const ONE_DAY_MS = 86_400_000;

export function evaluateAchievements(
	tx: Tx,
	userId: string,
	trigger: AchievementTrigger,
	ctx: EvalContext
): void {
	const state = loadState(tx, ctx);

	for (const def of BADGE_DEFINITIONS) {
		if (!def.triggers.includes(trigger)) continue;
		if (matches(tx, userId, def.predicate, state)) {
			award(tx, userId, def.key, ctx);
		}
	}
}

function loadState(tx: Tx, ctx: EvalContext): EvalState {
	let set: SetRow | null = null;
	let setEquipmentType: string | null = null;
	let setEquipmentGroup: string | null = null;
	let setCardioKind: string | null = null;
	let setEquipmentInputMode: string | null = null;
	let session: WorkoutSessionRow | null = null;

	if (ctx.setId) {
		set =
			(tx.select().from(setTable).where(eq(setTable.id, ctx.setId)).limit(1).get() as
				| SetRow
				| undefined) ?? null;

		if (set) {
			const eqRow = tx
				.select({
					type: equipment.type,
					group: equipment.group,
					cardioKind: equipment.cardioKind,
					inputMode: equipment.inputMode
				})
				.from(exercise)
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(eq(exercise.id, set.exerciseId))
				.limit(1)
				.get() as
				| { type: string; group: string; cardioKind: string | null; inputMode: string }
				| undefined;
			if (eqRow) {
				setEquipmentType = eqRow.type;
				setEquipmentGroup = eqRow.group;
				setCardioKind = eqRow.cardioKind;
				setEquipmentInputMode = eqRow.inputMode;
			}
		}
	}

	if (ctx.sessionId) {
		session =
			(tx
				.select()
				.from(workoutSession)
				.where(eq(workoutSession.id, ctx.sessionId))
				.limit(1)
				.get() as WorkoutSessionRow | undefined) ?? null;
	} else if (set) {
		session =
			(tx
				.select()
				.from(workoutSession)
				.where(eq(workoutSession.id, set.workoutSessionId))
				.limit(1)
				.get() as WorkoutSessionRow | undefined) ?? null;
	}

	return {
		set,
		setEquipmentType,
		setEquipmentGroup,
		setCardioKind,
		setEquipmentInputMode,
		session
	};
}

function award(tx: Tx, userId: string, badgeKey: string, ctx: EvalContext): void {
	tx.insert(achievement)
		.values({
			id: newUlid(),
			userId,
			badgeKey,
			unlockedAt: new Date(),
			sourceSetId: ctx.setId ?? null,
			sourceSessionId: ctx.sessionId ?? null
		})
		.onConflictDoNothing()
		.run();
}

function matches(tx: Tx, userId: string, predicate: Predicate, state: EvalState): boolean {
	switch (predicate.kind) {
		case 'pr-strength-min': {
			const set = state.set;
			if (!set || set.weight == null) return false;
			// Cardio (distance_time) is the only mode that doesn't carry a
			// weight axis. Every other mode (weighted, bodyweight,
			// timed_weighted, weight_distance) counts toward strength PRs.
			if (state.setEquipmentInputMode === 'distance_time') return false;
			// minKg === 0 acts as "any PR" — fires on the first is_pr=1 set.
			if (predicate.minKg === 0) return set.isPr === true;
			return set.weight >= predicate.minKg;
		}

		case 'pr-cardio-distance': {
			const set = state.set;
			if (!set) return false;
			if (state.setEquipmentInputMode !== 'distance_time') return false;
			if (predicate.cardioKind && state.setCardioKind !== predicate.cardioKind) return false;
			const distance = set.extras?.distance;
			if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
				return false;
			}
			// Rower distance is metres; everyone else is km.
			const threshold = state.setCardioKind === 'rower' ? predicate.km * 1000 : predicate.km;
			return distance >= threshold;
		}

		case 'pr-cardio-duration': {
			const set = state.set;
			if (!set) return false;
			if (state.setEquipmentInputMode !== 'distance_time') return false;
			if (set.durationMin == null) return false;
			return set.durationMin >= predicate.durationMin;
		}

		case 'cardio-first': {
			if (!state.set) return false;
			return state.setEquipmentInputMode === 'distance_time';
		}

		case 'pr-timed-min': {
			const set = state.set;
			if (!set || set.durationMin == null) return false;
			const mode = state.setEquipmentInputMode;
			if (mode !== 'timed' && mode !== 'timed_weighted') return false;
			return set.durationMin * 60 >= predicate.minSec;
		}

		case 'timed-first': {
			if (!state.set) return false;
			const mode = state.setEquipmentInputMode;
			return mode === 'timed' || mode === 'timed_weighted';
		}

		case 'pr-carry-min': {
			const set = state.set;
			if (!set) return false;
			if (state.setEquipmentInputMode !== 'weight_distance') return false;
			const distance = set.extras?.distance;
			if (typeof distance !== 'number') return false;
			if (predicate.minDistanceM != null && distance < predicate.minDistanceM) return false;
			if (predicate.minWeightKg != null && (set.weight ?? 0) < predicate.minWeightKg) return false;
			return true;
		}

		case 'carry-first': {
			if (!state.set) return false;
			return state.setEquipmentInputMode === 'weight_distance';
		}

		case 'session-density': {
			const ts = state.set?.ts ?? state.session?.startedAt ?? new Date();
			return hasSessionDensity(
				tx,
				userId,
				ts.getTime(),
				predicate.sessionsPerWeek,
				predicate.weeks
			);
		}

		case 'comeback-after-gap': {
			const cur = state.session;
			if (!cur) return false;
			const prior = tx
				.select()
				.from(workoutSession)
				.where(and(eq(workoutSession.userId, userId), lt(workoutSession.startedAt, cur.startedAt)))
				.orderBy(desc(workoutSession.startedAt))
				.limit(1)
				.get() as WorkoutSessionRow | undefined;
			if (!prior) return false; // first session ever; not a comeback
			const priorEnd = (prior.endedAt ?? prior.startedAt).getTime();
			const gapMs = cur.startedAt.getTime() - priorEnd;
			return gapMs >= predicate.gapDays * ONE_DAY_MS;
		}

		case 'variety-cardio-kinds-all': {
			const row = tx
				.select({ kinds: countDistinct(equipment.cardioKind) })
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(
					and(
						eq(setTable.userId, userId),
						isNull(setTable.deletedAt),
						eq(equipment.inputMode, 'distance_time')
					)
				)
				.get() as { kinds: number } | undefined;
			return (row?.kinds ?? 0) >= 4;
		}

		case 'variety-input-modes-all': {
			const row = tx
				.select({ modes: countDistinct(equipment.inputMode) })
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(and(eq(setTable.userId, userId), isNull(setTable.deletedAt)))
				.get() as { modes: number } | undefined;
			// 6 = MODE_SHAPE size in $lib/input-modes. If you add a mode there,
			// bump this. Skipped over a constant import to keep the evaluator
			// dependency-free.
			return (row?.modes ?? 0) >= 6;
		}

		case 'variety-equipment-in-week': {
			const ts = state.set?.ts ?? new Date();
			const { start, end } = isoWeekBounds(ts);
			const row = tx
				.select({ count: countDistinct(exercise.equipmentId) })
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.where(
					and(
						eq(setTable.userId, userId),
						isNull(setTable.deletedAt),
						gte(setTable.ts, new Date(start)),
						lt(setTable.ts, new Date(end))
					)
				)
				.get() as { count: number } | undefined;
			return (row?.count ?? 0) >= predicate.minDistinct;
		}

		case 'variety-groups-in-week': {
			const ts = state.set?.ts ?? new Date();
			const { start, end } = isoWeekBounds(ts);
			const rows = tx
				.select({ group: equipment.group })
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(
					and(
						eq(setTable.userId, userId),
						isNull(setTable.deletedAt),
						gte(setTable.ts, new Date(start)),
						lt(setTable.ts, new Date(end))
					)
				)
				.all() as { group: string }[];
			const seen = new Set(rows.map((r) => r.group));
			// Apply rollup: a slot is satisfied if any of its rolled-up groups
			// appears in `seen`. Slots without a rollup entry only match
			// themselves (existing behaviour).
			return predicate.groups.every((g) => {
				const expanded = predicate.rollup?.[g] ?? [g];
				return expanded.some((x) => seen.has(x));
			});
		}

		case 'easter-time-window': {
			const set = state.set;
			if (!set) return false;
			const d = set.ts;
			const hour = d.getHours();
			const inWindow =
				predicate.endHour > predicate.startHour
					? hour >= predicate.startHour && hour < predicate.endHour
					: hour >= predicate.startHour || hour < predicate.endHour;
			if (!inWindow) return false;
			if (predicate.weekdayOnly) {
				const dow = d.getDay(); // 0=Sun, 6=Sat
				if (dow === 0 || dow === 6) return false;
			}
			return true;
		}

		case 'easter-session-duration-min': {
			const s = state.session;
			if (!s || !s.endedAt) return false;
			const minutes = (s.endedAt.getTime() - s.startedAt.getTime()) / 60_000;
			return minutes >= predicate.minutes;
		}

		case 'easter-session-set-density': {
			const s = state.session;
			if (!s) return false;
			const tsList = (
				tx
					.select({ ts: setTable.ts })
					.from(setTable)
					.where(
						and(
							eq(setTable.workoutSessionId, s.id),
							eq(setTable.userId, userId),
							isNull(setTable.deletedAt)
						)
					)
					.all() as { ts: Date }[]
			)
				.map((r) => r.ts.getTime())
				.sort((a, b) => a - b);
			if (tsList.length < predicate.minSets) return false;
			const windowMs = predicate.maxMinutes * 60_000;
			for (let i = 0; i + predicate.minSets - 1 < tsList.length; i++) {
				if (tsList[i + predicate.minSets - 1] - tsList[i] <= windowMs) return true;
			}
			return false;
		}

		case 'easter-five-by-five': {
			const set = state.set;
			if (!set) return false;
			if (set.weight == null || set.reps !== 5) return false;
			const row = tx
				.select({ count: sql<number>`COUNT(*)` })
				.from(setTable)
				.where(
					and(
						eq(setTable.userId, userId),
						eq(setTable.workoutSessionId, set.workoutSessionId),
						eq(setTable.exerciseId, set.exerciseId),
						eq(setTable.weight, set.weight),
						eq(setTable.reps, 5),
						isNull(setTable.deletedAt)
					)
				)
				.get() as { count: number } | undefined;
			return (row?.count ?? 0) >= 5;
		}

		case 'easter-pr-day': {
			const s = state.session;
			if (!s) return false;
			const row = tx
				.select({ count: sql<number>`COUNT(*)` })
				.from(setTable)
				.where(
					and(
						eq(setTable.workoutSessionId, s.id),
						eq(setTable.userId, userId),
						eq(setTable.isPr, true),
						isNull(setTable.deletedAt)
					)
				)
				.get() as { count: number } | undefined;
			return (row?.count ?? 0) >= predicate.minPrs;
		}

		case 'easter-calendar-day': {
			const set = state.set;
			if (!set || !set.isPr) return false;
			const d = set.ts;
			return d.getMonth() + 1 === predicate.month && d.getDate() === predicate.day;
		}
	}
	// Exhaustive switch — TS will warn on missing cases.
	return false;
}

// ─── helpers ────────────────────────────────────────────────────────

// ISO-style week containing `ts`, in local time. Monday-start, half-open
// [start, end) in epoch ms. Trajectory's existing heatmap and stats
// queries use the same week boundary.
function isoWeekBounds(ts: Date): { start: number; end: number } {
	const d = new Date(ts.getTime());
	d.setHours(0, 0, 0, 0);
	const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	const diffToMonday = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diffToMonday);
	const start = d.getTime();
	return { start, end: start + 7 * ONE_DAY_MS };
}

function hasSessionDensity(
	tx: Tx,
	userId: string,
	tsMs: number,
	sessionsPerWeek: number,
	weeks: number
): boolean {
	const { start: thisWeekStart } = isoWeekBounds(new Date(tsMs));
	const windowStart = thisWeekStart - (weeks - 1) * 7 * ONE_DAY_MS;
	const windowEnd = thisWeekStart + 7 * ONE_DAY_MS;
	const rows = tx
		.select({ startedAt: workoutSession.startedAt })
		.from(workoutSession)
		.where(
			and(
				eq(workoutSession.userId, userId),
				gte(workoutSession.startedAt, new Date(windowStart)),
				lt(workoutSession.startedAt, new Date(windowEnd))
			)
		)
		.all() as { startedAt: Date }[];

	const counts = new Array<number>(weeks).fill(0);
	for (const r of rows) {
		const idx = Math.floor((r.startedAt.getTime() - windowStart) / (7 * ONE_DAY_MS));
		if (idx >= 0 && idx < weeks) counts[idx] += 1;
	}
	return counts.every((c) => c >= sessionsPerWeek);
}
