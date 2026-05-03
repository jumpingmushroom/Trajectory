// Glyph kinds shared between EquipmentGlyph (the SVG renderer) and the
// AddEquipmentSheet (the picker grid). Each kind has a label, a
// category (used to group the picker), search aliases, and a `defaults`
// pair (type + optional muscle group) applied when picked in add mode.

export type EquipmentType = 'barbell' | 'machine' | 'cable' | 'freeweight' | 'cardio';
export type MuscleGroup = 'push' | 'pull' | 'legs' | 'core' | 'cardio';

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

export type GlyphCategory = 'push' | 'pull' | 'legs' | 'core' | 'freeweight' | 'cardio' | 'other';

export interface GlyphMeta {
	kind: GlyphKind;
	label: string;
	category: GlyphCategory;
	aliases: string[];
	// Applied when the glyph is picked in add mode. `group` omitted when
	// the glyph is multi-use (free-weight bars, ropes, foam roller, generic)
	// — the previous group selection is preserved instead of clobbered.
	defaults: { type: EquipmentType; group?: MuscleGroup };
}

// Order here is the order glyphs appear within their category in the
// picker. Categories themselves are ordered by CATEGORY_ORDER below.
export const GLYPHS: GlyphMeta[] = [
	// push
	{
		kind: 'chestpress',
		label: 'Chest Press',
		category: 'push',
		aliases: ['chest press', 'machine press'],
		defaults: { type: 'machine', group: 'push' }
	},
	{
		kind: 'shoulderpress',
		label: 'Shoulder Press',
		category: 'push',
		aliases: ['shoulder press', 'overhead press', 'ohp', 'military press'],
		defaults: { type: 'machine', group: 'push' }
	},
	{
		kind: 'dipstation',
		label: 'Dip Station',
		category: 'push',
		aliases: ['dip', 'dips', 'parallel bars'],
		defaults: { type: 'freeweight', group: 'push' }
	},
	{
		kind: 'cablecrossover',
		label: 'Cable Crossover',
		category: 'push',
		aliases: ['cable crossover', 'crossover', 'cable fly', 'fly'],
		defaults: { type: 'cable', group: 'push' }
	},

	// pull
	{
		kind: 'pulldown',
		label: 'Lat Pulldown',
		category: 'pull',
		aliases: ['lat pulldown', 'lat pull-down', 'lat pull'],
		defaults: { type: 'machine', group: 'pull' }
	},
	{
		kind: 'cable',
		label: 'Cable Column',
		category: 'pull',
		aliases: ['cable', 'cable machine', 'single cable', 'cable column'],
		defaults: { type: 'cable', group: 'pull' }
	},
	{
		kind: 'tbarrow',
		label: 'T-Bar Row',
		category: 'pull',
		aliases: ['t-bar row', 'tbar', 't bar', 'landmine row'],
		defaults: { type: 'machine', group: 'pull' }
	},
	{
		kind: 'pullupbar',
		label: 'Pull-Up Bar',
		category: 'pull',
		aliases: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chinup'],
		defaults: { type: 'freeweight', group: 'pull' }
	},
	{
		kind: 'preacher',
		label: 'Preacher Curl',
		category: 'pull',
		aliases: ['preacher curl', 'scott curl', 'biceps curl'],
		defaults: { type: 'machine', group: 'pull' }
	},

	// legs
	{
		kind: 'squat',
		label: 'Squat Rack',
		category: 'legs',
		aliases: ['squat', 'squat rack', 'power rack'],
		defaults: { type: 'barbell', group: 'legs' }
	},
	{
		kind: 'legpress',
		label: 'Leg Press',
		category: 'legs',
		aliases: ['leg press'],
		defaults: { type: 'machine', group: 'legs' }
	},
	{
		kind: 'legcurl',
		label: 'Leg Curl',
		category: 'legs',
		aliases: ['leg curl', 'hamstring curl', 'lying curl', 'seated curl'],
		defaults: { type: 'machine', group: 'legs' }
	},
	{
		kind: 'legextension',
		label: 'Leg Extension',
		category: 'legs',
		aliases: ['leg extension', 'quad extension'],
		defaults: { type: 'machine', group: 'legs' }
	},
	{
		kind: 'hackquat',
		label: 'Hack Squat',
		category: 'legs',
		aliases: ['hack squat', 'hack'],
		defaults: { type: 'machine', group: 'legs' }
	},
	{
		kind: 'calfraise',
		label: 'Calf Raise',
		category: 'legs',
		aliases: ['calf raise', 'calves', 'standing calf'],
		defaults: { type: 'machine', group: 'legs' }
	},
	{
		kind: 'hipthrust',
		label: 'Hip Thrust',
		category: 'legs',
		aliases: ['hip thrust', 'glute bridge', 'thruster'],
		defaults: { type: 'machine', group: 'legs' }
	},

	// core
	{
		kind: 'captainschair',
		label: "Captain's Chair",
		category: 'core',
		aliases: ["captain's chair", 'captains chair', 'leg raise', 'abs'],
		defaults: { type: 'machine', group: 'core' }
	},
	{
		kind: 'abwheel',
		label: 'Ab Wheel',
		category: 'core',
		aliases: ['ab wheel', 'ab roller'],
		defaults: { type: 'freeweight', group: 'core' }
	},
	{
		kind: 'hyperextension',
		label: 'Hyperextension',
		category: 'core',
		aliases: ['hyperextension', 'back extension', 'roman chair', 'glute ham'],
		defaults: { type: 'machine', group: 'core' }
	},

	// freeweight
	{
		kind: 'bench',
		label: 'Bench',
		category: 'freeweight',
		aliases: ['bench', 'flat bench', 'barbell bench'],
		defaults: { type: 'barbell' }
	},
	{
		kind: 'smith',
		label: 'Smith Machine',
		category: 'freeweight',
		aliases: ['smith', 'smith machine'],
		defaults: { type: 'machine' }
	},
	{
		kind: 'barbell',
		label: 'Barbell',
		category: 'freeweight',
		aliases: ['barbell', 'free barbell', 'olympic bar'],
		defaults: { type: 'barbell' }
	},
	{
		kind: 'dumbbells',
		label: 'Dumbbells',
		category: 'freeweight',
		aliases: ['dumbbells', 'dumbbell', 'dumbbell rack', 'db'],
		defaults: { type: 'freeweight' }
	},
	{
		kind: 'kettlebell',
		label: 'Kettlebell',
		category: 'freeweight',
		aliases: ['kettlebell', 'kb'],
		defaults: { type: 'freeweight' }
	},

	// cardio
	{
		kind: 'treadmill',
		label: 'Treadmill',
		category: 'cardio',
		aliases: ['treadmill', 'tread', 'running'],
		defaults: { type: 'cardio', group: 'cardio' }
	},
	{
		kind: 'bike',
		label: 'Bike',
		category: 'cardio',
		aliases: ['bike', 'stationary bike', 'spin bike', 'cycle'],
		defaults: { type: 'cardio', group: 'cardio' }
	},
	{
		kind: 'rower',
		label: 'Rower',
		category: 'cardio',
		aliases: ['rower', 'rowing machine', 'erg'],
		defaults: { type: 'cardio', group: 'cardio' }
	},
	{
		kind: 'elliptical',
		label: 'Elliptical',
		category: 'cardio',
		aliases: ['elliptical', 'cross trainer'],
		defaults: { type: 'cardio', group: 'cardio' }
	},
	{
		kind: 'stairmaster',
		label: 'Stair Climber',
		category: 'cardio',
		aliases: ['stairmaster', 'stair', 'stepper', 'stepmill', 'stair climber'],
		defaults: { type: 'cardio', group: 'cardio' }
	},

	// other
	{
		kind: 'sled',
		label: 'Sled',
		category: 'other',
		aliases: ['sled', 'prowler', 'push sled'],
		defaults: { type: 'freeweight', group: 'legs' }
	},
	{
		kind: 'battleropes',
		label: 'Battle Ropes',
		category: 'other',
		aliases: ['battle ropes', 'ropes'],
		defaults: { type: 'freeweight' }
	},
	{
		kind: 'mobility',
		label: 'Foam Roller',
		category: 'other',
		aliases: ['foam roller', 'mobility', 'roller', 'stretch'],
		defaults: { type: 'freeweight' }
	},
	{
		kind: 'generic',
		label: 'Generic',
		category: 'other',
		aliases: ['generic', 'other', 'unknown', 'custom'],
		defaults: { type: 'machine' }
	}
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

const DEFAULTS_BY_KIND: Record<GlyphKind, { type: EquipmentType; group?: MuscleGroup }> =
	Object.fromEntries(GLYPHS.map((g) => [g.kind, g.defaults])) as Record<
		GlyphKind,
		{ type: EquipmentType; group?: MuscleGroup }
	>;

export function defaultsForGlyph(kind: GlyphKind): { type: EquipmentType; group?: MuscleGroup } {
	return DEFAULTS_BY_KIND[kind];
}
