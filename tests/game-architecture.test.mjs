import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("command boundary serializa a sala e incrementa revisão antes do commit", () => {
  const source = readFileSync("src/lib/server/game-command.ts", "utf8");

  assert.match(source, /SELECT id,revision FROM game_rooms WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /const value = await execute\(client\)/);
  assert.match(source, /const revision = await bumpGameRevision\(client, roomId\)/);
  assert.match(source, /await client\.query\("COMMIT"\)/);

  assert.ok(
    source.indexOf("await bumpGameRevision") < source.indexOf('client.query("COMMIT")'),
  );
});

test("command condicional não incrementa revisão em no-op ou revisão obsoleta", () => {
  const source = readFileSync("src/lib/server/game-command.ts", "utf8");

  assert.match(source, /currentRevision !== expectedRevision/);
  assert.match(source, /changed: false/);
  assert.match(source, /result\.changed\s*\?\s*await bumpGameRevision/);
});

test("query boundary usa snapshot read-only sem row lock", () => {
  const source = readFileSync("src/lib/server/game-query.ts", "utf8");

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
  const snapshot = readFileSync("src/lib/server/game-snapshot-service.ts", "utf8");

  assert.match(route, /getGameSnapshotQuery/);
  assert.doesNotMatch(route, /from "@\/src\/lib\/game"/);
  assert.match(route, /status: 204/);
  assert.match(route, /GAME_REVISION_HEADER/);

  assert.match(snapshot, /gameQuery/);
  assert.match(snapshot, /knownRevision !== null && room\.revision === knownRevision/);
  assert.doesNotMatch(snapshot, /FOR UPDATE/);
});

test("advance valida acesso do jogador dentro de transação read-only", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/advance/route.ts",
    "utf8",
  );
  const revision = readFileSync("src/lib/server/game-revision.ts", "utf8");

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

test("avanço automático usa expectedRevision e um command condicional", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/advance/route.ts",
    "utf8",
  );
  const automation = readFileSync(
    "src/lib/server/game-automation-service.ts",
    "utf8",
  );
  const presentation = readFileSync(
    "src/lib/server/game-presentation-service.ts",
    "utf8",
  );

  assert.match(route, /expectedRevision/);
  assert.match(route, /advanceGameAutomationCommand/);
  assert.match(automation, /gameConditionalCommand/);
  assert.match(automation, /advanceGamePresentation/);
  assert.match(automation, /advanceBotAutomation/);
  assert.match(presentation, /advanceOrderRollPresentation/);
  assert.match(presentation, /advanceBattlePresentation/);
});

test("cliente trata 204 sem substituir snapshot e exige revisão mínima após comandos", () => {
  const source = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(source, /response\.status === 204/);
  assert.match(source, /GAME_REVISION_HEADER/);
  assert.match(source, /shouldAdvancePresentation/);
  assert.match(source, /\/advance/);
  assert.match(source, /requiredRevisionRef/);
  assert.match(source, /minimumRevision/);

  const noContentBranch = source.match(
    /if \(response\.status === 204\) \{[\s\S]*?\n\s*\}/,
  )?.[0];
  assert.ok(noContentBranch);
  assert.doesNotMatch(noContentBranch, /setSnapshot/);
});

test("interação do mapa não reconstrói cliques por selectionVersion ou mapHints em effect", () => {
  const client = readFileSync("src/components/game-client-v2.tsx", "utf8");
  const panel = readFileSync("src/components/game-turn-panel.tsx", "utf8");
  const interaction = readFileSync("src/hooks/use-game-interaction.ts", "utf8");

  assert.match(client, /useGameInteraction/);
  assert.doesNotMatch(client, /selectionVersion/);
  assert.doesNotMatch(client, /setMapHints/);
  assert.doesNotMatch(panel, /onMapHints/);
  assert.doesNotMatch(panel, /handledSelectionVersion/);
  assert.match(interaction, /onTerritoryClick/);
  assert.match(interaction, /deriveMapHints/);
});

test("estado visual do tabuleiro é derivado da state machine", () => {
  const source = readFileSync("src/lib/game-interaction.ts", "utf8");

  assert.match(source, /gameInteractionReducer/);
  assert.match(source, /deriveMapHints/);
  assert.match(source, /deriveInteractionArrow/);
  assert.match(source, /deriveSelectedTerritoryId/);
  assert.match(source, /scopeKey/);
});

