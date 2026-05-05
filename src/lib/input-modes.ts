// How a piece of equipment is logged. The Log screen branches on the
// equipment's `inputMode` (via MODE_SHAPE below) to render the right input
// fields; the server validator (src/lib/server/mutations.ts) enforces which
// `set` columns are required vs. forbidden per mode.
//
// - weighted: classic strength. weight + reps.
// - bodyweight: bodyweight-loaded equipment (pull-up, dip, captain's chair,
//   hyperextension). weight + reps; weight may be 0 or negative (assistance).
//   The server snapshots bwLoadKg/bwKg/bwPct into set.extras at log time.
// - distance_time: cardio. durationMin + extras (distance, hr, calories, …).
// - timed: bodyweight isometric holds (plank, dead hang, wall sit). duration
//   only; no weight, no reps.
// - timed_weighted: weighted isometric holds (weighted plank, weighted wall
//   sit). weight + duration.
// - weight_distance: loaded carries / sled push. weight + extras.distance;
//   no reps, no duration.

export type InputMode =
	| 'weighted'
	| 'bodyweight'
	| 'distance_time'
	| 'timed'
	| 'timed_weighted'
	| 'weight_distance';

export const INPUT_MODES: InputMode[] = [
	'weighted',
	'bodyweight',
	'distance_time',
	'timed',
	'timed_weighted',
	'weight_distance'
];

export interface ModeShape {
	hasWeight: boolean;
	hasReps: boolean;
	hasDuration: boolean;
	hasDistance: boolean;
}

export const MODE_SHAPE: Record<InputMode, ModeShape> = {
	weighted: { hasWeight: true, hasReps: true, hasDuration: false, hasDistance: false },
	bodyweight: { hasWeight: true, hasReps: true, hasDuration: false, hasDistance: false },
	distance_time: { hasWeight: false, hasReps: false, hasDuration: true, hasDistance: true },
	timed: { hasWeight: false, hasReps: false, hasDuration: true, hasDistance: false },
	timed_weighted: { hasWeight: true, hasReps: false, hasDuration: true, hasDistance: false },
	weight_distance: { hasWeight: true, hasReps: false, hasDuration: false, hasDistance: true }
};

// Friendly label for the Log screen header, the AddEquipmentSheet picker,
// and any other UI surface that wants to name the mode in one short word.
export const MODE_LABEL: Record<InputMode, string> = {
	weighted: 'Lift',
	bodyweight: 'Bodyweight',
	distance_time: 'Cardio',
	timed: 'Hold',
	timed_weighted: 'Loaded hold',
	weight_distance: 'Carry'
};

// Format minutes (the way set.durationMin is stored) as mm:ss for the Stepper
// and the SetRow summary. 0.5 → "0:30", 1.0833… → "1:05".
export function formatDurationMinAsClock(min: number): string {
	const totalSec = Math.max(0, Math.round(min * 60));
	const mm = Math.floor(totalSec / 60);
	const ss = String(totalSec % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}
