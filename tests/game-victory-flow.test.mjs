import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("indicador de conexão publica sua reserva real e utility bar consome a medida", () => {
  const indicator = source("src/components/server-connection-indicator.tsx");
  const roads = source("src/app/game/[roomId]/game-roads.css");
  const tuning = source("src/app/game/[roomId]/game-fine-tuning.css");

  assert.match(indicator, /ResizeObserver/);
  assert.match(indicator, /getBoundingClientRect\(\)/);
  assert.match(indicator, /--game-connection-reserved-right/);
  assert.match(indicator, /window\.innerWidth - rect\.left/);
  assert.match(roads, /var\(--game-connection-reserved-right/);
  assert.match(tuning, /var\(--game-connection-reserved-right/);
});

test("votos de revanche são persistidos por humano e bots não bloqueiam reinício", () => {
  const migration = source("src/lib/db/migrations/010-game-rematch-votes.sql");
  const service = source("src/lib/server/game-finish-command-service.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS game_rematch_votes/);
  assert.match(migration, /PRIMARY KEY \(room_id, player_id\)/);
  assert.match(service, /ON CONFLICT \(room_id,player_id\) DO NOTHING/);
  assert.match(service, /voteCount === humanCount/);
  assert.match(service, /requiredCount: humanCount/);
  assert.match(service, /resetRoomToWaiting/);
  assert.match(service, /initializeFreshGame/);
});

test("reinício recria uma partida limpa e reapresenta a distribuição inicial", () => {
  const service = source("src/lib/server/game-finish-command-service.ts");

  assert.match(service, /DELETE FROM game_round_events/);
  assert.match(service, /DELETE FROM game_order_rolls/);
  assert.match(service, /DELETE FROM game_cards/);
  assert.match(service, /DELETE FROM game_player_objectives/);
  assert.match(service, /DELETE FROM game_territories/);
  assert.match(service, /owner_player_id,troops,initial_draw_order/);
  assert.match(service, /\$\{offset \+ 3\}, 1, \$\$\{offset \+ 4\}/);
  assert.match(service, /index \+ 1/);
  assert.match(service, /initial_territory_presentation_started_at/);
  assert.match(service, /INITIAL_TERRITORY_SYNC_DELAY_MS/);
  assert.match(service, /status='order_roll'/);
});

test("qualquer jogador humano pode devolver a sala finalizada ao mesmo lobby", () => {
  const service = source("src/lib/server/game-finish-command-service.ts");
  const client = source("src/components/game-client-v2.tsx");
  const gameRoute = source("src/app/api/games/[roomId]/route.ts");

  assert.match(service, /returnEveryoneToLobbyCommand/);
  assert.match(service, /status='waiting'/);
  assert.match(
    service,
    /SET is_ready=is_bot,turn_position=NULL,bot_next_action_at=NULL/,
  );
  assert.match(client, /snapshot\?\.room\.status === "waiting"/);
  assert.match(client, /router\.replace\(`\/lobby\/\$\{snapshot\.room\.code\}`\)/);
  assert.doesNotMatch(gameRoute, /status as string\) === "waiting"/);
});

test("vitória monta modal terminal com votação e retorno coletivo", () => {
  const client = source("src/components/game-client-v2.tsx");
  const modal = source("src/components/game-victory-modal.tsx");
  const snapshot = source("src/lib/server/game-snapshot-service.ts");

  assert.match(client, /snapshot\.room\.status === "finished"/);
  assert.match(client, /<GameVictoryModal/);
  assert.match(client, /"rematch"/);
  assert.match(client, /"return-lobby"/);
  assert.match(modal, /Votar para reiniciar/);
  assert.match(modal, /Voltar todos ao lobby/);
  assert.match(modal, /rematch\.voteCount/);
  assert.doesNotMatch(modal, /onClose=/);
  assert.match(snapshot, /game_rematch_votes/);
  assert.match(snapshot, /hasVoted/);
});
