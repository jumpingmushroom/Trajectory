// Cardio templates per equipment.cardioKind. The optional-field set is
// hardcoded per BRAINSTORM Q7 (locked: kcal everywhere, HR everywhere
// including treadmill, watts deliberately out for v0.1). Templates are
// "baked in" — user-customizable cardio templates are FUTURE.md.

export type CardioKind = 'treadmill' | 'bike' | 'rower' | 'generic';

export interface CardioField {
	id: string;
	label: string;
	unit: string;
	step: number;
	min: number;
	defaultValue: number;
}

export const CARDIO_TEMPLATES: Record<CardioKind, CardioField[]> = {
	treadmill: [
		{ id: 'distance', label: 'Distance', unit: 'km', step: 0.1, min: 0, defaultValue: 3.0 },
		{ id: 'incline', label: 'Incline', unit: '%', step: 0.5, min: 0, defaultValue: 1.5 },
		{ id: 'calories', label: 'Calories', unit: 'kcal', step: 5, min: 0, defaultValue: 250 },
		{ id: 'hr', label: 'Avg HR', unit: 'bpm', step: 1, min: 0, defaultValue: 140 }
	],
	bike: [
		{ id: 'distance', label: 'Distance', unit: 'km', step: 0.1, min: 0, defaultValue: 12.0 },
		{ id: 'level', label: 'Level', unit: '', step: 1, min: 0, defaultValue: 8 },
		{ id: 'rpm', label: 'Avg RPM', unit: '', step: 1, min: 0, defaultValue: 78 },
		{ id: 'calories', label: 'Calories', unit: 'kcal', step: 5, min: 0, defaultValue: 340 },
		{ id: 'hr', label: 'Avg HR', unit: 'bpm', step: 1, min: 0, defaultValue: 132 }
	],
	rower: [
		{ id: 'distance', label: 'Distance', unit: 'm', step: 50, min: 0, defaultValue: 3000 },
		{ id: 'split', label: '/500 m', unit: 's', step: 1, min: 0, defaultValue: 125 },
		{ id: 'spm', label: 'Avg SPM', unit: '', step: 1, min: 0, defaultValue: 24 },
		{ id: 'calories', label: 'Calories', unit: 'kcal', step: 5, min: 0, defaultValue: 180 },
		{ id: 'hr', label: 'Avg HR', unit: 'bpm', step: 1, min: 0, defaultValue: 148 }
	],
	generic: [
		{ id: 'distance', label: 'Distance', unit: 'km', step: 0.1, min: 0, defaultValue: 5.0 },
		{ id: 'calories', label: 'Calories', unit: 'kcal', step: 5, min: 0, defaultValue: 300 },
		{ id: 'hr', label: 'Avg HR', unit: 'bpm', step: 1, min: 0, defaultValue: 140 }
	]
};

export function fieldsFor(kind: string | null | undefined): CardioField[] {
	if (!kind) return CARDIO_TEMPLATES.generic;
	if (kind in CARDIO_TEMPLATES) {
		return CARDIO_TEMPLATES[kind as CardioKind];
	}
	return CARDIO_TEMPLATES.generic;
}
