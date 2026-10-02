-- Dice body color is derived from slot + cosmetic_sets.dice_pip_dark.
-- Per-cosmetic body colors are no longer catalog authority.
--
-- Up Migration

UPDATE catalog.cosmetics
   SET body_color=NULL,
       body_highlight_color=NULL,
       updated_at=NOW()
 WHERE slot IN ('dice_attack','dice_defense','dice_neutral')
   AND (body_color IS NOT NULL OR body_highlight_color IS NOT NULL);

UPDATE game.player_cosmetic_loadouts
   SET body_color=NULL,
       body_highlight_color=NULL
 WHERE slot IN ('dice_attack','dice_defense','dice_neutral')
   AND (body_color IS NOT NULL OR body_highlight_color IS NOT NULL);

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='cosmetics_dice_body_color_unused_check'
       AND conrelid='catalog.cosmetics'::regclass
  ) THEN
    ALTER TABLE catalog.cosmetics
      ADD CONSTRAINT cosmetics_dice_body_color_unused_check
      CHECK (
        slot NOT IN ('dice_attack','dice_defense','dice_neutral')
        OR (body_color IS NULL AND body_highlight_color IS NULL)
      );
  END IF;
END
$body$;

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='player_cosmetic_loadouts_dice_body_color_unused_check'
       AND conrelid='game.player_cosmetic_loadouts'::regclass
  ) THEN
    ALTER TABLE game.player_cosmetic_loadouts
      ADD CONSTRAINT player_cosmetic_loadouts_dice_body_color_unused_check
      CHECK (
        slot NOT IN ('dice_attack','dice_defense','dice_neutral')
        OR (body_color IS NULL AND body_highlight_color IS NULL)
      );
  END IF;
END
$body$;

COMMENT ON COLUMN catalog.cosmetics.body_color IS
  'Legacy compatibility column. Dice body color is derived from slot + cosmetic_sets.dice_pip_dark and MUST remain NULL for dice slots.';

COMMENT ON COLUMN catalog.cosmetics.body_highlight_color IS
  'Legacy compatibility column. Dice highlight is renderer-derived and MUST remain NULL for dice slots.';

COMMENT ON COLUMN game.player_cosmetic_loadouts.body_color IS
  'Legacy snapshot compatibility column. Dice body color is derived from frozen slot + dice_pip_dark and MUST remain NULL for dice slots.';

COMMENT ON COLUMN game.player_cosmetic_loadouts.body_highlight_color IS
  'Legacy snapshot compatibility column. Dice highlight is renderer-derived and MUST remain NULL for dice slots.';

-- Down Migration
-- Persisted per-die body colors are intentionally not restored. Future visual
-- changes should evolve the slot/dark presentation rule forward.
