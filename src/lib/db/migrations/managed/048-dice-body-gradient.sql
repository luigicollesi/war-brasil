-- Persist 3D dice body colors and freeze them into the match cosmetic snapshot.

-- Up Migration

ALTER TABLE catalog.cosmetics
  ADD COLUMN IF NOT EXISTS body_color varchar(7),
  ADD COLUMN IF NOT EXISTS body_highlight_color varchar(7);

ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_body_color_hex_v2_check
  CHECK (body_color IS NULL OR body_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT cosmetics_body_highlight_color_hex_check
  CHECK (
    body_highlight_color IS NULL
    OR body_highlight_color ~ '^#[0-9A-Fa-f]{6}$'
  );

ALTER TABLE game.player_cosmetic_loadouts
  ADD COLUMN IF NOT EXISTS body_color varchar(7),
  ADD COLUMN IF NOT EXISTS body_highlight_color varchar(7);

ALTER TABLE game.player_cosmetic_loadouts
  ADD CONSTRAINT player_cosmetic_loadouts_body_color_hex_check
  CHECK (body_color IS NULL OR body_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT player_cosmetic_loadouts_body_highlight_color_hex_check
  CHECK (
    body_highlight_color IS NULL
    OR body_highlight_color ~ '^#[0-9A-Fa-f]{6}$'
  );

UPDATE catalog.cosmetics
   SET body_color = '#663718',
       body_highlight_color = NULL,
       updated_at = NOW()
 WHERE id IN (
   'dice.attack.bronze-flourish',
   'dice.defense.bronze-flourish',
   'dice.neutral.bronze-flourish'
 );

UPDATE game.player_cosmetic_loadouts snapshot
   SET body_color = item.body_color,
       body_highlight_color = item.body_highlight_color
  FROM catalog.cosmetics item
 WHERE item.id = snapshot.cosmetic_id
   AND (
     snapshot.body_color IS DISTINCT FROM item.body_color
     OR snapshot.body_highlight_color IS DISTINCT FROM item.body_highlight_color
   );

COMMENT ON COLUMN catalog.cosmetics.body_color IS
  'Optional dark RGB base color for 3D dice body rendering (#RRGGBB)';
COMMENT ON COLUMN catalog.cosmetics.body_highlight_color IS
  'Optional explicit RGB highlight for 3D dice bevel/corner rendering (#RRGGBB), NULL derives from body_color';
COMMENT ON COLUMN game.player_cosmetic_loadouts.body_color IS
  'Frozen 3D dice body base color captured when the match starts';
COMMENT ON COLUMN game.player_cosmetic_loadouts.body_highlight_color IS
  'Frozen optional 3D dice bevel/corner highlight captured when the match starts';
