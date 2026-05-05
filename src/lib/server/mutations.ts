// Mutation router. Every write to Trajectory's domain tables flows
// through here so the offline-first sync layer (M10) has a single
// idempotent contract to replay against. Each mutation is identified
// by (clientId, mutationId); replays are no-ops thanks to the
// mutation_log composite primary key.
//
// ULIDs in payloads are minted client-side (per DECISIONS D4). The
// server validates their format on every call.

import { eq, and, isNull, desc, asc, gte, gt, lt, sql } from 'drizzle-orm';
import { evaluateAchievements } from './achievements/evaluator';
import { db } from './db';
import { startOfUtcDay } from '../dateMode';
import {
	gym,
	equipment,
	exercise,
	workoutSession,
	set as setTable,
	user,
	type Gym,
	type Equipment,
	type Exercise,
	type Set as SetRow,
	type WorkoutSession,
	type User
} from './db/schema';
import { newUlid, assertUlid, isUlid } from './ulid';

export type MutationOp =
	| { op: 'gym.create'; payload: GymCreate }
	| { op: 'gym.update'; payload: GymUpdate }
	| { op: 'gym.delete'; payload: { id: string } }
	| { op: 'equipment.create'; payload: EquipmentCreate }
	| { op: 'equipment.update'; payload: EquipmentUpdate }
	| { op: 'equipment.delete'; payload: { id: string } }
	| { op: 'exercise.create'; payload: ExerciseCreate }
	| { op: 'exercise.update'; payload: ExerciseUpdate }
	| { op: 'exercise.delete'; payload: { id: string } }
	| { op: 'set.create'; payload: SetCreate }
	| { op: 'set.update'; payload: SetUpdate }
	| { op: 'set.delete'; payload: { id: string } }
	| { op: 'session.start'; payload: SessionStart }
	| { op: 'session.end'; payload: { id: string } }
	| { op: 'session.endUndo'; payload: { id: string } }
	| { op: 'session.delete'; payload: { id: string } }
	| { op: 'user.update'; payload: UserUpdate };

export interface MutationEnvelope {
	clientId: string;
	mutationId: string;
	op: MutationOp['op'];
	payload: unknown;
}

interface GymCreate {
	id: string;
	name: string;
	city?: string | null;
	tint?: string;
	isPrimary?: boolean;
}
interface GymUpdate {
	id: string;
	name?: string;
	city?: string | null;
	tint?: string;
	isPrimary?: boolean;
}

interface EquipmentCreate {
	id: string;
	gymId: string;
	name: string;
	type: string;
	group: string;
	glyph?: string;
	tint?: string;
	cardioKind?: string | null;
	sortOrder?: number;
	bodyweightPct?: number | null;
	inputMode?: string;
}
interface EquipmentUpdate {
	id: string;
	name?: string;
	type?: string;
	group?: string;
	glyph?: string;
	tint?: string;
	cardioKind?: string | null;
	sortOrder?: number;
	notes?: string | null;
	bodyweightPct?: number | null;
	inputMode?: string;
}

interface UserUpdate {
	bodyWeightKg?: number | null;
}

interface ExerciseCreate {
	id: string;
	equipmentId: string;
	name: string;
	isHidden?: boolean;
	sortOrder?: number;
}
interface ExerciseUpdate {
	id: string;
	name?: string;
	sortOrder?: number;
}

interface SetCreate {
	id: string;
	exerciseId: string;
	weight?: number | null;
	reps?: number | null;
	durationMin?: number | null;
	extras?: Record<string, number> | null;
	ts?: number;
}

interface SessionStart {
	id: string;
	gymId: string;
	startedAt?: number;
}
interface SetUpdate {
	id: string;
	weight?: number | null;
	reps?: number | null;
	durationMin?: number | null;
	extras?: Record<string, number> | null;
}

const EQUIPMENT_TYPES = new Set(['barbell', 'machine', 'cable', 'freeweight', 'cardio']);
const MUSCLE_GROUPS = new Set([
	'push',
	'pull',
	'legs',
	'core',
	'cardio',
	'arms',
	'shoulders',
	'glutes'
]);
const CARDIO_KINDS = new Set(['treadmill', 'bike', 'rower', 'generic']);
const INPUT_MODES = new Set([
	'weighted',
	'bodyweight',
	'distance_time',
	'timed',
	'timed_weighted',
	'weight_distance'
]);
// Modes that don't host user-named child exercises — the equipment row gets
// one auto-hidden exercise so all sets FK uniformly. The set of such modes is
// "everything except the canonical free-weight/barbell weighted-reps stations
// where the user picks named variants from the curated list."
const AUTO_HIDDEN_MODES = new Set([
	'distance_time',
	'bodyweight',
	'timed',
	'timed_weighted',
	'weight_distance'
]);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function badRequest(msg: string): never {
	const err = new Error(msg);
	(err as Error & { status?: number }).status = 400;
	throw err;
}

function notFound(msg: string): never {
	const err = new Error(msg);
	(err as Error & { status?: number }).status = 404;
	throw err;
}

function assertString(value: unknown, label: string, max = 200): string {
	if (typeof value !== 'string') badRequest(`${label} must be a string`);
	const trimmed = (value as string).trim();
	if (trimmed.length === 0) badRequest(`${label} must not be empty`);
	if (trimmed.length > max) badRequest(`${label} must be at most ${max} characters`);
	return trimmed;
}

function assertHex(value: unknown, label: string): string {
	const v = assertString(value, label, 7);
	if (!HEX_RE.test(v)) badRequest(`${label} must be a 6-digit hex color (#rrggbb)`);
	return v;
}

function assertEnum<T extends string>(value: unknown, label: string, allowed: Set<T>): T {
	const v = assertString(value, label, 20);
	if (!allowed.has(v as T)) badRequest(`${label} must be one of: ${[...allowed].join(', ')}`);
	return v as T;
}

// Bodyweight load percentage as a decimal in [0, 2]. Stored on equipment to
// flag bodyweight-loaded exercises (captain's chair, pull-up bar, etc.).
// Range allows up to 200% so weighted-vest setups or multi-limb leverage
// configurations aren't artificially clamped. Rounded to 4 decimals on the
// way in (≈ 0.01 % precision) to keep stored values tidy.
function assertBodyweightPct(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		badRequest(`${label} must be a finite number`);
	}
	if (value < 0 || value > 2) badRequest(`${label} must be between 0 and 2`);
	return Math.round(value * 10000) / 10000;
}

