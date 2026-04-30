import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';

// ─── Better Auth tables ────────────────────────────────────────────────
// Canonical Better Auth schema for SQLite + Drizzle, plus our additional
// `mustChangePassword` column on `user` (registered via additionalFields
// in the Better Auth config — the two must stay in sync).

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
	image: text('image'),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' })
		.default(false)
		.notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull()
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_user_id_idx').on(table.userId)]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

// ─── Trajectory tables ─────────────────────────────────────────────────
// Equipment-first schema. The workout-session table is named
// `workout_session` (not `session`) so it never collides with Better
// Auth's `session` table. All Trajectory tables use ULID PKs minted on
// the client (per DECISIONS D4) so writes are idempotent across the
// sync layer (M10).

export const gym = sqliteTable(
	'gym',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		city: text('city'),
		tint: text('tint').default('#1c2026').notNull(),
		isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [index('gym_deleted_at_idx').on(table.deletedAt)]
);

export const equipment = sqliteTable(
	'equipment',
	{
		id: text('id').primaryKey(),
		gymId: text('gym_id')
			.notNull()
			.references(() => gym.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		// type: barbell | machine | cable | freeweight | cardio
		type: text('type').notNull(),
		// group: push | pull | legs | core | cardio
		group: text('group').notNull(),
		// glyph: one of 11 schematic SVG keys (bench, cable, pulldown, smith,
		// squat, legpress, preacher, chestpress, treadmill, bike, rower).
		glyph: text('glyph').default('bench').notNull(),
		tint: text('tint').default('#1c2026').notNull(),
		// photoPath: path under data/uploads/, e.g. 'equipment/<ulid>.webp'.
		photoPath: text('photo_path'),
		// cardioKind: required when type='cardio' (treadmill | bike | rower |
		// generic), null otherwise. Determines the optional-fields template
		// shown by the cardio Log screen.
		cardioKind: text('cardio_kind'),
		// sortOrder: reserved for "Walk order" sort (FUTURE.md); default 0.
		sortOrder: integer('sort_order').default(0).notNull(),
		// notes: free text, shared across users (it's a fact about the
		// machine, not the lifter). Surfaced on the Detail screen.
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('equipment_gym_id_idx').on(table.gymId),
		index('equipment_gym_id_deleted_at_idx').on(table.gymId, table.deletedAt)
	]
);

export const exercise = sqliteTable(
	'exercise',
	{
		id: text('id').primaryKey(),
		equipmentId: text('equipment_id')
			.notNull()
			.references(() => equipment.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		// isHidden: true for the auto-created exercise on machines/cables so
		// the user never sees the extra layer for the 80% case (per Q2).
		isHidden: integer('is_hidden', { mode: 'boolean' }).default(false).notNull(),
		sortOrder: integer('sort_order').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [index('exercise_equipment_id_idx').on(table.equipmentId)]
);

export const workoutSession = sqliteTable(
	'workout_session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// gymId: captured at first set, immutable after (per D4 trade-off #3).
		gymId: text('gym_id')
			.notNull()
			.references(() => gym.id, { onDelete: 'cascade' }),
		// startedAt = first set's ts.
		startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
		// endedAt: set when next set arrives >90 min after the last set, or by
		// the 6 h safety auto-close. Open sessions have endedAt=null.
		endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('workout_session_user_started_idx').on(table.userId, table.startedAt),
		index('workout_session_gym_started_idx').on(table.gymId, table.startedAt),
		index('workout_session_open_idx').on(table.userId, table.endedAt)
	]
);

// Table name `set` is a SQL reserved word in some contexts. Drizzle
// quotes it correctly (`set`) in generated queries, but raw `sqlite3`
// or ad-hoc shell queries need explicit quoting (e.g. SELECT * FROM "set").
export const set = sqliteTable(
	'set',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		workoutSessionId: text('workout_session_id')
			.notNull()
			.references(() => workoutSession.id, { onDelete: 'cascade' }),
		exerciseId: text('exercise_id')
			.notNull()
			.references(() => exercise.id, { onDelete: 'cascade' }),
		// Strength columns (null for cardio).
		weight: real('weight'),
		reps: integer('reps'),
		// Cardio columns (null for strength).
		durationMin: real('duration_min'),
		// extras: JSON blob of optional cardio fields (distance, calories, hr,
		// incline, level, rpm, spm, splits, …). Schema doesn't enforce keys —
		// the UI does. Unindexable on extras keys; acceptable at our scale.
		extras: text('extras', { mode: 'json' }).$type<Record<string, number>>(),
		// ts: when the set actually happened (user-perceived time). Distinct
		// from createdAt (when the row was inserted into the server DB).
		ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('set_workout_session_id_idx').on(table.workoutSessionId),
		index('set_user_ts_idx').on(table.userId, table.ts),
		index('set_exercise_ts_idx').on(table.exerciseId, table.ts)
	]
);

// mutation_log: idempotency table for the offline-first sync layer (M10).
// Composite PK on (clientId, mutationId) means a replayed POST from a
// reconnecting client is a no-op rather than a duplicate write. Already
// in scope here because the API routes built in M4+ all flow through
// /api/mutate and need this table to exist.
export const mutationLog = sqliteTable(
	'mutation_log',
	{
		clientId: text('client_id').notNull(),
		mutationId: text('mutation_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		appliedAt: integer('applied_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.clientId, table.mutationId] }),
		index('mutation_log_user_id_idx').on(table.userId)
	]
);

export type User = typeof user.$inferSelect;
export type Gym = typeof gym.$inferSelect;
export type NewGym = typeof gym.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type NewEquipment = typeof equipment.$inferInsert;
export type Exercise = typeof exercise.$inferSelect;
export type NewExercise = typeof exercise.$inferInsert;
export type WorkoutSession = typeof workoutSession.$inferSelect;
export type NewWorkoutSession = typeof workoutSession.$inferInsert;
export type Set = typeof set.$inferSelect;
export type NewSet = typeof set.$inferInsert;
export type MutationLog = typeof mutationLog.$inferSelect;
export type NewMutationLog = typeof mutationLog.$inferInsert;
