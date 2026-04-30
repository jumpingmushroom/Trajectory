// Glyph kinds shared between EquipmentGlyph (the SVG renderer) and the
// AddEquipmentSheet (the picker grid). Each kind has a label, a
// category (used to group the picker), and a list of search aliases.

export type GlyphKind =
	| 'bench'
	| 'squat'
	| 'cable'
	| 'pulldown'
	| 'smith'
	| 'treadmill'
	| 'bike'
	| 'rower'
	| 'preacher'
	| 'chestpress'
	| 'legpress'
	| 'shoulderpress'
	| 'captainschair'
	| 'stairmaster'
	| 'elliptical'
	| 'legcurl'
	| 'legextension'
	| 'hyperextension'
	| 'pullupbar'
	| 'dipstation'
	| 'cablecrossover'
	| 'dumbbells'
	| 'barbell'
	| 'kettlebell'
	| 'generic'
	| 'hackquat'
	| 'tbarrow'
	| 'calfraise'
	| 'hipthrust'
	| 'sled'
	| 'battleropes'
	| 'abwheel'
	| 'mobility';

export type GlyphCategory =
	| 'push'
	| 'pull'
	| 'legs'
	| 'core'
	| 'freeweight'
	| 'cardio'
	| 'other';

export interface GlyphMeta {
	kind: GlyphKind;
	label: string;
	category: GlyphCategory;
	aliases: string[];
}

// Order here is the order glyphs appear within their category in the
// picker. Categories themselves are ordered by CATEGORY_ORDER below.
export const GLYPHS: GlyphMeta[] = [
	// push
	{ kind: 'chestpress', label: 'Chest Press', category: 'push', aliases: ['chest press', 'machine press'] },
	{ kind: 'shoulderpress', label: 'Shoulder Press', category: 'push', aliases: ['shoulder press', 'overhead press', 'ohp', 'military press'] },
	{ kind: 'dipstation', label: 'Dip Station', category: 'push', aliases: ['dip', 'dips', 'parallel bars'] },
	{ kind: 'cablecrossover', label: 'Cable Crossover', category: 'push', aliases: ['cable crossover', 'crossover', 'cable fly', 'fly'] },

	// pull
	{ kind: 'pulldown', label: 'Lat Pulldown', category: 'pull', aliases: ['lat pulldown', 'lat pull-down', 'lat pull'] },
	{ kind: 'cable', label: 'Cable Column', category: 'pull', aliases: ['cable', 'cable machine', 'single cable', 'cable column'] },
	{ kind: 'tbarrow', label: 'T-Bar Row', category: 'pull', aliases: ['t-bar row', 'tbar', 't bar', 'landmine row'] },
	{ kind: 'pullupbar', label: 'Pull-Up Bar', category: 'pull', aliases: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chinup'] },
	{ kind: 'preacher', label: 'Preacher Curl', category: 'pull', aliases: ['preacher curl', 'scott curl', 'biceps curl'] },

	// legs
	{ kind: 'squat', label: 'Squat Rack', category: 'legs', aliases: ['squat', 'squat rack', 'power rack'] },
	{ kind: 'legpress', label: 'Leg Press', category: 'legs', aliases: ['leg press'] },
	{ kind: 'legcurl', label: 'Leg Curl', category: 'legs', aliases: ['leg curl', 'hamstring curl', 'lying curl', 'seated curl'] },
	{ kind: 'legextension', label: 'Leg Extension', category: 'legs', aliases: ['leg extension', 'quad extension'] },
	{ kind: 'hackquat', label: 'Hack Squat', category: 'legs', aliases: ['hack squat', 'hack'] },
	{ kind: 'calfraise', label: 'Calf Raise', category: 'legs', aliases: ['calf raise', 'calves', 'standing calf'] },
	{ kind: 'hipthrust', label: 'Hip Thrust', category: 'legs', aliases: ['hip thrust', 'glute bridge', 'thruster'] },

	// core
	{ kind: 'captainschair', label: "Captain's Chair", category: 'core', aliases: ["captain's chair", 'captains chair', 'leg raise', 'abs'] },
	{ kind: 'abwheel', label: 'Ab Wheel', category: 'core', aliases: ['ab wheel', 'ab roller'] },
	{ kind: 'hyperextension', label: 'Hyperextension', category: 'core', aliases: ['hyperextension', 'back extension', 'roman chair', 'glute ham'] },

	// freeweight
	{ kind: 'bench', label: 'Bench', category: 'freeweight', aliases: ['bench', 'flat bench', 'barbell bench'] },
	{ kind: 'smith', label: 'Smith Machine', category: 'freeweight', aliases: ['smith', 'smith machine'] },
	{ kind: 'barbell', label: 'Barbell', category: 'freeweight', aliases: ['barbell', 'free barbell', 'olympic bar'] },
	{ kind: 'dumbbells', label: 'Dumbbells', category: 'freeweight', aliases: ['dumbbells', 'dumbbell', 'dumbbell rack', 'db'] },
	{ kind: 'kettlebell', label: 'Kettlebell', category: 'freeweight', aliases: ['kettlebell', 'kb'] },

	// cardio
	{ kind: 'treadmill', label: 'Treadmill', category: 'cardio', aliases: ['treadmill', 'tread', 'running'] },
	{ kind: 'bike', label: 'Bike', category: 'cardio', aliases: ['bike', 'stationary bike', 'spin bike', 'cycle'] },
	{ kind: 'rower', label: 'Rower', category: 'cardio', aliases: ['rower', 'rowing machine', 'erg'] },
	{ kind: 'elliptical', label: 'Elliptical', category: 'cardio', aliases: ['elliptical', 'cross trainer'] },
	{ kind: 'stairmaster', label: 'Stair Climber', category: 'cardio', aliases: ['stairmaster', 'stair', 'stepper', 'stepmill', 'stair climber'] },

	// other
	{ kind: 'sled', label: 'Sled', category: 'other', aliases: ['sled', 'prowler', 'push sled'] },
	{ kind: 'battleropes', label: 'Battle Ropes', category: 'other', aliases: ['battle ropes', 'ropes'] },
	{ kind: 'mobility', label: 'Foam Roller', category: 'other', aliases: ['foam roller', 'mobility', 'roller', 'stretch'] },
	{ kind: 'generic', label: 'Generic', category: 'other', aliases: ['generic', 'other', 'unknown', 'custom'] }
];

// Category display order in the picker grid.
export const CATEGORY_ORDER: GlyphCategory[] = [
	'push',
	'pull',
	'legs',
	'core',
	'freeweight',
	'cardio',
	'other'
];

export const CATEGORY_LABEL: Record<GlyphCategory, string> = {
	push: 'Push',
	pull: 'Pull',
	legs: 'Legs',
	core: 'Core',
	freeweight: 'Free weight',
	cardio: 'Cardio',
	other: 'Other'
};

// Derived for back-compat with any consumer that just wants the kinds.
export const GLYPH_KINDS: GlyphKind[] = GLYPHS.map((g) => g.kind);
