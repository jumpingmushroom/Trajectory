// Mutation router. Every write to Trajectory's domain tables flows
// through here so the offline-first sync layer (M10) has a single
// idempotent contract to replay against. Each mutation is identified
// by (clientId, mutationId); replays are no-ops thanks to the
// mutation_log composite primary key.
//
// ULIDs in payloads are minted client-side (per DECISIONS D4). The
// server validates their format on every call.

import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from './db';
import {
	gym,
	equipment,
	exercise,
	workoutSession,
	set as setTable,
	type Gym,
	type Equipment,
	type Exercise,
	type Set as SetRow,
	type WorkoutSession
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
	| { op: 'set.delete'; payload: { id: string } };

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
interface SetUpdate {
	id: string;
	weight?: number | null;
	reps?: number | null;
	durationMin?: number | null;
	extras?: Record<string, number> | null;
}

const EQUIPMENT_TYPES = new Set(['barbell', 'machine', 'cable', 'freeweight', 'cardio']);
const MUSCLE_GROUPS = new Set(['push', 'pull', 'legs', 'cardio']);
const CARDIO_KINDS = new Set(['treadmill', 'bike', 'rower', 'generic']);
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

async function gymCreate(payload: GymCreate): Promise<Gym> {
	assertUlid(payload.id, 'id');
	const name = assertString(payload.name, 'name', 80);
	const city = payload.city == null ? null : assertString(payload.city, 'city', 80);
	const tint = payload.tint ? assertHex(payload.tint, 'tint') : '#1c2026';
	const isPrimary = payload.isPrimary === true;

	await db
		.insert(gym)
		.values({ id: payload.id, name, city, tint, isPrimary })
		.onConflictDoNothing();
	const row = (await db.select().from(gym).where(eq(gym.id, payload.id)).limit(1))[0];
	if (!row) notFound(`gym ${payload.id} not found after insert`);
	return row;
}

async function gymUpdate(payload: GymUpdate): Promise<Gym> {
	assertUlid(payload.id, 'id');
	const updates: Partial<Gym> = { updatedAt: new Date() };
	if (payload.name !== undefined) updates.name = assertString(payload.name, 'name', 80);
	if (payload.city !== undefined) {
		updates.city = payload.city == null ? null : assertString(payload.city, 'city', 80);
	}
	if (payload.tint !== undefined) updates.tint = assertHex(payload.tint, 'tint');
	if (payload.isPrimary !== undefined) updates.isPrimary = payload.isPrimary === true;
	if (Object.keys(updates).length === 1) badRequest('gym.update needs at least one field');

	await db.update(gym).set(updates).where(eq(gym.id, payload.id));
	const row = (await db.select().from(gym).where(eq(gym.id, payload.id)).limit(1))[0];
	if (!row) notFound(`gym ${payload.id} not found`);
	return row;
}

async function gymDelete(payload: { id: string }): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	const now = Date.now();
	await db
		.update(gym)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(eq(gym.id, payload.id));
	return { id: payload.id, deletedAt: now };
}

