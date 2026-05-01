-- v0.2 multiuser refactor: per-user tenancy + admin role + invite flow.
-- This migration is destructive: ALL existing data rows are wiped.
-- Per the agreed v0.2 rollout (wipe & restart), there is no backfill.
-- After this migration, the only path to populate the user table is the
-- ADMIN_EMAIL / ADMIN_PASSWORD env-seeded admin (src/lib/server/seedAdmin.ts).

-- 1. Wipe data. FK cascades take care of dependent rows, but we delete in
--    explicit order so the intent is unambiguous on review.
DELETE FROM `achievement`;--> statement-breakpoint
DELETE FROM `set`;--> statement-breakpoint
DELETE FROM `mutation_log`;--> statement-breakpoint
DELETE FROM `workout_session`;--> statement-breakpoint
DELETE FROM `exercise`;--> statement-breakpoint
DELETE FROM `equipment`;--> statement-breakpoint
DELETE FROM `gym`;--> statement-breakpoint
DELETE FROM `verification`;--> statement-breakpoint
DELETE FROM `account`;--> statement-breakpoint
DELETE FROM `session`;--> statement-breakpoint
DELETE FROM `user`;--> statement-breakpoint

-- 2. New tables.
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_unique` ON `invite` (`token`);--> statement-breakpoint
CREATE INDEX `invite_user_id_idx` ON `invite` (`user_id`);--> statement-breakpoint

-- 3. Column additions. SQLite ADD COLUMN NOT NULL requires a DEFAULT even
--    on empty tables; the placeholder default is never read because every
--    application insert specifies the value explicitly.
ALTER TABLE `gym` ADD `user_id` text NOT NULL DEFAULT '' REFERENCES user(id);--> statement-breakpoint
CREATE INDEX `gym_user_deleted_idx` ON `gym` (`user_id`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint

-- 4. Drop the v0.1 must_change_password gate; the invite flow replaces it.
ALTER TABLE `user` DROP COLUMN `must_change_password`;
