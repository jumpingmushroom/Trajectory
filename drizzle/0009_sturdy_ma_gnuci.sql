ALTER TABLE `equipment` ADD `rest_target_sec` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_default_sec` integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_timer_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_sound_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rest_vibrate_enabled` integer DEFAULT true NOT NULL;