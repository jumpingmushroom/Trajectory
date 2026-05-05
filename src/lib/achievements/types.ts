// Shared types for the achievement system. Definitions live in
// definitions.ts; the per-`kind` query builders that interpret each
// predicate live in src/lib/server/achievements/evaluator.ts.

export type CardioKind = 'treadmill' | 'bike' | 'rower' | 'generic';
export type MuscleGroup =
	| 'push'
	| 'pull'
	| 'legs'
	| 'core'
	| 'arms'
	| 'shoulders'
	| 'glutes';

export type AchievementTrigger = 'set.created' | 'session.ended';

export type Predicate =
	// Strength PR badges. Awarded when any non-cardio set with a weight
	// >= minKg is logged — covers weighted, bodyweight, timed_weighted, and
	// weight_distance modes (a 100 kg farmer carry hits Plate Club). Pairs
	// naturally with set.is_pr but doesn't strictly require it — a 100 kg set
	// that ties someone's prior best still hits Plate Club.
	| { kind: 'pr-strength-min'; minKg: number }
	// Cardio distance/duration badges. distance values are interpreted in km
	// for treadmill/bike/generic and m for rower.
	| { kind: 'pr-cardio-distance'; cardioKind?: CardioKind; km: number }
	| { kind: 'pr-cardio-duration'; durationMin: number }
	// First cardio set ever. Useful as an onboarding milestone.
	| { kind: 'cardio-first' }
	// Timed-hold PR (plank, dead hang, wall sit). Fires when the set's
	// durationMin × 60 >= minSec on a timed or timed_weighted equipment.
	| { kind: 'pr-timed-min'; minSec: number }
	// First timed-hold set ever. Onboarding milestone analogous to
	// cardio-first / carry-first.
	| { kind: 'timed-first' }
	// Loaded carry milestones (farmer walk, suitcase carry, sled).
	// `minDistanceM` and `minWeightKg` are both optional thresholds; the set
	// must clear all that are set. Fires only on weight_distance equipment.
	| { kind: 'pr-carry-min'; minDistanceM?: number; minWeightKg?: number }
	| { kind: 'carry-first' }
	// Session-density streaks. Awards when the user has hit
	// `sessionsPerWeek` for `weeks` consecutive ISO weeks ending at the
	// week containing the trigger.
	| { kind: 'session-density'; sessionsPerWeek: number; weeks: number }
	// Comeback: first session after a >= gapDays gap.
	| { kind: 'comeback-after-gap'; gapDays: number }
	// Variety badges, scoped to the ISO week containing the triggering set
	// (or last-7-days for cardio kinds, where ISO weeks aren't meaningful).
	| { kind: 'variety-cardio-kinds-all' }
	| { kind: 'variety-equipment-in-week'; minDistinct: number }
	| {
			kind: 'variety-groups-in-week';
			groups: MuscleGroup[];
			// Optional rollup so derived groups still satisfy a slot — e.g.
			// `legs: ['legs', 'glutes', 'calves']` lets a hip-thrust (group
			// 'glutes') count toward the 'legs' slot of a Full Body badge.
			rollup?: Partial<Record<MuscleGroup, MuscleGroup[]>>;
	  }
	// All input modes used at least once across the user's full history.
	| { kind: 'variety-input-modes-all' }
	// Easter eggs.
	| {
			kind: 'easter-time-window';
			startHour: number; // inclusive, 0-23
			endHour: number; // exclusive; if endHour < startHour, the window wraps midnight
			weekdayOnly?: boolean;
	  }
	| { kind: 'easter-session-duration-min'; minutes: number }
	| { kind: 'easter-session-set-density'; minSets: number; maxMinutes: number }
	| { kind: 'easter-five-by-five' }
	| { kind: 'easter-pr-day'; minPrs: number }
	| { kind: 'easter-calendar-day'; month: number; day: number };

export interface BadgeDefinition {
	key: string;
	category: 'pr' | 'streak' | 'variety' | 'easter';
	hidden: boolean;
	title: string;
	description: string;
	icon: string;
	triggers: AchievementTrigger[];
	predicate: Predicate;
}
