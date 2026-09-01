-- A progressão das trocas de cartas passa a ser individual por jogador.
-- game_rooms.trade_count permanece apenas como coluna histórica e não participa
-- mais do cálculo de reforços das trocas.
ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS card_trade_count INTEGER NOT NULL DEFAULT 0
    CHECK (card_trade_count >= 0);
