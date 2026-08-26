import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextGamePollDelay } from "../.test-build/game-polling.js";

test("polling adapta intervalo a visibilidade, falhas e estado offline", () => {
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 0,
      presentationPending: false,
    }),
    1_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: false,
      online: true,
      failures: 0,
      presentationPending: false,
    }),
    5_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: false,
      online: true,
      failures: 0,
      presentationPending: true,
    }),
    2_500,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 1,
      presentationPending: false,
    }),
    2_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 3,
      presentationPending: false,
    }),
    8_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: false,
      failures: 0,
      presentationPending: false,
    }),
    15_000,
  );
});

test("game sync usa scheduler adaptativo e sincroniza imediatamente ao voltar", () => {
  const source = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(source, /nextGamePollDelay/);
  assert.match(source, /document\.visibilityState/);
  assert.match(source, /consecutiveFailures/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /handleOnline/);
  assert.doesNotMatch(source, /const POLLING_INTERVAL_MS/);
});

test("snapshot preserva referências de slices inalterados", () => {
  const sharing = readFileSync("src/lib/game-snapshot-sharing.ts", "utf8");
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(sharing, /shareGameSnapshot/);
  assert.match(sharing, /previous\.territories/);
  assert.match(sharing, /previous\.players/);
  assert.match(sharing, /previous\.connections/);
  assert.match(sharing, /return previous;/);
  assert.match(sync, /shareGameSnapshot\(/);
});

test("rede viária agrupa rotas base e individualiza somente destaques", () => {
  const source = readFileSync("src/components/road-network.tsx", "utf8");

  assert.match(source, /basePath: base\.join\(" "\)/);
  assert.match(source, /road-route-base/);
  assert.match(source, /layers\.highlighted\.map/);
  assert.match(source, /connectedToSelection \|\| reachesTarget/);
  assert.doesNotMatch(source, /roadPaths\.map\(/);
});

test("mobile usa budget de GPU reduzido sem alterar acabamento desktop", () => {
  const page = readFileSync("src/app/game/[roomId]/page.tsx", "utf8");
  const css = readFileSync(
    "src/app/game/[roomId]/game-performance.css",
    "utf8",
  );

  assert.match(page, /game-roads\.css["'];\nimport ["']\.\/game-performance\.css/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /backdrop-filter: blur\(10px\)/);
  assert.match(css, /\.road-route-shadow \{[\s\S]*?filter: none;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /transition: none !important/);
});

test("objetivos usam agregações específicas em vez de materializar o tabuleiro inteiro", () => {
  const source = readFileSync("src/lib/game-objective-service.ts", "utf8");

  assert.match(source, /COUNT\(\*\)::int count/);
  assert.match(source, /SELECT EXISTS\(/);
  assert.match(source, /ownedTerritoryIds/);
  assert.match(source, /eventCanAffectObjective/);
  assert.match(source, /type ObjectiveEvent/);
  assert.doesNotMatch(source, /SELECT territory_id,troops,owner_player_id/);
});

test("mudanças apenas de tropas não reavaliam objetivos de domínio", () => {
  const service = readFileSync(
    "src/lib/game-troop-command-service.ts",
    "utf8",
  );
  const reinforcementRoute = readFileSync(
    "src/app/api/games/[roomId]/reinforce/route.ts",
    "utf8",
  );
  const tradeRoute = readFileSync(
    "src/app/api/games/[roomId]/cards/trade/route.ts",
    "utf8",
  );

  assert.match(service, /"troops_changed"/);
  assert.match(service, /changedTroops/);
  assert.match(reinforcementRoute, /game-troop-command-service/);
  assert.match(tradeRoute, /game-troop-command-service/);
});

test("combate avalia objetivo somente quando controle territorial muda", () => {
  const source = readFileSync("src/lib/game-battle-service.ts", "utf8");
  const survivingDefense = source.match(
    /if \(defenderTroops > 0\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(survivingDefense);
  assert.doesNotMatch(survivingDefense, /objectiveWon/);
  assert.match(source, /"territory_control_changed"/);
});

test("transferência pós-conquista reavalia somente objetivos afetados por tropas", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/conquest/route.ts",
    "utf8",
  );
  const service = readFileSync(
    "src/lib/game-conquest-command-service.ts",
    "utf8",
  );

  assert.match(route, /game-conquest-command-service/);
  assert.match(service, /"troops_changed"/);
  assert.match(service, /advanceBattlePresentation/);
  assert.match(service, /saveBattle/);
});

test("topologia fixa atravessa a rede apenas quando a versão muda", () => {
  const contract = readFileSync("src/lib/game-sync-contract.ts", "utf8");
  const route = readFileSync(
    "src/app/api/games/[roomId]/route.ts",
    "utf8",
  );
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(contract, /GAME_TOPOLOGY_HEADER/);
  assert.match(contract, /GAME_TOPOLOGY_VERSION/);
  assert.match(route, /knownTopology === GAME_TOPOLOGY_VERSION/);
  assert.match(route, /revisionForFastPath/);
  assert.match(route, /delete dynamicSnapshot\.connections/);
  assert.match(sync, /topologyVersionRef/);
  assert.match(sync, /topologyConnectionsRef/);
  assert.match(sync, /GAME_TOPOLOGY_HEADER/);
  assert.match(sync, /payload\.connections \?\? topologyConnectionsRef\.current/);
});

test("reforço e manobra retornam patches autoritativos ligados à revisão base", () => {
  const command = readFileSync("src/lib/game-command.ts", "utf8");
  const reinforce = readFileSync(
    "src/app/api/games/[roomId]/reinforce/route.ts",
    "utf8",
  );
  const maneuver = readFileSync(
    "src/app/api/games/[roomId]/maneuver/route.ts",
    "utf8",
  );
  const maneuverService = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(command, /const baseRevision = await lockRoomRevision/);
  assert.match(command, /return \{ value, baseRevision, revision \}/);
  assert.match(reinforce, /baseRevision: result\.baseRevision/);
  assert.match(reinforce, /patch: result\.value/);
  assert.match(maneuver, /baseRevision: result\.baseRevision/);
  assert.match(maneuver, /patch: result\.value/);
  assert.match(maneuverService, /RETURNING troops,moved_in_turn/);
});

test("command patch só é aplicado sobre a revisão base e refresh vira no-op quando já observado", () => {
  const client = readFileSync("src/lib/game-command-client.ts", "utf8");
  const bus = readFileSync("src/lib/game-command-patch-bus.ts", "utf8");
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");
  const patch = readFileSync("src/lib/game-command-patch.ts", "utf8");

  assert.match(client, /dispatchGameCommandPatch/);
  assert.match(bus, /registerGameCommandPatchHandler/);
  assert.match(sync, /revisionRef\.current !== result\.baseRevision/);
  assert.match(sync, /applyGameCommandPatch/);
  assert.match(sync, /revisionRef\.current >= minimumRevision/);
  assert.match(patch, /matched !== updates\.size/);
});
