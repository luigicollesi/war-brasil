import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { balancedTerritoryAssignments } from "../.test-build/shared/game-departure-rules.js";

test("redistribuição prioriza sempre quem possui menos territórios", () => {
  const assignments = balancedTerritoryAssignments(
    [1, 2, 3, 4, 5, 6],
    [
      { playerId: "a", territoryCount: 10 },
      { playerId: "b", territoryCount: 7 },
      { playerId: "c", territoryCount: 7 },
    ],
    () => 0,
  );

  const received = assignments.reduce((counts, assignment) => {
    counts.set(
      assignment.playerId,
      (counts.get(assignment.playerId) ?? 0) + 1,
    );
    return counts;
  }, new Map());

  assert.equal(received.get("a") ?? 0, 0);
  assert.equal(received.get("b") ?? 0, 3);
  assert.equal(received.get("c") ?? 0, 3);
});

test("empates podem ser resolvidos aleatoriamente sem perder igualdade", () => {
  let pick = 0;
  const assignments = balancedTerritoryAssignments(
    [1, 2, 3, 4, 5],
    [
      { playerId: "a", territoryCount: 3 },
      { playerId: "b", territoryCount: 3 },
    ],
    (exclusiveMax) => {
      const result = pick % exclusiveMax;
      pick += 1;
      return result;
    },
  );

  const received = new Map([["a", 0], ["b", 0]]);
  for (const assignment of assignments) {
    received.set(assignment.playerId, received.get(assignment.playerId) + 1);
  }

  assert.ok(Math.abs(received.get("a") - received.get("b")) <= 1);
});

test("serviço de saída mantém toda mutação dentro do comando autoritativo", () => {
  const service = readFileSync(
    "src/lib/server/game-player-exit-service.ts",
    "utf8",
  );
  const route = readFileSync(
    "src/app/api/games/[roomId]/leave/route.ts",
    "utf8",
  );

  assert.match(service, /playerGameCommand/);
  assert.match(service, /"leave_game"/);
  assert.match(service, /left_at=NOW\(\)/);
  assert.match(service, /zone='discard',owner_player_id=NULL,deck_order=NULL/);
  assert.match(service, /balancedTerritoryAssignments/);
  assert.match(service, /unnest\(\$2::smallint\[\], \$3::bigint\[\]\)/);
  assert.match(service, /evaluateGameVictories/);
  assert.match(service, /finalizeGameVictories/);
  assert.match(service, /finalizeGameWithoutWinner/);
  assert.match(service, /beginPlayerTurnPhase/);
  assert.match(route, /clearActiveParticipationCookie/);
  assert.match(route, /allowDepartedSeat: true/);
});

test("saída não usa loop assíncrono nem polling para redistribuir", () => {
  const service = readFileSync(
    "src/lib/server/game-player-exit-service.ts",
    "utf8",
  );
  assert.doesNotMatch(service, /setTimeout|setInterval|while\s*\(/);
});
