// The v1 badge roster. Adding a new badge = append an entry here and
// ship. The evaluator interprets each definition's predicate via a
// per-`kind` SQL builder in src/lib/server/achievements/evaluator.ts.
//
// Categories: 'pr' | 'streak' | 'variety' | 'easter'. The `hidden` flag
// keeps a badge out of the locked-gallery until earned (the easter-egg
// gate).

import type { BadgeDefinition } from './types';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
	// ─── Strength PRs (visible) ────────────────────────────────────
	{
		key: 'strength.first_pr',
		category: 'pr',
		hidden: false,
		title: 'First PR',
		description: 'Beat your own best on any lift',
		icon: 'medal',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 0 } // any is_pr=1 strength set
	},
	{
		key: 'strength.single_plate',
		category: 'pr',
		hidden: false,
		title: 'Single Plate',
		description: 'Lift 60 kg for the first time',
		icon: 'plate-1',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 60 }
	},
	{
		key: 'strength.plate_club',
		category: 'pr',
		hidden: false,
		title: 'Plate Club',
		description: 'Lift 100 kg for the first time',
		icon: 'plate-2',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 100 }
	},
	{
		key: 'strength.two_plates',
		category: 'pr',
		hidden: false,
		title: 'Two Plates',
		description: 'Lift 140 kg for the first time',
		icon: 'plate-3',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 140 }
	},
	{
		key: 'strength.triple_plates',
		category: 'pr',
		hidden: false,
		title: 'Triple Plates',
		description: 'Lift 180 kg for the first time',
		icon: 'plate-4',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 180 }
	},
	{
		key: 'strength.four_plates',
		category: 'pr',
		hidden: false,
		title: 'Four Plates',
		description: 'Lift 220 kg for the first time',
		icon: 'plate-5',
		triggers: ['set.created'],
		predicate: { kind: 'pr-strength-min', minKg: 220 }
	},

	// ─── Cardio PRs (visible) ──────────────────────────────────────
	{
		key: 'cardio.first_cardio',
		category: 'pr',
		hidden: false,
		title: 'First Cardio',
		description: 'Log your first cardio session',
		icon: 'heart',
		triggers: ['set.created'],
		predicate: { kind: 'cardio-first' }
	},
	{
		key: 'cardio.5k_club',
		category: 'pr',
		hidden: false,
		title: '5K Club',
		description: 'Cover 5 km in a single cardio session',
		icon: 'distance',
		triggers: ['set.created'],
		predicate: { kind: 'pr-cardio-distance', km: 5 }
	},
	{
		key: 'cardio.10k_club',
		category: 'pr',
		hidden: false,
		title: '10K Club',
		description: 'Cover 10 km in a single cardio session',
		icon: 'distance',
		triggers: ['set.created'],
		predicate: { kind: 'pr-cardio-distance', km: 10 }
	},
	{
		key: 'cardio.half_hour',
		category: 'pr',
		hidden: false,
		title: 'Half Hour',
		description: 'Sustain cardio for 30 minutes',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-cardio-duration', durationMin: 30 }
	},
	{
		key: 'cardio.hour_hero',
		category: 'pr',
		hidden: false,
		title: 'Hour Hero',
		description: 'Sustain cardio for 60 minutes',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-cardio-duration', durationMin: 60 }
	},

	// ─── Streaks / consistency (visible, toned) ────────────────────
	{
		key: 'streak.steady_three',
		category: 'streak',
		hidden: false,
		title: 'Steady Three',
		description: '3 sessions a week for 4 weeks',
		icon: 'flame',
		triggers: ['set.created'],
		predicate: { kind: 'session-density', sessionsPerWeek: 3, weeks: 4 }
	},
	{
		key: 'streak.locked_in',
		category: 'streak',
		hidden: false,
		title: 'Locked In',
		description: '3 sessions a week for 8 weeks',
		icon: 'flame',
		triggers: ['set.created'],
		predicate: { kind: 'session-density', sessionsPerWeek: 3, weeks: 8 }
	},
	{
		key: 'streak.habit_six_months',
		category: 'streak',
		hidden: false,
		title: 'Half-Year Habit',
		description: '3 sessions a week for 26 weeks',
		icon: 'flame',
		triggers: ['set.created'],
		predicate: { kind: 'session-density', sessionsPerWeek: 3, weeks: 26 }
	},
	{
		key: 'streak.comeback',
		category: 'streak',
		hidden: false,
		title: 'Comeback',
		description: 'Welcome back — your first session after a long break',
		icon: 'sparkle',
		triggers: ['set.created'],
		predicate: { kind: 'comeback-after-gap', gapDays: 30 }
	},

	// ─── Variety (visible) ─────────────────────────────────────────
	{
		key: 'variety.polyglot',
		category: 'variety',
		hidden: false,
		title: 'Polyglot',
		description: 'Use all four cardio kinds at least once',
		icon: 'compass',
		triggers: ['set.created'],
		predicate: { kind: 'variety-cardio-kinds-all' }
	},
	{
		key: 'variety.five_faces',
		category: 'variety',
		hidden: false,
		title: 'Five Faces',
		description: '5 different equipment in a single week',
		icon: 'compass',
		triggers: ['set.created'],
		predicate: { kind: 'variety-equipment-in-week', minDistinct: 5 }
	},
	{
		key: 'variety.full_body',
		category: 'variety',
		hidden: false,
		title: 'Full Body',
		description: 'Push, pull, legs and core in one week',
		icon: 'compass',
		triggers: ['set.created'],
		predicate: {
			kind: 'variety-groups-in-week',
			groups: ['push', 'pull', 'legs', 'core'],
			// Cheap-split rollup: a hip-thrust (group 'glutes') still satisfies
			// the 'legs' slot; a shoulder press ('shoulders') still satisfies
			// 'push'; a preacher curl ('arms') still satisfies 'pull'. Without
			// the rollup, splitting glutes/arms/shoulders out of the original
			// 5-group enum would have made this badge stricter than before.
			rollup: {
				legs: ['legs', 'glutes'],
				push: ['push', 'shoulders'],
				pull: ['pull', 'arms']
			}
		}
	},

	// ─── Timed-hold PRs (visible) ────────────────────────────────────
	{
		key: 'hold.first',
		category: 'pr',
		hidden: false,
		title: 'First Hold',
		description: 'Log your first timed hold',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'timed-first' }
	},
	{
		key: 'hold.thirty_seconds',
		category: 'pr',
		hidden: false,
		title: 'Half Minute',
		description: 'Hold a position for 30 seconds',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-timed-min', minSec: 30 }
	},
	{
		key: 'hold.minute',
		category: 'pr',
		hidden: false,
		title: 'Sixty Seconds',
		description: 'Hold a position for 1 minute',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-timed-min', minSec: 60 }
	},
	{
		key: 'hold.two_minutes',
		category: 'pr',
		hidden: false,
		title: 'Two Minutes',
		description: 'Hold a position for 2 minutes',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-timed-min', minSec: 120 }
	},
	{
		key: 'hold.iron',
		category: 'pr',
		hidden: false,
		title: 'Iron Core',
		description: 'Hold a position for 5 minutes',
		icon: 'stopwatch',
		triggers: ['set.created'],
		predicate: { kind: 'pr-timed-min', minSec: 300 }
	},

	// ─── Loaded carry PRs (visible) ──────────────────────────────────
	{
		key: 'carry.first',
		category: 'pr',
		hidden: false,
		title: 'First Carry',
		description: 'Log your first loaded carry',
		icon: 'distance',
		triggers: ['set.created'],
		predicate: { kind: 'carry-first' }
	},
	{
		key: 'carry.fifty_meters',
		category: 'pr',
		hidden: false,
		title: 'Fifty Meters',
		description: 'Carry weight 50 m in a single set',
		icon: 'distance',
		triggers: ['set.created'],
		predicate: { kind: 'pr-carry-min', minDistanceM: 50 }
	},
	{
		key: 'carry.heavy_lift',
		category: 'pr',
		hidden: false,
		title: 'Heavy Carry',
		description: 'Carry 50+ kg for 10+ m',
		icon: 'distance',
		triggers: ['set.created'],
		predicate: { kind: 'pr-carry-min', minWeightKg: 50, minDistanceM: 10 }
	},

	// ─── Variety: all input modes used ───────────────────────────────
	{
		key: 'variety.all_modes',
		category: 'variety',
		hidden: false,
		title: 'All Modes',
		description: 'Log a set in every input mode',
		icon: 'compass',
		triggers: ['set.created'],
		predicate: { kind: 'variety-input-modes-all' }
	},

	// ─── Easter eggs (hidden) ──────────────────────────────────────
	{
		key: 'easter.night_owl',
		category: 'easter',
		hidden: true,
		title: 'Night Owl',
		description: 'Logged a set between 22:00 and 04:00',
		icon: 'moon',
		triggers: ['set.created'],
		predicate: { kind: 'easter-time-window', startHour: 22, endHour: 4 }
	},
	{
		key: 'easter.early_bird',
		category: 'easter',
		hidden: true,
		title: 'Early Bird',
		description: 'Logged a set between 04:00 and 06:00',
		icon: 'sunrise',
		triggers: ['set.created'],
		predicate: { kind: 'easter-time-window', startHour: 4, endHour: 6 }
	},
	{
		key: 'easter.lunch_break',
		category: 'easter',
		hidden: true,
		title: 'Lunch Break',
		description: 'Logged a weekday set between 12:00 and 13:00',
		icon: 'sandwich',
		triggers: ['set.created'],
		predicate: {
			kind: 'easter-time-window',
			startHour: 12,
			endHour: 13,
			weekdayOnly: true
		}
	},
	{
		key: 'easter.marathon',
		category: 'easter',
		hidden: true,
		title: 'Marathon',
		description: 'A single session over two hours long',
		icon: 'hourglass',
		triggers: ['session.ended'],
		predicate: { kind: 'easter-session-duration-min', minutes: 120 }
	},
	{
		key: 'easter.speed_run',
		category: 'easter',
		hidden: true,
		title: 'Speed Run',
		description: '5+ sets in under 20 minutes',
		icon: 'lightning',
		triggers: ['session.ended', 'set.created'],
		predicate: { kind: 'easter-session-set-density', minSets: 5, maxMinutes: 20 }
	},
	{
		key: 'easter.five_by_five',
		category: 'easter',
		hidden: true,
		title: 'Five by Five',
		description: '5 sets of 5 reps at the same weight, same exercise, one session',
		icon: 'grid',
		triggers: ['set.created'],
		predicate: { kind: 'easter-five-by-five' }
	},
	{
		key: 'easter.pr_day',
		category: 'easter',
		hidden: true,
		title: 'PR Day',
		description: 'Three personal records in a single session',
		icon: 'trophy',
		triggers: ['set.created'],
		predicate: { kind: 'easter-pr-day', minPrs: 3 }
	},
	{
		key: 'easter.new_year',
		category: 'easter',
		hidden: true,
		title: 'New Year, New PR',
		description: 'A personal record on January 1',
		icon: 'firework',
		triggers: ['set.created'],
		predicate: { kind: 'easter-calendar-day', month: 1, day: 1 }
	}
];

// Lookup index by key — used by the unread-modal renderer to map a stored
// achievement.badgeKey back to its UI metadata. Built once at module load.
export const BADGE_BY_KEY: Map<string, BadgeDefinition> = new Map(
	BADGE_DEFINITIONS.map((b) => [b.key, b])
);
