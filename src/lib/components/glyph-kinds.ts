// Glyph kinds shared between EquipmentGlyph (the SVG renderer) and the
// AddEquipmentSheet (the picker grid). Kept in a .ts file because Svelte
// component files only export the component itself; constants live here.

export type GlyphKind =
	| 'legpress'
	| 'cable'
	| 'pulldown'
	| 'smith'
	| 'bench'
	| 'squat'
	| 'preacher'
	| 'chestpress'
	| 'treadmill'
	| 'bike'
	| 'rower';

export const GLYPH_KINDS: GlyphKind[] = [
	'bench',
	'squat',
	'legpress',
	'cable',
	'pulldown',
	'smith',
	'preacher',
	'chestpress',
	'treadmill',
	'bike',
	'rower'
];
