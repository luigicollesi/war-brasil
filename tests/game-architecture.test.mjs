import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("command boundary serializa a sala e incrementa revisão antes do commit", () => {
  const source = readFileSync("src/lib/game-command.ts", "utf8");

  assert.match(source, /SELECT id,revision FROM game_rooms WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /const value = await execute\(client\)/);
  assert.match(source, /const revision = await bumpGameRevision\(client, roomId\)/);
  assert.match(source, /await client\.query\("COMMIT"\)/);

  assert.ok(
    source.indexOf("await bumpGameRevision") < source.indexOf('client.query("COMMIT")'),
  );
});

test("command condicional não incrementa revisão em no-op ou revisão obsoleta", () => {
  const source = readFileSync("src/lib/game-command.ts", "utf8");

  assert.match(source, /currentRevision !== expectedRevision/);
  assert.match(source, /changed: false/);
  assert.match(source, /result\.changed\s*\?\s*await bumpGameRevision/);
});

test("query boundary usa snapshot read-only sem row lock", () => {
  const source = readFileSync("src/lib/game-query.ts", "utf8");

  assert.match(
    source,
    /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/,
  );
  assert.doesNotMatch(source, /FOR UPDATE/);
});

test("snapshot principal é read-only e retorna fast-path por revisão", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/route.ts",
    "utf8",
  );
  const snapshot = readFileSync("src/lib/game-snapshot-service.ts", "utf8");

  assert.match(route, /getGameSnapshotQuery/);
  assert.doesNotMatch(route, /from "@\/src\/lib\/game"/);
  assert.match(route, /status: 204/);
  assert.match(route, /GAME_REVISION_HEADER/);

  assert.match(snapshot, /gameQuery/);
  assert.match(snapshot, /knownRevision !== null && room\.revision === knownRevision/);
  assert.doesNotMatch(snapshot, /FOR UPDATE/);
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

test("rotas mutáveis principais usam command services versionados", () => {
  const routes = [
    ["src/app/api/games/[roomId]/maneuver/route.ts", /maneuverCommand/],
    ["src/app/api/games/[roomId]/roll/route.ts", /rollOrderDieCommand/],
    ["src/app/api/games/[roomId]/reinforce/route.ts", /reinforceCommand/],
    ["src/app/api/games/[roomId]/cards/trade/route.ts", /tradeCardsCommand/],
    ["src/app/api/games/[roomId]/phase/route.ts", /phaseCommand/],
    ["src/app/api/games/[roomId]/attack/route.ts", /attackCommand/],
    ["src/app/api/games/[roomId]/attack/roll/route.ts", /rollBattleDiceCommand/],
    ["src/app/api/games/[roomId]/conquest/route.ts", /completeConquestCommand/],
  ];

  for (const [path, commandPattern] of routes) {
    const source = readFileSync(path, "utf8");
    assert.match(source, commandPattern);
    assert.doesNotMatch(source, /from "@\/src\/lib\/game"/);
    assert.match(source, /GAME_REVISION_HEADER/);
  }
});

test("avanço temporal usa expectedRevision e command condicional", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/advance/route.ts",
    "utf8",
  );
  const presentation = readFileSync(
    "src/lib/game-presentation-service.ts",
    "utf8",
  );

  assert.match(route, /expectedRevision/);
  assert.match(route, /advanceGamePresentationCommand/);
  assert.match(presentation, /gameConditionalCommand/);
  assert.match(presentation, /advanceOrderRollPresentation/);
  assert.match(presentation, /advanceBattlePresentation/);
});

test("cliente trata 204 sem substituir snapshot e avança apenas apresentações", () => {
  const source = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(source, /response\.status === 204/);
  assert.match(source, /GAME_REVISION_HEADER/);
  assert.match(source, /shouldAdvancePresentation/);
  assert.match(source, /\/advance/);

  const noContentBranch = source.match(
    /if \(response\.status === 204\) \{[\s\S]*?\n\s*\}/,
  )?.[0];
  assert.ok(noContentBranch);
  assert.doesNotMatch(noContentBranch, /setSnapshot/);
});