function logMutation(clientId: string, mutationId: string, userId: string): boolean {
	// Returns true if this is a fresh mutation, false if it's a replay.
	try {
		db.$client
			.prepare(
				`INSERT INTO mutation_log (client_id, mutation_id, user_id, applied_at) VALUES (?, ?, ?, ?)`
			)
			.run(clientId, mutationId, userId, Date.now());
		return true;
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT') {
			return false;
		}
		throw err;
	}
}

// ─── op handlers ────────────────────────────────────────────────────────

// Per-user tenancy guard. A gym is the root of ownership in this schema —
// equipment + exercise inherit through `gym.userId`. Returns the gym row
// when it belongs to the caller, otherwise throws notFound. This both
// defends against cross-tenant access and gives callers a populated row
// without a second SELECT.
async function assertGymOwned(gymId: string, userId: string): Promise<Gym> {
	const row = (
		await db
			.select()
			.from(gym)
			.where(and(eq(gym.id, gymId), eq(gym.userId, userId), isNull(gym.deletedAt)))
			.limit(1)
	)[0];
	if (!row) notFound(`gym ${gymId} not found`);
	return row;
}

// User-profile updates that aren't covered by Better Auth's built-in
// /update-user endpoint (display name, image). Currently just body weight,
// used to compute bodyweight-loaded effective load on the log screen and
// snapshot bwLoadKg into `set.extras` at log time. Range 30–400 kg matches
// realistic human bounds; null clears the value.
async function userUpdate(payload: UserUpdate, userId: string): Promise<User> {
	const updates: Partial<User> = { updatedAt: new Date() };
	if (payload.bodyWeightKg !== undefined) {
		if (payload.bodyWeightKg === null) {
			updates.bodyWeightKg = null;
		} else {
			if (typeof payload.bodyWeightKg !== 'number' || !Number.isFinite(payload.bodyWeightKg)) {
				badRequest('bodyWeightKg must be a finite number or null');
			}
			if (payload.bodyWeightKg < 30 || payload.bodyWeightKg > 400) {
				badRequest('bodyWeightKg must be between 30 and 400 kg');
			}
			updates.bodyWeightKg = Math.round(payload.bodyWeightKg * 10) / 10;
		}
	}
	if (Object.keys(updates).length === 1) badRequest('user.update needs at least one field');

	await db.update(user).set(updates).where(eq(user.id, userId));
	const row = (await db.select().from(user).where(eq(user.id, userId)).limit(1))[0];
	if (!row) notFound('user not found');
	return row;
}

async function gymCreate(payload: GymCreate, userId: string): Promise<Gym> {
	assertUlid(payload.id, 'id');
	const name = assertString(payload.name, 'name', 80);
	const city = payload.city == null ? null : assertString(payload.city, 'city', 80);
	const tint = payload.tint ? assertHex(payload.tint, 'tint') : '#1c2026';
	const isPrimary = payload.isPrimary === true;

	await db
		.insert(gym)
		.values({ id: payload.id, userId, name, city, tint, isPrimary })
		.onConflictDoNothing();
	const row = (
		await db
			.select()
			.from(gym)
			.where(and(eq(gym.id, payload.id), eq(gym.userId, userId)))
			.limit(1)
	)[0];
	if (!row) notFound(`gym ${payload.id} not found after insert`);
	return row;
}

async function gymUpdate(payload: GymUpdate, userId: string): Promise<Gym> {
	assertUlid(payload.id, 'id');
	await assertGymOwned(payload.id, userId);

	const updates: Partial<Gym> = { updatedAt: new Date() };
	if (payload.name !== undefined) updates.name = assertString(payload.name, 'name', 80);
	if (payload.city !== undefined) {
		updates.city = payload.city == null ? null : assertString(payload.city, 'city', 80);
	}
	if (payload.tint !== undefined) updates.tint = assertHex(payload.tint, 'tint');
	if (payload.isPrimary !== undefined) updates.isPrimary = payload.isPrimary === true;
	if (Object.keys(updates).length === 1) badRequest('gym.update needs at least one field');

	await db
		.update(gym)
		.set(updates)
		.where(and(eq(gym.id, payload.id), eq(gym.userId, userId)));
	const row = (
		await db
			.select()
			.from(gym)
			.where(and(eq(gym.id, payload.id), eq(gym.userId, userId)))
			.limit(1)
	)[0];
	if (!row) notFound(`gym ${payload.id} not found`);
	return row;
}

async function gymDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	await assertGymOwned(payload.id, userId);
	const now = Date.now();
	await db
		.update(gym)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(and(eq(gym.id, payload.id), eq(gym.userId, userId)));
	return { id: payload.id, deletedAt: now };
}

async function equipmentCreate(
	payload: EquipmentCreate,
	userId: string
): Promise<{ equipment: Equipment; hiddenExercise?: Exercise }> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.gymId, 'gymId');
	await assertGymOwned(payload.gymId, userId);
	const name = assertString(payload.name, 'name', 80);
	const type = assertEnum(payload.type, 'type', EQUIPMENT_TYPES);
	const group = assertEnum(payload.group, 'group', MUSCLE_GROUPS);
	const glyph = payload.glyph ? assertString(payload.glyph, 'glyph', 20) : 'bench';
	const tint = payload.tint ? assertHex(payload.tint, 'tint') : '#1c2026';
	let cardioKind: string | null = null;
	if (type === 'cardio') {
		cardioKind = assertEnum(payload.cardioKind ?? 'generic', 'cardioKind', CARDIO_KINDS);
	}
	const sortOrder =
		typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)
			? payload.sortOrder
			: 0;
	const bodyweightPct =
		payload.bodyweightPct == null
			? null
			: assertBodyweightPct(payload.bodyweightPct, 'bodyweightPct');
	// inputMode falls back to a derivation when the client doesn't send it
	// (older clients, the smoke test). Cardio → distance_time; bodyweight pct
	// set → bodyweight; everything else → weighted.
	let inputMode: string;
	if (payload.inputMode != null) {
		inputMode = assertEnum(payload.inputMode, 'inputMode', INPUT_MODES);
	} else if (type === 'cardio') {
		inputMode = 'distance_time';
	} else if (bodyweightPct != null) {
		inputMode = 'bodyweight';
	} else {
		inputMode = 'weighted';
	}

	await db
		.insert(equipment)
		.values({
			id: payload.id,
			gymId: payload.gymId,
			name,
			type,
			group,
			glyph,
			tint,
			cardioKind,
			sortOrder,
			bodyweightPct,
			inputMode
		})
		.onConflictDoNothing();
	const row = (await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1))[0];
	if (!row) notFound(`equipment ${payload.id} not found after insert`);

	// Auto-create the hidden exercise for any station that doesn't host
	// user-named variants — i.e. cardio, bodyweight, timed, timed_weighted,
	// weight_distance, plus the legacy machine/cable types. Free-weight +
	// barbell weighted-reps stations get user-picked exercises via the
	// curated picker.
	let hiddenExercise: Exercise | undefined;
	const autoHide =
		type === 'machine' || type === 'cable' || type === 'cardio' || AUTO_HIDDEN_MODES.has(inputMode);
	if (autoHide) {
		const hiddenId = derivedExerciseId(payload.id);
		await db
			.insert(exercise)
			.values({
				id: hiddenId,
				equipmentId: payload.id,
				name,
				isHidden: true,
				sortOrder: 0
			})
			.onConflictDoNothing();
		hiddenExercise = (
			await db.select().from(exercise).where(eq(exercise.id, hiddenId)).limit(1)
		)[0];
	}

	return { equipment: row, hiddenExercise };
}

