import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("preparação documentada acompanha limites e distribuição da sala", () => {
  const setup = source("src/components/game-guide/sections/guide-setup-section.tsx");
  const rooms = source("src/lib/rooms.ts");
  const lobby = source("src/lib/shared/lobby.ts");

  assert.match(setup, /2 a 6 jogadores/);
  assert.match(rooms, /MINIMUM_PLAYERS_TO_START = 2/);
  assert.equal((lobby.match(/\{ value:/g) ?? []).length, 6);
  assert.match(rooms, /Array\.from\(\{ length: 42 \}/);
  assert.match(rooms, /players\[index % players\.length\]\.id/);
  assert.match(rooms, /owner_player_id, troops\)[\s\S]*VALUES \$\{values\.join/);
});

test("turno percorre cartas, reforço, ataque e manobra na ordem ensinada", () => {
  const turn = source("src/components/game-guide/sections/guide-turn-section.tsx");
  const command = source("src/lib/game-command-service.ts");
  const troops = source("src/lib/game-troop-command-service.ts");

  const labels = ["Cartas", "Reforços", "Ataques", "Manobra"];
  let previous = -1;
  for (const label of labels) {
    const index = turn.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `${label} precisa manter a ordem do turno`);
    previous = index;
  }

  assert.match(command, /input\.action === "finishCards"/);
  assert.match(command, /SET phase='reinforcement'/);
  assert.match(troops, /phase=CASE WHEN \$2=0 THEN 'attack' ELSE phase END/);
  assert.match(command, /input\.action === "finishAttack"/);
  assert.match(command, /SET phase='maneuver'/);
  assert.match(command, /input\.action !== "endTurn"/);
  assert.match(command, /SET phase='cards',current_player_id=\$2/);
});

test("fim do turno concede no máximo uma carta quando houve conquista", () => {
  const cards = source("src/components/game-guide/sections/guide-cards-section.tsx");
  const command = source("src/lib/game-command-service.ts");

  assert.match(cards, /Conquistou ≥ 1/);
  assert.match(cards, /Fim do turno/);
  assert.match(command, /if \(room\.conquered_this_turn\) \{\s*await drawCard\(client, room, player\.id\);\s*\}/);
  assert.match(command, /LIMIT 1/);
});

test("troca obrigatória e bônus territorial usam limites compartilhados", () => {
  const cards = source("src/components/game-guide/sections/guide-cards-section.tsx");
  const troops = source("src/lib/game-troop-command-service.ts");

  assert.match(cards, /guide\.cards\.mandatoryTradeHandSize/);
  assert.match(cards, /ou mais cartas/);
  assert.match(cards, /Troque\s+antes de reforçar/);
  assert.match(troops, />=\s*MANDATORY_TRADE_HAND_SIZE/);
  assert.match(troops, /room\.phase !== "reinforcement"/);
  assert.match(troops, /OWNED_TERRITORY_CARD_BONUS/);
  assert.match(troops, /tradeValue\(tradeProgress\.trade_count_before\)/);
});

test("ataque, conquista e eliminação respeitam os bloqueios descritos", () => {
  const attack = source("src/lib/game-combat-command-service.ts");
  const conquest = source("src/lib/game-conquest-command-service.ts");
  const battle = source("src/lib/game-battle-service.ts");

  assert.match(attack, /isAttackOriginBlocked/);
  assert.match(attack, /Conclua o deslocamento da conquista antes de atacar novamente/);
  assert.match(attack, /não pode mais ser cancelado depois da primeira rolagem/);
  assert.match(conquest, /source\.troops - MIN_TERRITORY_TROOPS/);
  assert.match(conquest, /pending_from_territory_id=NULL,pending_to_territory_id=NULL/);

  assert.match(battle, /SET turn_position=NULL,bot_next_action_at=NULL/);
  assert.match(battle, /SET owner_player_id=\$3/);
  assert.match(battle, /owner_player_id=\$2 AND zone='hand'/);
  assert.match(battle, /pending_from_territory_id=\$2/);
  assert.match(battle, /evaluateEliminationObjectiveOwners/);
});

test("fim da ordem ativa nova rodada, Anomalia e novo Túnel", () => {
  const command = source("src/lib/game-command-service.ts");
  const round = source("src/lib/game-round-service.ts");
  const anomaly = source("src/components/game-guide/sections/guide-anomaly-section.tsx");

  assert.match(command, /const wrapsRound =/);
  assert.match(command, /if \(wrapsRound\) \{/);
  assert.match(command, /await advanceGameRound/);
  assert.match(round, /const nextRoundNumber = input\.currentRoundNumber \+ 1/);
  assert.match(round, /const jurassicTunnelDestinationId = nextTunnel/);
  assert.match(round, /chooseNextRoomEvent/);
  assert.match(round, /resolveGameEventEffects/);
  assert.match(anomaly, /Nova Anomalia/);
  assert.match(anomaly, /Novo Túnel/);
});

test("evento inicial é narrativo e remoções preservam a última tropa", () => {
  const round = source("src/lib/game-round-service.ts");
  const effects = source("src/lib/events/event-effects-service.ts");
  const anomaly = source("src/components/game-guide/sections/guide-anomaly-section.tsx");

  assert.match(round, /evento 0 é exclusivamente narrativo/i);
  assert.match(round, /resolvedEffects: \[\]/);
  assert.match(round, /appliedTroopChanges: \[\]/);
  assert.match(effects, /GREATEST\(\$\{MIN_TERRITORY_TROOPS\},troops-\$3\)/);
  assert.match(anomaly, /evento de abertura não adiciona outra/i);
  assert.match(anomaly, /minimumTroopsAfterRemoval/);
});

test("objetivos encerram a partida imediatamente nas mudanças relevantes", () => {
  const objective = source("src/lib/game-objective-service.ts");
  const troops = source("src/lib/game-troop-command-service.ts");
  const maneuver = source("src/lib/game-maneuver-command-service.ts");
  const battle = source("src/lib/game-battle-service.ts");
  const command = source("src/lib/game-command-service.ts");

  assert.match(objective, /SET status='finished',phase='finished',winner_player_id=\$2/);
  assert.match(troops, /objectiveWon\([\s\S]*"troops_changed"/);
  assert.match(maneuver, /objectiveWon\(client, room\.id, player\.id, "troops_changed"\)/);
  assert.match(battle, /"territory_control_changed"/);
  assert.match(command, /evaluateRoundTroopObjectiveWinners/);
});
