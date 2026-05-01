// Shared types for the achievement system. Definitions live in
// definitions.ts; the per-`kind` query builders that interpret each
// predicate live in src/lib/server/achievements/evaluator.ts.

export type CardioKind = 'treadmill' | 'bike' | 'rower' | 'generic';
export type MuscleGroup = 'push' | 'pull' | 'legs' | 'core';

export type AchievementTrigger = 'set.created' | 'session.ended';

export type Predicate =
	// Strength PR badges. Awarded when a strength set with weight >= minKg
	// is logged. Pairs naturally with set.is_pr but doesn't strictly require
	// it — a 100 kg set that ties someone's prior best still hits Plate Club.
	| { kind: 'pr-strength-min'; minKg: number }
	// Cardio distance/duration badges. distance values are interpreted in km
	// for treadmill/bike/generic and m for rower.
	| { kind: 'pr-cardio-distance'; cardioKind?: CardioKind; km: number }
	| { kind: 'pr-cardio-duration'; durationMin: number }
	// First cardio set ever. Useful as an onboarding milestone.
	| { kind: 'cardio-first' }
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
	| { kind: 'variety-groups-in-week'; groups: MuscleGroup[] }
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