// Resolve an equipment row and assert it belongs to the caller (via the
// owning gym). Returns the row when authorised, throws notFound otherwise.
async function assertEquipmentOwned(equipmentId: string, userId: string): Promise<Equipment> {
	const row = (
		await db
			.select({
				id: equipment.id,
				gymId: equipment.gymId,
				name: equipment.name,
				type: equipment.type,
				group: equipment.group,
				glyph: equipment.glyph,
				tint: equipment.tint,
				photoPath: equipment.photoPath,
				cardioKind: equipment.cardioKind,
				sortOrder: equipment.sortOrder,
				notes: equipment.notes,
				bodyweightPct: equipment.bodyweightPct,
				createdAt: equipment.createdAt,
				updatedAt: equipment.updatedAt,
				deletedAt: equipment.deletedAt
			})
			.from(equipment)
			.innerJoin(gym, eq(gym.id, equipment.gymId))
			.where(and(eq(equipment.id, equipmentId), eq(gym.userId, userId), isNull(gym.deletedAt)))
			.limit(1)
	)[0] as Equipment | undefined;
	if (!row) notFound(`equipment ${equipmentId} not found`);
	return row;
}

// Resolve an exercise row and assert ownership transitively
// (exercise → equipment → gym → userId).
async function assertExerciseOwned(
	exerciseId: string,
	userId: string
): Promise<{ id: string; equipmentId: string }> {
	const row = (
		await db
			.select({ id: exercise.id, equipmentId: exercise.equipmentId })
			.from(exercise)
			.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
			.innerJoin(gym, eq(gym.id, equipment.gymId))
			.where(
				and(
					eq(exercise.id, exerciseId),
					eq(gym.userId, userId),
					isNull(exercise.deletedAt),
					isNull(equipment.deletedAt),
					isNull(gym.deletedAt)
				)
			)
			.limit(1)
	)[0];
	if (!row) notFound(`exercise ${exerciseId} not found`);
	return row;
}

async function equipmentUpdate(payload: EquipmentUpdate, userId: string): Promise<Equipment> {
	assertUlid(payload.id, 'id');

	const existing = await assertEquipmentOwned(payload.id, userId);

	const updates: Partial<Equipment> = { updatedAt: new Date() };
	let hasUserField = false;

	if (payload.name !== undefined) {
		updates.name = assertString(payload.name, 'name', 80);
		hasUserField = true;
	}
	if (payload.type !== undefined) {
		updates.type = assertEnum(payload.type, 'type', EQUIPMENT_TYPES);
		hasUserField = true;
	}
	if (payload.group !== undefined) {
		updates.group = assertEnum(payload.group, 'group', MUSCLE_GROUPS);
		hasUserField = true;
	}
	if (payload.glyph !== undefined) {
		updates.glyph = assertString(payload.glyph, 'glyph', 20);
		hasUserField = true;
	}
	if (payload.tint !== undefined) {
		updates.tint = assertHex(payload.tint, 'tint');
		hasUserField = true;
	}
	if (payload.cardioKind !== undefined) {
		updates.cardioKind =
			payload.cardioKind == null
				? null
				: assertEnum(payload.cardioKind, 'cardioKind', CARDIO_KINDS);
		hasUserField = true;
	}
	if (typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)) {
		updates.sortOrder = payload.sortOrder;
		hasUserField = true;
	}
	if (payload.notes !== undefined) {
		if (payload.notes === null) {
			updates.notes = null;
		} else if (typeof payload.notes === 'string') {
			// Trim trailing whitespace; reject (don't silently truncate) when
			// the textarea's maxlength was bypassed by a non-UI client.
			const trimmed = payload.notes.replace(/\s+$/, '');
			if (trimmed.length > 4000) badRequest('notes must be at most 4000 characters');
			updates.notes = trimmed.length === 0 ? null : trimmed;
		} else {
			badRequest('notes must be a string or null');
		}
		hasUserField = true;
	}
	if (payload.bodyweightPct !== undefined) {
		updates.bodyweightPct =
			payload.bodyweightPct === null
				? null
				: assertBodyweightPct(payload.bodyweightPct, 'bodyweightPct');
		hasUserField = true;
	}
	if (payload.inputMode !== undefined) {
		updates.inputMode = assertEnum(payload.inputMode, 'inputMode', INPUT_MODES);
		hasUserField = true;
	}

	if (!hasUserField) badRequest('equipment.update needs at least one field');

	// Invariant: cardioKind is non-null iff type === 'cardio'. Compute the
	// post-update type and reconcile cardioKind regardless of whether the
	// caller sent it. This protects every client (current UI, future UIs,
	// hand-crafted curl) from creating an inconsistent row.
	const finalType = updates.type ?? existing.type;
	if (finalType === 'cardio') {
		const finalCardioKind =
			updates.cardioKind !== undefined ? updates.cardioKind : existing.cardioKind;
		if (finalCardioKind == null) updates.cardioKind = 'generic';
	} else {
		// Non-cardio types must not carry a cardioKind. Force-clear it.
		if (existing.cardioKind != null || updates.cardioKind != null) {
			updates.cardioKind = null;
		}
	}

	await db.update(equipment).set(updates).where(eq(equipment.id, payload.id));

	// If the equipment got renamed and it has an auto-hidden exercise, sync
	// the exercise name so logging UI labels stay consistent.
	if (updates.name !== undefined) {
		const hiddenId = derivedExerciseId(payload.id);
		await db
			.update(exercise)
			.set({ name: updates.name, updatedAt: new Date() })
			.where(and(eq(exercise.id, hiddenId), eq(exercise.isHidden, true)));
	}

	const row = (await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1))[0];
	if (!row) notFound(`equipment ${payload.id} not found`);
	return row;
}

