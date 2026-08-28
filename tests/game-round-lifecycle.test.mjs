import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chooseJurassicTunnelDestination,
  jurassicTunnelCandidates,
} from "../.test-build/game-round-rules.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("candidatos do Túnel excluem território 1, Acre e destino anterior", () => {
  assert.deepEqual(jurassicTunnelCandidates([1, 2, 3, 4, 5], 4), [2, 5]);
});

test("sorteio do Túnel recebe aleatoriedade injetada e valida o índice", () => {
  assert.equal(
    chooseJurassicTunnelDestination([1, 2, 3, 4, 5], 4, () => 1),
    5,
  );
  assert.throws(
    () => chooseJurassicTunnelDestination([1, 2, 3, 4], null, () => 2),
    RangeError,
  );
});

test("rodada inicial registra evento 0 sem resolver ou aplicar seus efeitos", () => {
  const round = source("src/lib/game-round-service.ts");

  const initializeStart = round.indexOf("export async function initializeFirstGameRound");
  const advanceStart = round.indexOf("export async function advanceGameRound");
  const initializeBody = round.slice(initializeStart, advanceStart);

  assert.match(initializeBody, /getEvent\(client, INITIAL_EVENT_ID\)/);
  assert.match(initializeBody, /roundNumber: 1/);
  assert.match(initializeBody, /eventId: INITIAL_EVENT_ID/);
  assert.match(initializeBody, /resolvedEffects: \[\]/);
  assert.match(initializeBody, /territoryUpdates: \[\]/);
  assert.doesNotMatch(initializeBody, /resolveGameEventEffects\(/);
  assert.doesNotMatch(initializeBody, /applyPermanentEventEffects\(/);
});

test("startPlaying usa a rodada inicial antes de tornar a sala playing", () => {
  const presentation = source("src/lib/game-presentation-service.ts");
  const initializeIndex = presentation.indexOf("initializeFirstGameRound(client, room.id)");
  const playingUpdateIndex = presentation.indexOf("SET status='playing'");

  assert.ok(initializeIndex >= 0);
  assert.ok(playingUpdateIndex > initializeIndex);
  assert.match(presentation, /round_number=\$3/);
  assert.match(presentation, /jurassic_tunnel_territory_id=\$4/);
  assert.doesNotMatch(presentation, /chooseJurassicTunnelDestination/);
  assert.doesNotMatch(presentation, /TERRITORY_METADATA/);
});

test("virada escolhe evento da rodada exata e protege o novo Túnel antes da resolução", () => {
  const round = source("src/lib/game-round-service.ts");
  const selector = source("src/lib/events/event-selection-service.ts");
  const advanceStart = round.indexOf("export async function advanceGameRound");
  const advanceBody = round.slice(advanceStart);

  assert.match(selector, /getRoomRoundEvent\([\s\S]*currentRoundNumber/);
  assert.doesNotMatch(selector, /getLatestRoomEvent/);

  const tunnelIndex = advanceBody.indexOf("const jurassicTunnelDestinationId = nextTunnel(");
  const selectIndex = advanceBody.indexOf("const selection = await chooseNextRoomEvent(");
  const resolveIndex = advanceBody.indexOf("const resolvedEffects = await resolveGameEventEffects(");
  const recordIndex = advanceBody.indexOf("await recordRoundEvent(client, {");
  const applyIndex = advanceBody.indexOf("const territoryUpdates = await applyPermanentEventEffects(");
  const updateRoomIndex = advanceBody.indexOf("UPDATE game_rooms");

  assert.ok(tunnelIndex >= 0);
  assert.ok(selectIndex > tunnelIndex);
  assert.ok(resolveIndex > selectIndex);
  assert.ok(recordIndex > resolveIndex);
  assert.ok(applyIndex > recordIndex);
  assert.ok(updateRoomIndex > applyIndex);
  assert.match(
    advanceBody.slice(resolveIndex, recordIndex),
    /jurassicTunnelDestinationId/,
  );
});

test("endTurn só avança rodada no wrap e zera movimentações antes da nova anomalia", () => {
  const command = source("src/lib/game-command-service.ts");

  const resetIndex = command.lastIndexOf(
    'UPDATE game_territories SET moved_in_turn=0 WHERE room_id=$1',
  );
  const wrapIndex = command.indexOf("const wrapsRound =");
  const advanceIndex = command.indexOf("await advanceGameRound(client, {");
  const nextPlayerUpdateIndex = command.lastIndexOf("SET phase='cards',current_player_id=$2");

  assert.ok(resetIndex >= 0);
  assert.ok(wrapIndex > resetIndex);
  assert.ok(advanceIndex > wrapIndex);
  assert.ok(nextPlayerUpdateIndex > advanceIndex);
  assert.match(command, /if \(wrapsRound\) \{[\s\S]*advanceGameRound/);
  assert.match(command, /currentRoundNumber: room\.round_number/);
  assert.match(
    command,
    /previousJurassicTunnelDestinationId:[\s\S]*room\.jurassic_tunnel_territory_id/,
  );
  assert.doesNotMatch(command, /advanceJurassicTunnelRound/);
  assert.doesNotMatch(command, /chooseJurassicTunnelDestination/);
});

test("lifecycle inteiro reutiliza o PoolClient da transação externa", () => {
  const round = source("src/lib/game-round-service.ts");
  const command = source("src/lib/game-command-service.ts");
  const presentation = source("src/lib/game-presentation-service.ts");
  const transaction = source("src/lib/game-command.ts");

  assert.match(round, /type \{ PoolClient \} from "pg"/);
  assert.doesNotMatch(round, /pool\.connect|BEGIN|COMMIT|ROLLBACK/);
  assert.match(command, /return gameCommand\(roomId, async \(client\) =>/);
  assert.match(presentation, /return gameConditionalCommand\(/);
  assert.match(transaction, /SELECT id,revision FROM game_rooms WHERE id=\$1 FOR UPDATE/);
  assert.match(transaction, /await client\.query\("ROLLBACK"\)/);
});

test("gameplay não faz mais self-healing de Túnel ou evento ausente", () => {
  const combat = source("src/lib/game-combat-command-service.ts");
  const topology = source("src/lib/game-effective-topology-service.ts");

  assert.doesNotMatch(combat, /ensureJurassicTunnel/);
  assert.doesNotMatch(combat, /UPDATE game_rooms SET jurassic_tunnel_territory_id/);
  assert.match(topology, /jurassicTunnelDestinationId === null/);
  assert.match(topology, /if \(!roundEvent\)/);
  assert.doesNotMatch(topology, /roundEvent\?\.resolvedEffects \?\? \[\]/);
});

test("snapshot já deriva activeEvent exatamente da rodada atual", () => {
  const snapshot = source("src/lib/game-snapshot-service.ts");

  assert.match(
    snapshot,
    /getRoomRoundEvent\([\s\S]*room\.id,[\s\S]*room\.round_number/,
  );
  assert.match(snapshot, /activeEvent: roundEvent/);
});
