import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalGameCommandRequest } from "../.test-build/shared/game-command-canonical.js";
import {
  GAME_COMMAND_ID_HEADER,
  GAME_EXPECTED_REVISION_HEADER,
  isGameCommandId,
  parseGameExpectedRevision,
} from "../.test-build/shared/game-command-request.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("canonicalização é estável para o mesmo comando e payload", () => {
  const first = canonicalGameCommandRequest("reinforce", {
    troops: 3,
    territoryId: 9,
    ignored: undefined,
  });
  const second = canonicalGameCommandRequest("reinforce", {
    territoryId: 9,
    troops: 3,
  });

  assert.equal(first, second);
  assert.notEqual(
    first,
    canonicalGameCommandRequest("maneuver", {
      territoryId: 9,
      troops: 3,
    }),
  );
  assert.notEqual(
    first,
    canonicalGameCommandRequest("reinforce", {
      territoryId: 9,
      troops: 4,
    }),
  );
  assert.throws(
    () => canonicalGameCommandRequest("reinforce", { troops: Number.NaN }),
    /número não finito/,
  );
});

test("contrato de headers aceita UUID e revision positiva", () => {
  assert.equal(GAME_COMMAND_ID_HEADER, "x-game-command-id");
  assert.equal(GAME_EXPECTED_REVISION_HEADER, "x-game-expected-revision");
  assert.equal(
    isGameCommandId("123e4567-e89b-42d3-a456-426614174000"),
    true,
  );
  assert.equal(isGameCommandId("not-a-command-id"), false);
  assert.equal(parseGameExpectedRevision("17"), 17);
  assert.equal(parseGameExpectedRevision(17), 17);
  assert.equal(parseGameExpectedRevision("0"), null);
});

test("migration 019 torna receipts duráveis e vinculados ao ator", () => {
  const migration = source("src/lib/db/migrations/019-game-command-receipts.sql");
  const schema = source("src/lib/db/schema.sql");

  for (const sql of [migration, schema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS game_command_receipts/);
    assert.match(sql, /PRIMARY KEY \(room_id, player_id, command_id\)/);
    assert.match(sql, /expected_revision = base_revision/);
    assert.match(sql, /revision > base_revision/);
    assert.match(sql, /response_value JSONB NOT NULL/);
  }

  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /request_fingerprint CHAR\(64\)/);
});

test("command boundary consulta replay antes do fencing e salva receipt antes do commit", () => {
  const command = source("src/lib/server/game-command.ts");
  const prepare = command.indexOf("await prepareGameCommandReceipt");
  const replay = command.indexOf("if (preparedReceipt?.replay)");
  const fence = command.indexOf("options.request.expectedRevision !== baseRevision");
  const execute = command.indexOf("const value = await execute(client)");
  const bump = command.indexOf("await bumpGameRevision(client, roomId)", execute);
  const save = command.indexOf("await saveGameCommandReceipt", bump);
  const commit = command.indexOf('await client.query("COMMIT")', save);

  assert.ok(prepare >= 0);
  assert.ok(replay > prepare);
  assert.ok(fence > replay);
  assert.ok(execute > fence);
  assert.ok(bump > execute);
  assert.ok(save > bump);
  assert.ok(commit > save);
  assert.match(command, /return preparedReceipt\.replay as GameCommandResult<T>/);

  const conditional = command.slice(
    command.indexOf("export async function gameConditionalCommand"),
  );
  assert.doesNotMatch(conditional, /GameCommandReceipt|prepareGameCommandReceipt|saveGameCommandReceipt/);
});

test("receipt rejeita reutilização conflitante e preserva resposta original", () => {
  const receipt = source("src/lib/server/game-command-receipt.ts");

  assert.match(receipt, /WHERE room_id=\$1 AND player_id=\$2 AND command_id=\$3/);
  assert.match(receipt, /receipt\.command_name !== request\.commandName/);
  assert.match(receipt, /receipt\.request_fingerprint !== fingerprint/);
  assert.match(receipt, /receipt\.expected_revision !== request\.expectedRevision/);
  assert.match(receipt, /value: receipt\.response_value/);
  assert.match(receipt, /baseRevision: receipt\.base_revision/);
  assert.match(receipt, /revision: receipt\.revision/);
  assert.match(receipt, /createHash\("sha256"\)/);
});

test("cliente envia uma identidade por comando e faz no máximo uma repetição", () => {
  const client = source("src/lib/client/game-command-client.ts");

  assert.match(client, /currentGameCommandRevision\(roomId\)/);
  assert.equal((client.match(/crypto\.randomUUID\(\)/g) ?? []).length, 1);
  assert.match(client, /headers\.set\(GAME_COMMAND_ID_HEADER, commandId\)/);
  assert.match(
    client,
    /headers\.set\(GAME_EXPECTED_REVISION_HEADER, String\(expectedRevision\)\)/,
  );
  assert.match(client, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(client, /recoverGameCommandRevision\(roomId, returnedRevision\)/);
});

test("todas as rotas humanas usadas por runGameCommand propagam metadata", () => {
  const routes = [
    "src/app/api/games/[roomId]/roll/route.ts",
    "src/app/api/games/[roomId]/phase/route.ts",
    "src/app/api/games/[roomId]/reinforce/route.ts",
    "src/app/api/games/[roomId]/maneuver/route.ts",
    "src/app/api/games/[roomId]/attack/route.ts",
    "src/app/api/games/[roomId]/attack/cancel/route.ts",
    "src/app/api/games/[roomId]/attack/roll/route.ts",
    "src/app/api/games/[roomId]/conquest/route.ts",
    "src/app/api/games/[roomId]/cards/trade/route.ts",
    "src/app/api/games/[roomId]/rematch/route.ts",
    "src/app/api/games/[roomId]/return-lobby/route.ts",
  ];

  for (const path of routes) {
    const route = source(path);
    assert.match(route, /readGameCommandRequestMetadata\(request\)/, path);
    assert.match(route, /metadata\)/, path);
  }
});

test("rolagens humanas são executadas por playerGameCommand e portanto são replay-safe", () => {
  const order = source("src/lib/server/game-command-service.ts");
  const combat = source("src/lib/server/game-combat-command-service.ts");

  assert.match(order, /"roll_order"[\s\S]*executeRollOrderDie/);
  assert.match(combat, /"attack\.roll"[\s\S]*executeRollBattleDice/);
  assert.match(combat, /playerGameCommand/);
});

test("reset da partida remove receipts antigos antes de criar a nova sessão de jogo", () => {
  const finish = source("src/lib/server/game-finish-command-service.ts");
  const deleteReceipt = finish.indexOf(
    'DELETE FROM game_command_receipts WHERE room_id=$1',
  );
  const deleteTerritories = finish.indexOf(
    'DELETE FROM game_territories WHERE room_id=$1',
  );

  assert.ok(deleteReceipt >= 0);
  assert.ok(deleteTerritories > deleteReceipt);
});