async function equipmentDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	await assertEquipmentOwned(payload.id, userId);
	const now = Date.now();
	// Atomic: if the cascade fails, the equipment row stays live too. Otherwise
	// a crash mid-cascade leaves orphaned exercises that join cleanly through
	// to a tombstoned equipment. Sync body required by better-sqlite3 12.x.
	db.transaction((tx) => {
		tx.update(equipment)
			.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
			.where(eq(equipment.id, payload.id))
			.run();
		tx.update(exercise)
			.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
			.where(eq(exercise.equipmentId, payload.id))
			.run();
	});
	return { id: payload.id, deletedAt: now };
}

async function exerciseCreate(payload: ExerciseCreate, userId: string): Promise<Exercise> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.equipmentId, 'equipmentId');
	await assertEquipmentOwned(payload.equipmentId, userId);
	const name = assertString(payload.name, 'name', 80);
	const isHidden = payload.isHidden === true;
	const sortOrder =
		typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)
			? payload.sortOrder
			: 0;

	await db
		.insert(exercise)
		.values({ id: payload.id, equipmentId: payload.equipmentId, name, isHidden, sortOrder })
		.onConflictDoNothing();
	const row = (await db.select().from(exercise).where(eq(exercise.id, payload.id)).limit(1))[0];
	if (!row) notFound(`exercise ${payload.id} not found after insert`);
	return row;
}

async function exerciseUpdate(payload: ExerciseUpdate, userId: string): Promise<Exercise> {
	assertUlid(payload.id, 'id');
	await assertExerciseOwned(payload.id, userId);
	const updates: Partial<Exercise> = { updatedAt: new Date() };
	if (payload.name !== undefined) updates.name = assertString(payload.name, 'name', 80);
	if (typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)) {
		updates.sortOrder = payload.sortOrder;
	}
	if (Object.keys(updates).length === 1) badRequest('exercise.update needs at least one field');

	await db.update(exercise).set(updates).where(eq(exercise.id, payload.id));
	const row = (await db.select().from(exercise).where(eq(exercise.id, payload.id)).limit(1))[0];
	if (!row) notFound(`exercise ${payload.id} not found`);
	return row;
}

async function exerciseDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	await assertExerciseOwned(payload.id, userId);
	const now = Date.now();
	await db
		.update(exercise)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(eq(exercise.id, payload.id));
	return { id: payload.id, deletedAt: now };
}

// ─── set handlers (with implicit session boundary) ─────────────────────

const SESSION_EXTEND_MS = 90 * 60 * 1000;
// Outer bound for an empty (zero-set) manually started session to attach
// the next live set. Beyond this, the empty session is closed as a
// 0-duration row and a fresh implicit session is created. Mirrors the
// home-loader auto-close window for non-empty sessions.
const EMPTY_SESSION_ATTACH_MS = 6 * 60 * 60 * 1000;

// Type of the callback parameter that `db.transaction()` provides. Lets us
// pass either the top-level db or an inflight transaction to resolveSession,
// whichever the caller has, without depending on the deeper drizzle generic
// types directly.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Sync because better-sqlite3 12.x rejects async transaction bodies
// ("Transaction function cannot return a promise"). Drizzle's better-sqlite3
// driver runs queries synchronously; we use `.get()`/`.run()` to execute
// without going through the async wrapper.
function resolveSession(
	tx: Tx,
	userId: string,
	gymId: string,
	tsMs: number
): { sessionId: string; isNew: boolean; isBackdated: boolean } {
	// A set is "live" when its ts is within one extension window of now.
	// Anything older is a backdated entry and must not touch the user's
	// current open session — that's the whole reason this branch exists.
	const isLive = Math.abs(Date.now() - tsMs) <= SESSION_EXTEND_MS;

	if (isLive) {
		// Look at the user's most recent open session.
		const open = tx
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, userId), isNull(workoutSession.endedAt)))
			.orderBy(desc(workoutSession.startedAt))
			.limit(1)
			.get() as WorkoutSession | undefined;

		if (open) {
			const lastSet = tx
				.select({ ts: setTable.ts })
				.from(setTable)
				.where(and(eq(setTable.workoutSessionId, open.id), isNull(setTable.deletedAt)))
				.orderBy(desc(setTable.ts))
				.limit(1)
				.get() as { ts: Date } | undefined;

			if (!lastSet) {
				// Empty open session — typically a manual start before any sets,
				// or one whose sets were all soft-deleted. Attach unconditionally
				// when the new set's ts is within EMPTY_SESSION_ATTACH_MS of the
				// session's startedAt. Past that window, the empty session is
				// stale (user walked away and never logged); close as 0-duration
				// and fall through to a fresh session.
				const startedAtMs = open.startedAt.getTime();
				const delta = tsMs - startedAtMs;
				if (delta >= 0 && delta <= EMPTY_SESSION_ATTACH_MS) {
					return { sessionId: open.id, isNew: false, isBackdated: false };
				}
				tx.update(workoutSession)
					.set({ endedAt: open.startedAt, updatedAt: new Date() })
					.where(eq(workoutSession.id, open.id))
					.run();
			} else {
				const lastTs = lastSet.ts.getTime();
				const shouldExtend = tsMs - lastTs <= SESSION_EXTEND_MS && tsMs - lastTs >= 0;
				if (shouldExtend) {
					return { sessionId: open.id, isNew: false, isBackdated: false };
				}
				// Close the stale open session. endedAt pinned to last activity
				// (not the new set's tsMs) — gap is downtime, not workout time.
				tx.update(workoutSession)
					.set({ endedAt: new Date(lastTs), updatedAt: new Date() })
					.where(eq(workoutSession.id, open.id))
					.run();
				// Auto-close counts as a session.ended trigger; non-empty
				// sessions can earn duration/density-based achievements here.
				evaluateAchievements(tx, userId, 'session.ended', { sessionId: open.id });
			}
		}

		const sessionId = newUlid();
		tx.insert(workoutSession)
			.values({
				id: sessionId,
				userId,
				gymId,
				startedAt: new Date(tsMs)
			})
			.run();
		return { sessionId, isNew: true, isBackdated: false };
	}

	// Backdated path: scope by the calendar day of tsMs (UTC). Append to an
	// existing same-day session for this user+gym if one exists; otherwise
	// create a fresh closed session. Critically, never touch the user's
	// live open session for today.
	const dayStart = startOfUtcDay(tsMs);
	const dayEnd = dayStart + 86_400_000;

	const candidate = tx
		.select()
		.from(workoutSession)
		.where(
			and(
				eq(workoutSession.userId, userId),
				eq(workoutSession.gymId, gymId),
				gte(workoutSession.startedAt, new Date(dayStart)),
				lt(workoutSession.startedAt, new Date(dayEnd))
			)
		)
		.orderBy(asc(workoutSession.startedAt))
		.limit(1)
		.get() as WorkoutSession | undefined;

	if (candidate) {
		// If the new set predates the current startedAt, push the start
		// back. endedAt is recomputed by the caller after the set inserts.
		if (tsMs < candidate.startedAt.getTime()) {
			tx.update(workoutSession)
				.set({ startedAt: new Date(tsMs), updatedAt: new Date() })
				.where(eq(workoutSession.id, candidate.id))
				.run();
		}
		return { sessionId: candidate.id, isNew: false, isBackdated: true };
	}

	const sessionId = newUlid();
	tx.insert(workoutSession)
		.values({
			id: sessionId,
			userId,
			gymId,
			startedAt: new Date(tsMs),
			// Provisional close at tsMs; the caller's MAX(set.ts) update keeps
			// this honest if more sets later land in this same session.
			endedAt: new Date(tsMs)
		})
		.run();
	return { sessionId, isNew: true, isBackdated: true };
}

