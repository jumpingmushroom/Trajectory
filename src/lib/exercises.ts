// Curated exercise list for free-weight stations.
// The picker shows these grouped by equipment.type when adding a child
// exercise to a free-weight piece of equipment. "+ Custom" at the bottom
// of the picker lets users add their own name. Machines and cables get
// an auto-created hidden exercise from equipment.name and never show
// the picker.
//
// Promote this to a real `exercise_library` table only if/when users
// want to curate the list themselves.

export type EquipmentType = 'barbell' | 'machine' | 'cable' | 'freeweight' | 'cardio';

export const CURATED_EXERCISES: Record<EquipmentType, string[]> = {
	freeweight: [
		'DB Bench Press',
		'DB Incline Bench',
		'DB Shoulder Press',
		'DB Lateral Raise',
		'DB Front Raise',
		'DB Row',
		'DB Curl',
		'DB Hammer Curl',
		'DB Tricep Extension',
		'DB Lunge',
		'DB Romanian Deadlift',
		'DB Goblet Squat'
	],
	barbell: [
		'Back Squat',
		'Front Squat',
		'Deadlift',
		'Romanian Deadlift',
		'Conventional Bench Press',
		'Incline Bench Press',
		'Overhead Press',
		'Bent-Over Row',
		'Pendlay Row',
		'Hip Thrust',
		'Good Morning',
		'Power Clean'
	],
	machine: [],
	cable: [],
	cardio: []
};

export function exerciseSuggestionsFor(type: string): string[] {
	if (type in CURATED_EXERCISES) {
		return CURATED_EXERCISES[type as EquipmentType];
	}
	return [];
}
