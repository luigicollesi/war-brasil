-- Compatibilidade temporária para a apresentação inicial da partida.
-- `cards` não volta a ser uma fase jogável: ele só é aceito enquanto a sala
-- está em `order_roll`, estado em que `phase` ainda não dirige ações de turno.

ALTER TABLE game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_phase_check;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_phase_check
  CHECK (
    phase IN ('trade', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished')
    OR (phase = 'cards' AND status = 'order_roll')
  );