// Returns true when the about-to-insert set strictly beats the user's
// prior best for the same exercise. The PR axis depends on the equipment's
// inputMode:
//
//   weighted, bodyweight       → MAX(weight + extras.bwLoadKg)
//   distance_time              → MAX(extras.distance)
//   timed                      → MAX(durationMin)
//   timed_weighted             → MAX(weight)   (any duration counts)
//   weight_distance            → MAX(weight)   (any distance counts)
//
// First-ever qualifying set is also a PR. Sets with no measurable axis
// (e.g. zero or null on the relevant column) never PR. The strength axis
// uses *effective load* (weight + bwLoadKg snapshot) so a heavier user or
// larger bodyweight pct can lock in a higher PR than added weight alone.
async function evaluatePr(
	userId: string,
	exerciseId: string,
	inputMode: string,
	weight: number | null,
	durationMin: number | null,
	extras: Record<string, number> | null
): Promise<boolean> {
	if (inputMode === 'distance_time') {
		const distance = extras?.distance;
		if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
			return false;
		}
		const row = (
			await db
				.select({ max: sql<number | null>`MAX(json_extract(${setTable.extras}, '$.distance'))` })
				.from(setTable)
				.where(
					and(
						eq(setTable.userId, userId),
						eq(setTable.exerciseId, exerciseId),
						isNull(setTable.deletedAt)
					)
				)
		)[0];
		const prior = row?.max ?? null;
		return prior == null || distance > prior;
	}
	if (inputMode === 'timed') {
		if (typeof durationMin !== 'number' || !Number.isFinite(durationMin) || durationMin <= 0) {
			return false;
		}
		const row = (
			await db
				.select({ max: sql<number | null>`MAX(${setTable.durationMin})` })
				.from(setTable)
				.where(
					and(
						eq(setTable.userId, userId),
						eq(setTable.exerciseId, exerciseId),
						isNull(setTable.deletedAt)
					)
				)
		)[0];
		const prior = row?.max ?? null;
		return prior == null || durationMin > prior;
	}
	// All remaining modes (weighted, bodyweight, timed_weighted,
	// weight_distance) PR on weight (effective load for bodyweight).
	if (typeof weight !== 'number' || !Number.isFinite(weight)) {
		return false;
	}
	const bwLoad =
		typeof extras?.bwLoadKg === 'number' && Number.isFinite(extras.bwLoadKg) ? extras.bwLoadKg : 0;
	const effective = weight + bwLoad;
	if (effective <= 0) return false;
	const row = (
		await db
			.select({
				max: sql<number | null>`MAX(
					COALESCE(${setTable.weight}, 0)
					+ COALESCE(json_extract(${setTable.extras}, '$.bwLoadKg'), 0)
				)`
			})
			.from(setTable)
			.where(
				and(
					eq(setTable.userId, userId),
					eq(setTable.exerciseId, exerciseId),
					isNull(setTable.deletedAt)
				)
			)
	)[0];
	const prior = row?.max ?? null;
	return prior == null || effective > prior;
}

