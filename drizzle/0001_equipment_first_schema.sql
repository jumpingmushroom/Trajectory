CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`gym_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`group` text NOT NULL,
	`glyph` text DEFAULT 'bench' NOT NULL,
	`tint` text DEFAULT '#1c2026' NOT NULL,
	`photo_path` text,
	`cardio_kind` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`gym_id`) REFERENCES `gym`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `equipment_gym_id_idx` ON `equipment` (`gym_id`);--> statement-breakpoint
CREATE INDEX `equipment_gym_id_deleted_at_idx` ON `equipment` (`gym_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`name` text NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercise_equipment_id_idx` ON `exercise` (`equipment_id`);--> statement-breakpoint
CREATE TABLE `mutation_log` (
	`client_id` text NOT NULL,
	`mutation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`applied_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`client_id`, `mutation_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mutation_log_user_id_idx` ON `mutation_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `set` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`weight` real,
	`reps` integer,
	`duration_min` real,
	`extras` text,
	`ts` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workout_session_id`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `set_workout_session_id_idx` ON `set` (`workout_session_id`);--> statement-breakpoint
CREATE INDEX `set_user_ts_idx` ON `set` (`user_id`,`ts`);--> statement-breakpoint
CREATE INDEX `set_exercise_ts_idx` ON `set` (`exercise_id`,`ts`);--> statement-breakpoint
CREATE TABLE `workout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`gym_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gym_id`) REFERENCES `gym`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_session_user_started_idx` ON `workout_session` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `workout_session_gym_started_idx` ON `workout_session` (`gym_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `workout_session_open_idx` ON `workout_session` (`user_id`,`ended_at`);