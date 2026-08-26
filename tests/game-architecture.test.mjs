import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("command boundary serializa a sala e incrementa revisão antes do commit", () => {
  const source = readFileSync("src/lib/game-command.ts", "utf8");

  assert.match(source, /SELECT id FROM game_rooms WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /const value = await execute\(client\)/);
  assert.match(source, /const revision = await bumpGameRevision\(client, roomId\)/);
  assert.match(source, /await client\.query\("COMMIT"\)/);

  assert.ok(
    source.indexOf("await bumpGameRevision") < source.indexOf('client.query("COMMIT")'),
  );
});

test("query boundary usa snapshot read-only sem row lock", () => {
  const source = readFileSync("src/lib/game-query.ts", "utf8");

  assert.match(
    source,
    /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/,
  );
  assert.doesNotMatch(source, /FOR UPDATE/);
});

test("endpoint leve de revisão valida jogador dentro de transação read-only", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/revision/route.ts",
    "utf8",
  );
  const revision = readFileSync("src/lib/game-revision.ts", "utf8");

  assert.match(route, /gameQuery/);
  assert.match(route, /readPlayerGameRevision/);
  assert.match(revision, /JOIN room_players rp/);
  assert.match(revision, /rp\.player_session=\$2/);
});

test("manobra e sorteio já usam o command service versionado", () => {
  const maneuver = readFileSync(
    "src/app/api/games/[roomId]/maneuver/route.ts",
    "utf8",
  );
  const roll = readFileSync(
    "src/app/api/games/[roomId]/roll/route.ts",
    "utf8",
  );

  assert.match(maneuver, /maneuverCommand/);
  assert.doesNotMatch(maneuver, /from "@\/src\/lib\/game"/);
  assert.match(maneuver, /GAME_REVISION_HEADER/);

  assert.match(roll, /rollOrderDieCommand/);
  assert.doesNotMatch(roll, /from "@\/src\/lib\/game"/);
  assert.match(roll, /GAME_REVISION_HEADER/);
});