async function setCreate(
	payload: SetCreate,
	userId: string
): Promise<{ set: SetRow; sessionId: string; sessionIsNew: boolean }> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.exerciseId, 'exerciseId');

	// Resolve exercise → equipment → gym so the session attaches to the
	// right gym (per D4 trade-off #3 — session.gymId is captured on the
	// first set, immutable after). The join asserts ownership: a set
	// referencing another user's exercise resolves to no row and 404s.
	const ex = (
		await db
			.select({
				id: exercise.id,
				equipmentId: exercise.equipmentId,
				gymId: equipment.gymId,
				type: equipment.type,
				bodyweightPct: equipment.bodyweightPct,
				inputMode: equipment.inputMode
			})
			.from(exercise)
			.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
			.innerJoin(gym, eq(gym.id, equipment.gymId))
			.where(
				and(
					eq(exercise.id, payload.exerciseId),
					eq(gym.userId, userId),
					isNull(exercise.deletedAt),
					isNull(equipment.deletedAt),
					isNull(gym.deletedAt)
				)
			)
			.limit(1)
	)[0];
	if (!ex) notFound(`exercise ${payload.exerciseId} not found`);
	const eqRow = {
		id: ex.equipmentId,
		gymId: ex.gymId,
		type: ex.type,
		bodyweightPct: ex.bodyweightPct,
		inputMode: ex.inputMode
	};

	const ts =
		typeof payload.ts === 'number' && Number.isFinite(payload.ts) && payload.ts > 0
			? payload.ts
			: Date.now();

	// Reject future timestamps. Sets logged "tomorrow" can't represent a
	// workout that hasn't happened yet, and they'd corrupt the heatmap.
	if (ts > Date.now() + 60_000) badRequest('ts must not be in the future');

	let weight: number | null = null;
	let reps: number | null = null;
	let durationMin: number | null = null;
	let extras: Record<string, number> | null = null;

	const mode = eqRow.inputMode;

	// Per-mode validation. Each branch lists which set columns are required
	// vs forbidden, and which extras keys (if any) are accepted. The general
	// shape is mirrored in $lib/input-modes.MODE_SHAPE on the client.
	if (mode === 'distance_time') {
		if (typeof payload.durationMin !== 'number' || payload.durationMin <= 0) {
			badRequest('cardio set requires positive durationMin');
		}
		durationMin = payload.durationMin;
		if (payload.extras != null) {
			if (typeof payload.extras !== 'object' || Array.isArray(payload.extras)) {
				badRequest('extras must be an object of numbers');
			}
			const cleaned: Record<string, number> = {};
			for (const [k, v] of Object.entries(payload.extras)) {
				if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = v;
			}
			extras = Object.keys(cleaned).length > 0 ? cleaned : null;
		}
	} else if (mode === 'timed') {
		if (typeof payload.durationMin !== 'number' || payload.durationMin <= 0) {
			badRequest('timed set requires positive durationMin');
		}
		if (payload.weight != null && payload.weight !== 0) {
			badRequest('timed set must not include weight (use timed_weighted for loaded holds)');
		}
		if (payload.reps != null) badRequest('timed set must not include reps');
		durationMin = payload.durationMin;
		// extras intentionally not allowed for plain timed holds.
		if (payload.extras != null && Object.keys(payload.extras).length > 0) {
			badRequest('timed set does not accept extras');
		}
	} else if (mode === 'timed_weighted') {
		if (typeof payload.durationMin !== 'number' || payload.durationMin <= 0) {
			badRequest('timed_weighted set requires positive durationMin');
		}
		if (typeof payload.weight !== 'number' || !Number.isFinite(payload.weight)) {
			badRequest('timed_weighted set requires numeric weight');
		}
		if (payload.weight < 0) badRequest('timed_weighted set requires non-negative weight');
		if (payload.reps != null) badRequest('timed_weighted set must not include reps');
		weight = payload.weight;
		durationMin = payload.durationMin;
		if (payload.extras != null && Object.keys(payload.extras).length > 0) {
			badRequest('timed_weighted set does not accept extras');
		}
	} else if (mode === 'weight_distance') {
		if (typeof payload.weight !== 'number' || !Number.isFinite(payload.weight)) {
			badRequest('weight_distance set requires numeric weight');
		}
		if (payload.weight < 0) badRequest('weight_distance set requires non-negative weight');
		if (payload.reps != null) badRequest('weight_distance set must not include reps');
		if (payload.durationMin != null) {
			badRequest('weight_distance set must not include durationMin');
		}
		if (
			payload.extras == null ||
			typeof payload.extras !== 'object' ||
			Array.isArray(payload.extras)
		) {
			badRequest('weight_distance set requires extras.distance');
		}
		const dist = (payload.extras as Record<string, unknown>).distance;
		if (typeof dist !== 'number' || !Number.isFinite(dist) || dist <= 0) {
			badRequest('weight_distance set requires positive extras.distance');
		}
		const cleaned: Record<string, number> = { distance: dist };
		// Reject any other key so users don't smuggle cardio extras through.
		for (const k of Object.keys(payload.extras)) {
			if (k !== 'distance') badRequest(`unknown extras key for weight_distance set: ${k}`);
		}
		weight = payload.weight;
		extras = cleaned;
	} else {
		// weighted | bodyweight (the legacy strength path).
		if (typeof payload.weight !== 'number') {
			badRequest('strength set requires numeric weight');
		}
		if (typeof payload.reps !== 'number' || !Number.isInteger(payload.reps) || payload.reps < 0) {
			badRequest('strength set requires non-negative integer reps');
		}
		// Bodyweight equipment lets `weight` go negative for assisted reps
		// (e.g. band-assisted pull-ups) since the stored value is *added*
		// load, not absolute load. Non-bodyweight stays non-negative.
		if (eqRow.bodyweightPct == null && payload.weight < 0) {
			badRequest('strength set requires non-negative weight');
		}
		weight = payload.weight;
		reps = payload.reps;
		// Bodyweight snapshot in `extras`: bwLoadKg (effective contribution),
		// bwKg (user's BW at log time), bwPct (equipment %). Stored once and
		// never re-derived so historical effective load doesn't drift if the
		// user updates either input later. Allowed only on bodyweight rigs;
		// rejected as junk fields anywhere else.
		if (payload.extras != null) {
			if (typeof payload.extras !== 'object' || Array.isArray(payload.extras)) {
				badRequest('extras must be an object of numbers');
			}
			if (eqRow.bodyweightPct == null) {
				badRequest('extras only allowed on bodyweight equipment for strength sets');
			}
			const cleaned: Record<string, number> = {};
			for (const [k, v] of Object.entries(payload.extras)) {
				if (k !== 'bwLoadKg' && k !== 'bwKg' && k !== 'bwPct') {
					badRequest(`unknown extras key for strength set: ${k}`);
				}
				if (typeof v !== 'number' || !Number.isFinite(v)) {
					badRequest(`extras.${k} must be a finite number`);
				}
				cleaned[k] = v;
			}
			extras = Object.keys(cleaned).length > 0 ? cleaned : null;
		}
	}

	// PR evaluation per inputMode. Strict greater-than only — ties don't
	// count. Computed inside the transaction below so a concurrent set.create
	// from the same user can't both see the same prior max and both flag PR.
	const isPr = await evaluatePr(userId, payload.exerciseId, mode, weight, durationMin, extras);

	// Resolve session + insert the set in one transaction. Two concurrent
	// set.create calls from the same user (e.g. queue drain firing twice)
	// would otherwise each see "no open session" and create duplicates.
	// SQLite WAL serialises BEGIN IMMEDIATE writers, so the second caller
	// blocks until the first commits and then sees the open session.
	// Sync body required by better-sqlite3 12.x.
	const { session, row } = db.transaction((tx) => {
		const session = resolveSession(tx, userId, eqRow.gymId, ts);
		tx.insert(setTable)
			.values({
				id: payload.id,
				userId,
				workoutSessionId: session.sessionId,
				exerciseId: payload.exerciseId,
				weight,
				reps,
				durationMin,
				extras,
				isPr,
				ts: new Date(ts)
			})
			.onConflictDoNothing()
			.run();
		const row = tx.select().from(setTable).where(eq(setTable.id, payload.id)).limit(1).get() as
			| SetRow
			| undefined;
		if (!row) notFound(`set ${payload.id} not found after insert`);

		// Backdated sessions stay closed; pin endedAt to the latest set ts
		// so History/Stats see a coherent (startedAt..endedAt) range no
		// matter what order sets arrive in.
		if (session.isBackdated) {
			const latest = tx
				.select({ ts: setTable.ts })
				.from(setTable)
				.where(and(eq(setTable.workoutSessionId, session.sessionId), isNull(setTable.deletedAt)))
				.orderBy(desc(setTable.ts))
				.limit(1)
				.get() as { ts: Date } | undefined;
			if (latest) {
				tx.update(workoutSession)
					.set({ endedAt: latest.ts, updatedAt: new Date() })
					.where(eq(workoutSession.id, session.sessionId))
					.run();
			}
		}

		// Evaluate achievement predicates against the just-inserted set.
		// Runs in the same transaction so awards roll back together with
		// the set if the parent insert later throws.
		evaluateAchievements(tx, userId, 'set.created', {
			setId: payload.id,
			sessionId: session.sessionId
		});

		return { session, row };
	});

	return { set: row, sessionId: session.sessionId, sessionIsNew: session.isNew };
}

