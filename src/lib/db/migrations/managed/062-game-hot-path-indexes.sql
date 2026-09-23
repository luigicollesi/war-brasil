-- Restore game.cards hot-path indexes in every managed database lineage.
-- Legacy databases inherited equivalent indexes from migration 003 and the
-- schema-normalization rename. Clean installs must expose the same physical
-- access paths.
--
-- Up Migration

CREATE INDEX IF NOT EXISTS cards_room_zone_idx
  ON game.cards(room_id, zone, deck_order);

CREATE INDEX IF NOT EXISTS cards_hand_idx
  ON game.cards(room_id, owner_player_id)
  WHERE zone='hand';

-- Forward-only: dropping these indexes would intentionally regress the deck
-- draw and player-hand read paths.
