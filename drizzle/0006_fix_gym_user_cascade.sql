-- 0005 added `gym.user_id` via ALTER TABLE ADD COLUMN ... REFERENCES, which
-- silently dropped the ON DELETE CASCADE clause: SQLite registers the FK
-- but with on_delete = NO ACTION, so deleting a user with gyms throws
-- FOREIGN KEY constraint failed. The standard fix is the 12-step rebuild:
-- create a replacement table with the right schema, copy rows, drop the
-- original, rename. Indexes are recreated afterwards.

PRAGMA foreign_keys = OFF;--> statement-breakpoint

CREATE TABLE `gym__new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`tint` text DEFAULT '#1c2026' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `gym__new` (`id`, `user_id`, `name`, `city`, `tint`, `is_primary`, `created_at`, `updated_at`, `deleted_at`)
SELECT `id`, `user_id`, `name`, `city`, `tint`, `is_primary`, `created_at`, `updated_at`, `deleted_at` FROM `gym`;
--> statement-breakpoint

DROP TABLE `gym`;--> statement-breakpoint
ALTER TABLE `gym__new` RENAME TO `gym`;--> statement-breakpoint

CREATE INDEX `gym_user_deleted_idx` ON `gym` (`user_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `gym_deleted_at_idx` ON `gym` (`deleted_at`);--> statement-breakpoint

PRAGMA foreign_keys = ON;
