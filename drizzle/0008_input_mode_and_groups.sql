ALTER TABLE `equipment` ADD `input_mode` text DEFAULT 'weighted' NOT NULL;
--> statement-breakpoint
-- Derive inputMode from existing shape so users with prior data keep working.
UPDATE `equipment` SET `input_mode` = 'distance_time' WHERE `type` = 'cardio';
--> statement-breakpoint
UPDATE `equipment` SET `input_mode` = 'bodyweight'
  WHERE `type` != 'cardio' AND `bodyweight_pct` IS NOT NULL;
--> statement-breakpoint
-- Switch glyphs whose canonical mode is timed / weight_distance, but only
-- when the row is still on the original 'weighted' default.
UPDATE `equipment` SET `input_mode` = 'timed'
  WHERE `glyph` IN ('mobility', 'battleropes') AND `input_mode` = 'weighted';
--> statement-breakpoint
UPDATE `equipment` SET `input_mode` = 'weight_distance'
  WHERE `glyph` = 'sled' AND `input_mode` = 'weighted';
--> statement-breakpoint
-- Group re-tag for the cheap split (push/pull/legs/core/cardio →
-- push/pull/legs/core/cardio/arms/shoulders/glutes). Gating on the original
-- group means user-customised rows aren't clobbered.
UPDATE `equipment` SET `group` = 'glutes'    WHERE `glyph` = 'hipthrust'     AND `group` = 'legs';
--> statement-breakpoint
UPDATE `equipment` SET `group` = 'arms'      WHERE `glyph` = 'preacher'      AND `group` = 'pull';
--> statement-breakpoint
UPDATE `equipment` SET `group` = 'shoulders' WHERE `glyph` = 'shoulderpress' AND `group` = 'push';