async function setUpdate(payload: SetUpdate, userId: string): Promise<SetRow> {
	assertUlid(payload.id, 'id');

	const updates: Partial<SetRow> = { updatedAt: new Date() };
	if (payload.weight !== undefined) {
		if (
			payload.weight !== null &&
			(typeof payload.weight !== 'number' || !Number.isFinite(payload.weight))
		) {
			badRequest('weight must be a finite number or null');
		}
		// Resolve the set's equipment to know if negative weights (assisted
		// bodyweight) are legal here. Cheap join — already gated by ownership.
		if (typeof payload.weight === 'number' && payload.weight < 0) {
			const ctx = (
				await db
					.select({ bodyweightPct: equipment.bodyweightPct })
					.from(setTable)
					.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
					.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
					.where(and(eq(setTable.id, payload.id), eq(setTable.userId, userId)))
					.limit(1)
			)[0];
			if (!ctx || ctx.bodyweightPct == null) {
				badRequest('weight must be non-negative on non-bodyweight equipment');
			}
		}
		updates.weight = payload.weight;
	}
	if (payload.reps !== undefined) {
		if (
			payload.reps !== null &&
			(typeof payload.reps !== 'number' || !Number.isInteger(payload.reps) || payload.reps < 0)
		) {
			badRequest('reps must be a non-negative integer or null');
		}
		updates.reps = payload.reps;
	}
	if (payload.durationMin !== undefined) {
		if (
			payload.durationMin !== null &&
			(typeof payload.durationMin !== 'number' || payload.durationMin < 0)
		) {
			badRequest('durationMin must be a non-negative number or null');
		}
		updates.durationMin = payload.durationMin;
	}
	if (payload.extras !== undefined) {
		if (payload.extras === null) {
			updates.extras = null;
		} else if (typeof payload.extras === 'object' && !Array.isArray(payload.extras)) {
			const cleaned: Record<string, number> = {};
			for (const [k, v] of Object.entries(payload.extras)) {
				if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = v;
			}
			updates.extras = Object.keys(cleaned).length > 0 ? cleaned : null;
		} else {
			badRequest('extras must be an object or null');
		}
	}

	if (Object.keys(updates).length === 1) badRequest('set.update needs at least one field');

	// All three predicates matter: id (target row), userId (tenancy), and
	// deletedAt IS NULL (don't resurrect a tombstoned set). Without the
	// deletedAt filter, a "delete then edit" race could write fields onto a
	// soft-deleted row that History/Stats already hide but which still
	// counts toward MAX(weight) PR comparisons.
	await db
		.update(setTable)
		.set(updates)
		.where(
			and(eq(setTable.id, payload.id), eq(setTable.userId, userId), isNull(setTable.deletedAt))
		);

	// SELECT mirrors the same predicates — a set that's missing, owned by
	// someone else, or already deleted should all 404 the same way so the
	// caller can't infer existence from the error code.
	const row = (
		await db
			.select()
			.from(setTable)
			.where(
				and(eq(setTable.id, payload.id), eq(setTable.userId, userId), isNull(setTable.deletedAt))
			)
			.limit(1)
	)[0];
	if (!row) notFound(`set ${payload.id} not found`);
	return row;
}

async function setDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	// Confirm the row exists and belongs to the caller before tombstoning.
	// Without this, a misrouted client (wrong id, or another user's set)
	// silently no-ops and never learns the request was bogus. Aligns this
	// handler with gymDelete / equipmentDelete / exerciseDelete which all
	// assert ownership first.
	const existing = (
		await db
			.select({ id: setTable.id })
			.from(setTable)
			.where(
				and(eq(setTable.id, payload.id), eq(setTable.userId, userId), isNull(setTable.deletedAt))
			)
			.limit(1)
	)[0];
	if (!existing) notFound(`set ${payload.id} not found`);

	const now = Date.now();
	await db
		.update(setTable)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(and(eq(setTable.id, payload.id), eq(setTable.userId, userId)));
	return { id: payload.id, deletedAt: now };
}

// ─── session handlers (manual start/end) ──────────────────────────────