async function equipmentCreate(payload: EquipmentCreate): Promise<{ equipment: Equipment; hiddenExercise?: Exercise }> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.gymId, 'gymId');
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
			sortOrder
		})
		.onConflictDoNothing();
	const row = (
		await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`equipment ${payload.id} not found after insert`);

	// Auto-create the hidden exercise for machines/cables/cardio so all sets
	// always FK to an exercise. Free-weight + barbell stations get exercises
	// added explicitly by the user via the curated picker.
	let hiddenExercise: Exercise | undefined;
	if (type === 'machine' || type === 'cable' || type === 'cardio') {
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

async function equipmentUpdate(payload: EquipmentUpdate): Promise<Equipment> {
	assertUlid(payload.id, 'id');
	const updates: Partial<Equipment> = { updatedAt: new Date() };
	if (payload.name !== undefined) updates.name = assertString(payload.name, 'name', 80);
	if (payload.type !== undefined) updates.type = assertEnum(payload.type, 'type', EQUIPMENT_TYPES);
	if (payload.group !== undefined)
		updates.group = assertEnum(payload.group, 'group', MUSCLE_GROUPS);
	if (payload.glyph !== undefined) updates.glyph = assertString(payload.glyph, 'glyph', 20);
	if (payload.tint !== undefined) updates.tint = assertHex(payload.tint, 'tint');
	if (payload.cardioKind !== undefined) {
		updates.cardioKind =
			payload.cardioKind == null
				? null
				: assertEnum(payload.cardioKind, 'cardioKind', CARDIO_KINDS);
	}
	if (typeof payload.sortOrder === 'number' && Number.isInteger(payload.sortOrder)) {
		updates.sortOrder = payload.sortOrder;
	}
	if (payload.notes !== undefined) {
		updates.notes =
			payload.notes == null
				? null
				: typeof payload.notes === 'string'
					? payload.notes.slice(0, 4000)
					: badRequest('notes must be a string or null');
	}
	if (Object.keys(updates).length === 1) badRequest('equipment.update needs at least one field');

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

	const row = (
		await db.select().from(equipment).where(eq(equipment.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`equipment ${payload.id} not found`);
	return row;
}

async function equipmentDelete(payload: {
	id: string;
}): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	const now = Date.now();
	await db
		.update(equipment)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(eq(equipment.id, payload.id));
	// Cascade soft-delete to attached exercises.
	await db
		.update(exercise)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(eq(exercise.equipmentId, payload.id));
	return { id: payload.id, deletedAt: now };
}

async function exerciseCreate(payload: ExerciseCreate): Promise<Exercise> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.equipmentId, 'equipmentId');
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

async function exerciseUpdate(payload: ExerciseUpdate): Promise<Exercise> {
	assertUlid(payload.id, 'id');
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

async function exerciseDelete(payload: {
	id: string;
}): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	const now = Date.now();
	await db
		.update(exercise)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(eq(exercise.id, payload.id));
	return { id: payload.id, deletedAt: now };
}

// ─── set handlers (with implicit session boundary) ─────────────────────

const SESSION_EXTEND_MS = 90 * 60 * 1000;
const SESSION_SAFETY_MS = 6 * 60 * 60 * 1000;

async function resolveSession(
	userId: string,
	gymId: string,
	tsMs: number
): Promise<{ sessionId: string; isNew: boolean }> {
	// Look at the user's most recent open session.
	const open = (
		await db
			.select()
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, userId), isNull(workoutSession.endedAt)))
			.orderBy(desc(workoutSession.startedAt))
			.limit(1)
	)[0] as WorkoutSession | undefined;

	let lastTs: number | null = null;
	if (open) {
		const lastSet = (
			await db
				.select({ ts: setTable.ts })
				.from(setTable)
				.where(
					and(eq(setTable.workoutSessionId, open.id), isNull(setTable.deletedAt))
				)
				.orderBy(desc(setTable.ts))
				.limit(1)
		)[0] as { ts: Date } | undefined;
		lastTs = lastSet?.ts.getTime() ?? open.startedAt.getTime();
	}

	const shouldExtend =
		open && lastTs != null && tsMs - lastTs <= SESSION_EXTEND_MS && tsMs - lastTs >= 0;

	if (shouldExtend && open) {
		return { sessionId: open.id, isNew: false };
	}

	// Close the stale open session, if any. Cap endedAt at lastTs (the
	// real last activity) when the gap exceeds the safety window so the
	// session's duration isn't bloated by user inactivity.
	if (open && lastTs != null) {
		const gap = tsMs - lastTs;
		const endedAt = gap > SESSION_SAFETY_MS ? new Date(lastTs) : new Date(lastTs);
		await db
			.update(workoutSession)
			.set({ endedAt, updatedAt: new Date() })
			.where(eq(workoutSession.id, open.id));
	} else if (open) {
		await db
			.update(workoutSession)
			.set({ endedAt: open.startedAt, updatedAt: new Date() })
			.where(eq(workoutSession.id, open.id));
	}

	const sessionId = newUlid();
	await db.insert(workoutSession).values({
		id: sessionId,
		userId,
		gymId,
		startedAt: new Date(tsMs)
	});
	return { sessionId, isNew: true };
}

