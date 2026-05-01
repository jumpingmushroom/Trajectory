CREATE TABLE `achievement` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	`seen_at` integer,
	`source_set_id` text,
	`source_session_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_set_id`) REFERENCES `set`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_session_id`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievement_user_badge_unq` ON `achievement` (`user_id`,`badge_key`);--> statement-breakpoint
CREATE INDEX `achievement_user_seen_idx` ON `achievement` (`user_id`,`seen_at`);