async function sessionStart(payload: SessionStart, userId: string): Promise<WorkoutSession> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.gymId, 'gymId');

	await assertGymOwned(payload.gymId, userId);

	const startedAt =
		typeof payload.startedAt === 'number' &&
		Number.isFinite(payload.startedAt) &&
		payload.startedAt > 0
			? payload.startedAt
			: Date.now();
	if (startedAt > Date.now() + 60_000) badRequest('startedAt must not be in the future');

	// Idempotent posture: if the user already has an open session, return
	// it and do not create a duplicate. The Start pill is gated on "no
	// active session" client-side; this is the server-side belt-and-braces.
	const existing = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, userId), isNull(workoutSession.endedAt)))
			.orderBy(desc(workoutSession.startedAt))
			.limit(1)
	)[0] as WorkoutSession | undefined;
	if (existing) return existing;

	await db
		.insert(workoutSession)
		.values({
			id: payload.id,
			userId,
			gymId: payload.gymId,
			startedAt: new Date(startedAt)
		})
		.onConflictDoNothing();
	const row = (
		await db.select().from(workoutSession).where(eq(workoutSession.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`session ${payload.id} not found after insert`);
	return row;
}

async function sessionEnd(payload: { id: string }, userId: string): Promise<WorkoutSession> {
	assertUlid(payload.id, 'id');
	const target = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.id, payload.id), eq(workoutSession.userId, userId)))
			.limit(1)
	)[0] as WorkoutSession | undefined;
	if (!target) notFound(`session ${payload.id} not found`);
	if (target.endedAt != null) return target;

	// Wrap the close + achievement evaluation in a single sync transaction
	// so the evaluator's awards roll back if the update fails. Sync body
	// required by better-sqlite3 12.x.
	const row = db.transaction((tx) => {
		const now = new Date();
		tx.update(workoutSession)
			.set({ endedAt: now, updatedAt: now })
			.where(eq(workoutSession.id, payload.id))
			.run();
		evaluateAchievements(tx, userId, 'session.ended', { sessionId: payload.id });
		const fresh = tx
			.select()
			.from(workoutSession)
			.where(eq(workoutSession.id, payload.id))
			.limit(1)
			.get() as WorkoutSession | undefined;
		if (!fresh) notFound(`session ${payload.id} not found after end`);
		return fresh;
	});
	return row;
}

async function sessionEndUndo(payload: { id: string }, userId: string): Promise<WorkoutSession> {
	assertUlid(payload.id, 'id');
	const target = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.id, payload.id), eq(workoutSession.userId, userId)))
			.limit(1)
	)[0] as WorkoutSession | undefined;
	if (!target) notFound(`session ${payload.id} not found`);
	if (target.endedAt == null) return target;

	// Refuse if a newer session has been created on top of this one — the
	// 10 s undo toast prevents this client-side, but a stale replay could
	// otherwise reopen a session while another is already open.
	const newer = (
		await db
			.select({ id: workoutSession.id })
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, userId), gt(workoutSession.startedAt, target.startedAt)))
			.limit(1)
	)[0];
	if (newer) badRequest('cannot undo: a newer session exists');

	await db
		.update(workoutSession)
		.set({ endedAt: null, updatedAt: new Date() })
		.where(eq(workoutSession.id, payload.id));
	const row = (
		await db.select().from(workoutSession).where(eq(workoutSession.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`session ${payload.id} not found after undo`);
	return row;
}

async function sessionDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deleted: true }> {
	assertUlid(payload.id, 'id');
	const target = (
		await db
			.select({ id: workoutSession.id })
			.from(workoutSession)
			.where(and(eq(workoutSession.id, payload.id), eq(workoutSession.userId, userId)))
			.limit(1)
	)[0];
	if (!target) notFound(`session ${payload.id} not found`);

	const anySet = (
		await db
			.select({ id: setTable.id })
			.from(setTable)
			.where(and(eq(setTable.workoutSessionId, payload.id), isNull(setTable.deletedAt)))
			.limit(1)
	)[0];
	if (anySet) badRequest('cannot delete a session with sets');

	await db.delete(workoutSession).where(eq(workoutSession.id, payload.id));
	return { id: payload.id, deleted: true };
}

// Derived ID for the auto-hidden exercise on machines/cables/cardio.
// Encodes the equipment ID so the hidden exercise has a deterministic
// PK (still ULID-shaped) and rename cascades stay simple.
function derivedExerciseId(equipmentId: string): string {
	// Replace the last char with 'X' to namespace it within ULID space.
	return equipmentId.slice(0, 25) + 'X';
}

// ─── public entry ───────────────────────────────────────────────────────

export async function applyMutation(
	envelope: MutationEnvelope,
	userId: string
): Promise<{ replayed: boolean; result: unknown }> {
	if (!isUlid(envelope.mutationId)) badRequest('mutationId must be a ULID');
	if (!isUlid(envelope.clientId)) badRequest('clientId must be a ULID');
	if (typeof envelope.op !== 'string') badRequest('op required');
	if (envelope.payload == null || typeof envelope.payload !== 'object')
		badRequest('payload required');

	// Idempotency: if (clientId, mutationId) already applied, no-op.
	// We don't cache the response payload — clients are expected to refetch
	// canonical state after a replay. Simpler than maintaining a result store.
	const fresh = logMutation(envelope.clientId, envelope.mutationId, userId);
	if (!fresh) {
		return { replayed: true, result: null };
	}

	const op = envelope.op as MutationOp['op'];
	const payload = envelope.payload as never;
	switch (op) {
		case 'gym.create':
			return { replayed: false, result: await gymCreate(payload, userId) };
		case 'gym.update':
			return { replayed: false, result: await gymUpdate(payload, userId) };
		case 'gym.delete':
			return { replayed: false, result: await gymDelete(payload, userId) };
		case 'equipment.create':
			return { replayed: false, result: await equipmentCreate(payload, userId) };
		case 'equipment.update':
			return { replayed: false, result: await equipmentUpdate(payload, userId) };
		case 'equipment.delete':
			return { replayed: false, result: await equipmentDelete(payload, userId) };
		case 'exercise.create':
			return { replayed: false, result: await exerciseCreate(payload, userId) };
		case 'exercise.update':
			return { replayed: false, result: await exerciseUpdate(payload, userId) };
		case 'exercise.delete':
			return { replayed: false, result: await exerciseDelete(payload, userId) };
		case 'set.create':
			return { replayed: false, result: await setCreate(payload, userId) };
		case 'set.update':
			return { replayed: false, result: await setUpdate(payload, userId) };
		case 'set.delete':
			return { replayed: false, result: await setDelete(payload, userId) };
		case 'session.start':
			return { replayed: false, result: await sessionStart(payload, userId) };
		case 'session.end':
			return { replayed: false, result: await sessionEnd(payload, userId) };
		case 'session.endUndo':
			return { replayed: false, result: await sessionEndUndo(payload, userId) };
		case 'session.delete':
			return { replayed: false, result: await sessionDelete(payload, userId) };
		case 'user.update':
			return { replayed: false, result: await userUpdate(payload, userId) };
		default:
			badRequest(`unknown op: ${op}`);
	}
}

export { derivedExerciseId };
