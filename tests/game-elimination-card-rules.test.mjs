import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("reforço é bloqueado enquanto o jogador possui cinco ou mais cartas", () => {
  const troops = source("src/lib/server/game-troop-command-service.ts");

  assert.match(troops, /MANDATORY_TRADE_HAND_SIZE,/);
  assert.doesNotMatch(troops, /const MANDATORY_TRADE_HAND_SIZE/);
  assert.match(troops, /handCardCount/);
  assert.match(troops, />=\s*MANDATORY_TRADE_HAND_SIZE/);
  assert.match(troops, /Troca de cartas obrigatória antes de posicionar reforços/);
});

test("modal obrigatório aparece na fase de reforço e não possui ação de fechar", () => {
  const modal = source("src/components/mandatory-card-trade-modal.tsx");
  const client = source("src/components/game-client-v2.tsx");

  assert.match(modal, /snapshot\.room\.phase === "reinforcement"/);
  assert.match(modal, /snapshot\.myCards\.length >= 5/);
  assert.match(modal, /Troca de cartas por reforço obrigatória/);
  assert.match(modal, /Confirmar troca/);
  assert.doesNotMatch(modal, /onClose=/);
  assert.match(client, /<MandatoryCardTradeModal/);
});

test("eliminação remove jogador da ordem sem removê-lo da sala e transfere sua mão", () => {
  const battle = source("src/lib/server/game-battle-service.ts");

  assert.match(battle, /SET turn_position=NULL,bot_next_action_at=NULL/);
  assert.doesNotMatch(battle, /DELETE FROM room_players/);
  assert.match(
    battle,
    /SET owner_player_id=\$3[\s\S]*owner_player_id=\$2 AND zone='hand'/,
  );
  assert.match(battle, /defenderStillHasTerritory/);
  assert.match(battle, /eliminatePlayer/);
});

test("bot resolve troca obrigatória estratégica antes de distribuir reforços", () => {
  const action = source("src/lib/bots/bot-action.ts");
  const runner = source("src/lib/bots/bot-runner.ts");
  const strategy = source("src/lib/bots/bot-strategy.ts");
  const cards = source("src/lib/bots/bot-cards.ts");
  const delay = source("src/lib/bots/bot-delay.ts");

  assert.match(action, /type: "trade_cards"/);
  assert.match(runner, /loadBotStrategicState/);
  assert.match(runner, /executeTradeCards/);
  assert.match(strategy, /chooseCardTrade[\s\S]*chooseReinforcement/);
  assert.match(cards, /state\.cards\.length >= 5/);
  assert.match(cards, /enumerateTradeCandidates/);
  assert.match(delay, /trade_cards:/);
});