async function setCreate(
	payload: SetCreate,
	userId: string
): Promise<{ set: SetRow; sessionId: string; sessionIsNew: boolean }> {
	assertUlid(payload.id, 'id');
	assertUlid(payload.exerciseId, 'exerciseId');

	// Resolve exercise → equipment → gym so the session attaches to the
	// right gym (per D4 trade-off #3 — session.gymId is captured on the
	// first set, immutable after).
	const ex = (
		await db
			.select({
				id: exercise.id,
				equipmentId: exercise.equipmentId
			})
			.from(exercise)
			.where(and(eq(exercise.id, payload.exerciseId), isNull(exercise.deletedAt)))
			.limit(1)
	)[0];
	if (!ex) notFound(`exercise ${payload.exerciseId} not found`);

	const eqRow = (
		await db
			.select({ id: equipment.id, gymId: equipment.gymId, type: equipment.type })
			.from(equipment)
			.where(and(eq(equipment.id, ex.equipmentId), isNull(equipment.deletedAt)))
			.limit(1)
	)[0];
	if (!eqRow) notFound(`equipment ${ex.equipmentId} not found`);

	const isCardio = eqRow.type === 'cardio';
	const ts =
		typeof payload.ts === 'number' && Number.isFinite(payload.ts) && payload.ts > 0
			? payload.ts
			: Date.now();

	let weight: number | null = null;
	let reps: number | null = null;
	let durationMin: number | null = null;
	let extras: Record<string, number> | null = null;

	if (isCardio) {
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
	} else {
		if (typeof payload.weight !== 'number' || payload.weight < 0) {
			badRequest('strength set requires non-negative weight');
		}
		if (typeof payload.reps !== 'number' || !Number.isInteger(payload.reps) || payload.reps < 0) {
			badRequest('strength set requires non-negative integer reps');
		}
		weight = payload.weight;
		reps = payload.reps;
	}

	const session = await resolveSession(userId, eqRow.gymId, ts);

	await db
		.insert(setTable)
		.values({
			id: payload.id,
			userId,
			workoutSessionId: session.sessionId,
			exerciseId: payload.exerciseId,
			weight,
			reps,
			durationMin,
			extras,
			ts: new Date(ts)
		})
		.onConflictDoNothing();

	const row = (
		await db.select().from(setTable).where(eq(setTable.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`set ${payload.id} not found after insert`);

	return { set: row, sessionId: session.sessionId, sessionIsNew: session.isNew };
}

async function setUpdate(payload: SetUpdate, userId: string): Promise<SetRow> {
	assertUlid(payload.id, 'id');

	const updates: Partial<SetRow> = { updatedAt: new Date() };
	if (payload.weight !== undefined) {
		if (payload.weight !== null && (typeof payload.weight !== 'number' || payload.weight < 0)) {
			badRequest('weight must be a non-negative number or null');
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

	await db
		.update(setTable)
		.set(updates)
		.where(and(eq(setTable.id, payload.id), eq(setTable.userId, userId)));

	const row = (
		await db.select().from(setTable).where(eq(setTable.id, payload.id)).limit(1)
	)[0];
	if (!row) notFound(`set ${payload.id} not found`);
	return row;
}

async function setDelete(
	payload: { id: string },
	userId: string
): Promise<{ id: string; deletedAt: number }> {
	assertUlid(payload.id, 'id');
	const now = Date.now();
	await db
		.update(setTable)
		.set({ deletedAt: new Date(now), updatedAt: new Date(now) })
		.where(and(eq(setTable.id, payload.id), eq(setTable.userId, userId)));
	return { id: payload.id, deletedAt: now };
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
	if (typeof envelope.clientId !== 'string' || envelope.clientId.length === 0)
		badRequest('clientId required');
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
			return { replayed: false, result: await gymCreate(payload) };
		case 'gym.update':
			return { replayed: false, result: await gymUpdate(payload) };
		case 'gym.delete':
			return { replayed: false, result: await gymDelete(payload) };
		case 'equipment.create':
			return { replayed: false, result: await equipmentCreate(payload) };
		case 'equipment.update':
			return { replayed: false, result: await equipmentUpdate(payload) };
		case 'equipment.delete':
			return { replayed: false, result: await equipmentDelete(payload) };
		case 'exercise.create':
			return { replayed: false, result: await exerciseCreate(payload) };
		case 'exercise.update':
			return { replayed: false, result: await exerciseUpdate(payload) };
		case 'exercise.delete':
			return { replayed: false, result: await exerciseDelete(payload) };
		case 'set.create':
			return { replayed: false, result: await setCreate(payload, userId) };
		case 'set.update':
			return { replayed: false, result: await setUpdate(payload, userId) };
		case 'set.delete':
			return { replayed: false, result: await setDelete(payload, userId) };
		default:
			badRequest(`unknown op: ${op}`);
	}
}

export { derivedExerciseId };