test("tooltip move por RAF sem setState no pointermove e paths ficam cacheados", () => {
  const source = readFileSync("src/components/interactive-board.tsx", "utf8");

  assert.match(source, /pathsByIdRef/);
  assert.match(source, /visualSignatureRef/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /translate3d/);
  assert.match(source, /root\.addEventListener\("pointermove"/);
  assert.doesNotMatch(source, /setHovered\(\{details:/);
  assert.match(source, /: "none";/);
});

test("estradas desligadas não permanecem montadas no SVG overlay", () => {
  const source = readFileSync("src/components/interactive-board.tsx", "utf8");
  assert.match(source, /roadsVisible \? \([\s\S]*?<RoadNetwork/);
});

test("indicador de conexão reutiliza o polling do jogo sem health check próprio", () => {
  const indicator = readFileSync(
    "src/components/server-connection-indicator.tsx",
    "utf8",
  );
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(indicator, /useSyncExternalStore/);
  assert.match(indicator, /gameSyncMetricsStore/);
  assert.doesNotMatch(indicator, /\/api\/health/);
  assert.match(sync, /recordSuccess/);
  assert.match(sync, /recordFailure/);
});

test("topologia base permanece cacheada e gameplay usa uma única topologia efetiva", () => {
  const topology = readFileSync("src/lib/server/game-topology-service.ts", "utf8");
  const effective = readFileSync(
    "src/lib/server/game-effective-topology-service.ts",
    "utf8",
  );
  const combat = readFileSync("src/lib/server/game-combat-command-service.ts", "utf8");
  const maneuver = readFileSync("src/lib/server/game-maneuver-command-service.ts", "utf8");

  assert.match(topology, /cachedTopology/);
  assert.match(topology, /loadingTopology/);
  assert.match(topology, /FROM territory_connections/);
  assert.match(effective, /getBaseTerritoryConnections/);
  assert.match(effective, /getRoomRoundEvent/);
  assert.match(effective, /effectiveGameConnections/);
  assert.match(combat, /getEffectiveGameTopology/);
  assert.match(maneuver, /getEffectiveGameTopology/);
  assert.doesNotMatch(combat, /getBaseTerritoryConnection|isJurassicTunnelConnection/);
  assert.doesNotMatch(maneuver, /getBaseTerritoryConnections|effectiveTerritoryConnections/);
  assert.doesNotMatch(combat, /FROM territory_connections/);
  assert.doesNotMatch(maneuver, /FROM territory_connections/);
});

test("efeitos permanentes só alteram tropas e nunca a topologia base", () => {
  const source = readFileSync(
    "src/lib/events/event-effects-service.ts",
    "utf8",
  );

  assert.match(source, /MIN_TERRITORY_TROOPS/);
  assert.match(source, /UPDATE game_territories/);
  assert.match(source, /GREATEST\(\$\{MIN_TERRITORY_TROOPS\},troops-\$3\)/);
  assert.match(
    source,
    /LEAST\(moved_in_turn,GREATEST\(\$\{MIN_TERRITORY_TROOPS\},troops-\$3\)\)/,
  );
  assert.doesNotMatch(source, /UPDATE territory_connections/);
});

test("evento de gameplay é lido pela rodada exata e resolved_effects é validado", () => {
  const repository = readFileSync(
    "src/lib/events/event-repository.ts",
    "utf8",
  );

  assert.match(repository, /export async function getRoomRoundEvent/);
  assert.match(repository, /WHERE room_id=\$1 AND round_number=\$2/);
  assert.match(repository, /parseResolvedEventEffects\(row\.resolved_effects\)/);
});

test("artefatos legados do fluxo de jogo não permanecem no projeto", () => {
  for (const path of [
    "src/lib/game.ts",
    "src/components/game-client.tsx",
    "src/lib/territory-connections.server.ts",
    "src/app/api/games/[roomId]/revision/route.ts",
  ]) {
    assert.equal(existsSync(path), false, `${path} deveria ter sido removido`);
  }
});
