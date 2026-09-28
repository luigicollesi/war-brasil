-- Canonical dice pip presentation belongs to catalog.cosmetic_sets.
-- Commercial catalog.collections remains independent from visual dice grouping.
--
-- This migration is intentionally idempotent with the production hotfix that
-- introduced the same structure before the source-managed migration landed.
--
-- Up Migration

ALTER TABLE catalog.cosmetic_sets
  ADD COLUMN IF NOT EXISTS dice_pip_dark BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dice_pip_compact BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE catalog.collections
  DROP COLUMN IF EXISTS dice_pip_dark,
  DROP COLUMN IF EXISTS dice_pip_compact;

ALTER TABLE game.player_cosmetic_loadouts
  ADD COLUMN IF NOT EXISTS dice_pip_dark BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dice_pip_compact BOOLEAN NOT NULL DEFAULT FALSE;

-- Internal/current visual sets that may predate the normalized relationship.
INSERT INTO catalog.cosmetic_sets(
  id, slug, storage_slug, name, description, preview_ref, status, sort_order
)
VALUES
  (
    'set.default','default','default','Padrão',
    'Conjunto visual padrão dos dados do jogo.',
    NULL,'retired',0
  ),
  (
    'set.brazil','brazil','brazil','Brasil',
    'Conjunto visual Brasil dos dados do jogo.',
    NULL,'retired',1
  ),
  (
    'set.bronze-flourish','bronze-flourish','bronze-flourish','Bronze Flourish',
    'Trio de dados com moldura ornamental em bronze e detalhes coloridos.',
    NULL,'available',30
  ),
  (
    'set.cosmic-night','ceu-noturno','cosmic-night','Céu Noturno',
    'Trio de dados da coleção temática Céu Noturno.',
    NULL,'available',40
  ),
  (
    'set.serpent-silver','serpent-silver','serpent-silver','Serpent Silver',
    'Trio de dados com acabamento prateado e motivos de serpente.',
    NULL,'available',45
  ),
  (
    'set.toxic','toxic','toxic','Toxic',
    'Trio de dados da coleção temática Toxic.',
    NULL,'available',60
  ),
  (
    'set.black-dragon','black-dragon','black-dragon','Dragão Negro',
    'Trio de dados da coleção temática Dragão Negro.',
    NULL,'available',70
  )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    storage_slug=EXCLUDED.storage_slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    status=EXCLUDED.status,
    sort_order=EXCLUDED.sort_order,
    updated_at=NOW();

-- Add the canonical membership only when the corresponding cosmetic exists.
-- This keeps the migration safe for historical/local databases whose optional
-- catalog data has not yet been seeded, while converging the production catalog.
WITH desired(set_id, cosmetic_id, position) AS (
  VALUES
    ('set.default','dice.attack.default',0::smallint),
    ('set.default','dice.defense.default',1::smallint),
    ('set.default','dice.neutral.default',2::smallint),
    ('set.brazil','dice.attack.brazil',0::smallint),
    ('set.brazil','dice.defense.brazil',1::smallint),
    ('set.brazil','dice.neutral.brazil',2::smallint),
    ('set.bronze-flourish','dice.attack.bronze-flourish',0::smallint),
    ('set.bronze-flourish','dice.defense.bronze-flourish',1::smallint),
    ('set.bronze-flourish','dice.neutral.bronze-flourish',2::smallint),
    ('set.cosmic-night','dice.attack.cosmic-night',0::smallint),
    ('set.cosmic-night','dice.defense.cosmic-night',1::smallint),
    ('set.cosmic-night','dice.neutral.cosmic-night',2::smallint),
    ('set.serpent-silver','dice.attack.serpent-silver',0::smallint),
    ('set.serpent-silver','dice.defense.serpent-silver',1::smallint),
    ('set.serpent-silver','dice.neutral.serpent-silver',2::smallint),
    ('set.toxic','dice.attack.toxic',0::smallint),
    ('set.toxic','dice.defense.toxic',1::smallint),
    ('set.toxic','dice.neutral.toxic',2::smallint),
    ('set.black-dragon','dice.attack.black-dragon',0::smallint),
    ('set.black-dragon','dice.defense.black-dragon',1::smallint),
    ('set.black-dragon','dice.neutral.black-dragon',2::smallint)
)
INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
SELECT desired.set_id, desired.cosmetic_id, desired.position
  FROM desired
  JOIN catalog.cosmetics cosmetic ON cosmetic.id=desired.cosmetic_id
ON CONFLICT (set_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

-- A cosmetic can belong to only one canonical cosmetic set.
DO $$
DECLARE
  cosmetic_id_attnum SMALLINT;
BEGIN
  SELECT attribute.attnum
    INTO cosmetic_id_attnum
    FROM pg_attribute attribute
   WHERE attribute.attrelid='catalog.cosmetic_set_items'::regclass
     AND attribute.attname='cosmetic_id'
     AND NOT attribute.attisdropped;

  IF cosmetic_id_attnum IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid='catalog.cosmetic_set_items'::regclass
          AND constraint_row.contype='u'
          AND constraint_row.conkey=ARRAY[cosmetic_id_attnum]::smallint[]
     ) THEN
    ALTER TABLE catalog.cosmetic_set_items
      ADD CONSTRAINT cosmetic_set_items_cosmetic_id_key UNIQUE (cosmetic_id);
  END IF;
END
$$;

-- Current visual policy. Keep it data-driven and scoped to the known catalog.
UPDATE catalog.cosmetic_sets
   SET dice_pip_dark=CASE
         WHEN id IN ('set.cosmic-night','set.black-dragon') THEN TRUE
         ELSE FALSE
       END,
       dice_pip_compact=FALSE,
       updated_at=NOW()
 WHERE id IN (
   'set.default',
   'set.brazil',
   'set.simple-silver',
   'set.exercito',
   'set.lancas',
   'set.bronze-flourish',
   'set.cosmic-night',
   'set.serpent-silver',
   'set.cachorro',
   'set.toxic',
   'set.black-dragon',
   'set.gato',
   'set.viking',
   'set.futebol'
 );

-- Internal sets remain valid presentation sources without being merchandise.
UPDATE catalog.cosmetic_sets
   SET status='retired',
       updated_at=NOW()
 WHERE id IN ('set.default','set.brazil');

-- Down Migration
-- Forward corrections are preferred because the snapshot columns and canonical
-- membership constraint are part of durable match/catalog invariants.
