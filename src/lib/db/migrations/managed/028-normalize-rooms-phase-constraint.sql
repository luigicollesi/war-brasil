-- Migration 028: converge the phase compatibility check name after table normalization.
-- PostgreSQL may derive an anonymous multi-column CHECK name from `status`
-- instead of `phase`, so clean schemas and upgraded schemas can otherwise drift.

-- Up Migration

DO $$
DECLARE
  current_name TEXT;
  target_definition TEXT;
BEGIN
  IF to_regclass('game.rooms') IS NULL THEN
    RAISE EXCEPTION 'Cannot normalize rooms phase constraint: game.rooms does not exist';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
    INTO target_definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'game'
     AND t.relname = 'rooms'
     AND c.conname = 'rooms_phase_check';

  IF target_definition IS NOT NULL THEN
    IF target_definition NOT LIKE '%phase%'
       OR target_definition NOT LIKE '%status%'
       OR target_definition NOT LIKE '%cards%'
       OR target_definition NOT LIKE '%order_roll%' THEN
      RAISE EXCEPTION
        'Constraint game.rooms.rooms_phase_check exists with unexpected semantics: %',
        target_definition;
    END IF;
    RETURN;
  END IF;

  SELECT c.conname
    INTO current_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'game'
     AND t.relname = 'rooms'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%phase%'
     AND pg_get_constraintdef(c.oid) LIKE '%status%'
     AND pg_get_constraintdef(c.oid) LIKE '%cards%'
     AND pg_get_constraintdef(c.oid) LIKE '%order_roll%'
   ORDER BY c.conname
   LIMIT 1;

  IF current_name IS NULL THEN
    RAISE EXCEPTION
      'Cannot normalize rooms phase constraint: migration 024 invariant not found on game.rooms';
  END IF;

  EXECUTE format(
    'ALTER TABLE game.rooms RENAME CONSTRAINT %I TO rooms_phase_check',
    current_name
  );
END
$$;
