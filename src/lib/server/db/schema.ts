import { sql } from 'drizzle-orm';
import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
	primaryKey
} from 'drizzle-orm/sqlite-core';

// ─── Better Auth tables ────────────────────────────────────────────────
// Canonical Better Auth schema for SQLite + Drizzle. The admin plugin
// (configured in src/lib/server/auth.ts) is the source of truth for the
// `role`, `banned`, `banReason`, `banExpires` columns on `user` and the
// `impersonatedBy` column on `session`. Keep schema + plugin in sync.

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
	image: text('image'),
	// Better Auth `admin` plugin fields. `role` is 'user' (default) or 'admin'.
	// banned/banReason/banExpires are reserved for the plugin's ban API; we
	// don't expose UI for it in v0.2 but the columns must exist for the plugin.
	role: text('role').default('user').notNull(),
	banned: integer('banned', { mode: 'boolean' }).default(false).notNull(),
	banReason: text('ban_reason'),
	banExpires: integer('ban_expires', { mode: 'timestamp_ms' }),
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
			.references(() => user.id, { onDelete: 'cascade' }),
		// Better Auth `admin` plugin: ID of the admin impersonating this session.
		impersonatedBy: text('impersonated_by')
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

// invite: server-issued single-use tokens for new accounts. Created when an
// admin invites a user; consumed when the recipient sets their password via
// /invite/<token>. The user row exists from creation but cannot log in until
// the invite is consumed (no `account` row with a password yet).
export const invite = sqliteTable(
	'invite',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [index('invite_user_id_idx').on(table.userId)]
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
		// userId: gym ownership. Per-user tenancy (v0.2). Equipment + exercise
		// inherit ownership transitively through this column; reads of any of
		// those tables MUST scope by `gym.userId = locals.user.id`.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
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
	(table) => [
		index('gym_user_deleted_idx').on(table.userId, table.deletedAt),
		index('gym_deleted_at_idx').on(table.deletedAt)
	]
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
		// sortOrder: reserved for "Walk order" sort; default 0.
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
		// isPr: true when this set strictly beat the user's prior best for
		// the same exercise at insert time. Strength = MAX(weight); cardio =
		// MAX(extras.distance). Computed once on set.create and persisted;
		// edits don't re-evaluate. Existing rows pre-feature stay false.
		isPr: integer('is_pr', { mode: 'boolean' }).default(false).notNull(),
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

// achievement: per-user badge unlocks. Awards are appended once when a
// definition's predicate first matches; the unique (user_id, badge_key)
// + ON CONFLICT DO NOTHING in the evaluator keeps replays idempotent.
// `seenAt` drives the modal queue — null rows pop a celebration on the
// next page load and are acknowledged via /api/achievement/[id]/seen.
// Source FKs are nullable + ON DELETE SET NULL: soft-deleting the set or
// session that triggered an award doesn't retroactively un-unlock it.
export const achievement = sqliteTable(
	'achievement',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		badgeKey: text('badge_key').notNull(),
		unlockedAt: integer('unlocked_at', { mode: 'timestamp_ms' }).notNull(),
		seenAt: integer('seen_at', { mode: 'timestamp_ms' }),
		sourceSetId: text('source_set_id').references(() => set.id, { onDelete: 'set null' }),
		sourceSessionId: text('source_session_id').references(() => workoutSession.id, {
			onDelete: 'set null'
		}),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('achievement_user_badge_unq').on(table.userId, table.badgeKey),
		index('achievement_user_seen_idx').on(table.userId, table.seenAt)
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
export type Achievement = typeof achievement.$inferSelect;
export type NewAchievement = typeof achievement.$inferInsert;
export type Invite = typeof invite.$inferSelect;
export type NewInvite = typeof invite.$inferInsert;
