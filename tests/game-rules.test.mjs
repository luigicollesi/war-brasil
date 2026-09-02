import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidTrade, reinforcementBase, reinforcementFor, resolveBattle, tradeValue } from "../.test-build/game-rules.js";
import {
  findTerritoryConnection,
  isJurassicTunnelConnection,
  jurassicTunnelConnection,
  reachableTerritoryIds,
} from "../.test-build/territory-connections.js";

test("reforços usam mínimo de três e metade dos territórios", () => {
  assert.equal(reinforcementBase(1), 3);
  assert.equal(reinforcementBase(7), 3);
  assert.equal(reinforcementBase(12), 6);
});

test("domínio do Nordeste soma seis tropas ao reforço base", () => {
  const nordeste = [12, 14, 15, 16, 17, 23, 30, 31, 32, 33, 34, 38, 39];
  assert.equal(nordeste.length, 13);
  assert.equal(reinforcementBase(nordeste.length), 6);
  assert.equal(reinforcementFor(nordeste), 12);
});

test("dados são comparados do maior para o menor", () => {
  assert.deepEqual(resolveBattle([1, 6, 4], [5, 3, 2]), {
    attacker: [6, 4, 1], defender: [5, 3, 2], attackerLosses: 1, defenderLosses: 2,
  });
});

test("empate favorece a defesa", () => {
  const result = resolveBattle([6, 4, 2], [6, 3, 1]);
  assert.equal(result.attackerLosses, 1);
  assert.equal(result.defenderLosses, 2);
});

test("trocas aceitam trincas, mistura e coringa", () => {
  assert.equal(isValidTrade(["leaf", "leaf", "leaf"]), true);
  assert.equal(isValidTrade(["leaf", "gold", "water"]), true);
  assert.equal(isValidTrade(["gold", "gold", "wild"]), true);
  assert.equal(isValidTrade(["leaf", "gold", "gold"]), false);
});

test("valor individual das trocas cresce uma tropa por troca", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(tradeValue), [4, 5, 6, 7, 8, 9, 10, 11]);
});

test("trocas usam progressão individual e preservam bônus territorial separado", () => {
  const source = readFileSync("src/lib/server/game-troop-command-service.ts", "utf8");

  assert.match(source, /card_trade_count=card_trade_count\+1/);
  assert.match(source, /RETURNING card_trade_count-1 trade_count_before/);
  assert.match(source, /tradeValue\(tradeProgress\.trade_count_before\)/);
  assert.match(source, /SET troops=troops\+\$3/);
  assert.match(source, /OWNED_TERRITORY_CARD_BONUS/);
  assert.match(source, /reinforcements_remaining=reinforcements_remaining\+\$2/);
  assert.doesNotMatch(source, /tradeValue\(room\.trade_count\)/);
});

test("contador individual de trocas existe no schema e é zerado em nova partida", () => {
  const migration = readFileSync(
    "src/lib/db/migrations/015-player-card-trade-count.sql",
    "utf8",
  );
  const schema = readFileSync("src/lib/db/schema.sql", "utf8");
  const finish = readFileSync("src/lib/server/game-finish-command-service.ts", "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS card_trade_count/);
  assert.match(schema, /card_trade_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(finish, /card_trade_count=0/);
});

test("resoluções críticas independentes têm apenas um vencedor", () => {
  assert.equal(resolveBattle([6], [1]).defenderLosses, 1);
  assert.equal(resolveBattle([1], [6]).attackerLosses, 1);
});

test("conquista só ocorre quando a defesa perde a última tropa", () => {
  const conquered = resolveBattle([6, 5, 4], [1, 1, 1]);
  assert.equal(conquered.defenderLosses, 3);
  const held = resolveBattle([1], [6]);
  assert.equal(held.defenderLosses, 0);
});

test("snapshot consulta objetivo e cartas somente do jogador da sessão", () => {
  const source = readFileSync("src/lib/server/game-snapshot-service.ts", "utf8");
  assert.match(source, /owner_player_id=\$2 AND zone='hand'/);
  assert.match(source, /a\.room_id=\$1 AND a\.player_id=\$2/);
});

test("mutações críticas bloqueiam a sala antes de alterar o estado", () => {
  const source = readFileSync("src/lib/server/game-command.ts", "utf8");
  assert.match(source, /SELECT id,revision FROM game_rooms WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /await client\.query\("BEGIN"\)/);
});

test("conexões militares são simétricas e respeitam barreiras", () => {
  const connections = [{ territoryA: 2, territoryB: 7, exists: true, passable: false, barrierName: "Floresta Amazônica", description: "Barreira." }];
  assert.equal(findTerritoryConnection(connections, 7, 2).passable, false);
  assert.equal(findTerritoryConnection(connections, 2, 8).exists, false);
});

test("Túnel Jurássico é bidirecional e prefere a conexão especial passável", () => {
  const tunnel = jurassicTunnelConnection(25);
  assert.ok(tunnel);
  assert.equal(isJurassicTunnelConnection(25, 3, 25), true);
  assert.equal(isJurassicTunnelConnection(25, 25, 3), true);
  assert.equal(isJurassicTunnelConnection(25, 3, 24), false);

  const blockedNormal = {
    territoryA: 3,
    territoryB: 25,
    exists: true,
    passable: false,
    barrierName: "Barreira natural",
    description: null,
  };
  assert.equal(findTerritoryConnection([blockedNormal, tunnel], 3, 25).barrierName, "Túnel Jurássico");
  assert.equal(findTerritoryConnection([blockedNormal, tunnel], 3, 25).passable, true);
});

test("servidor renova o Túnel Jurássico ao virar a rodada", () => {
  const command = readFileSync("src/lib/server/game-command-service.ts", "utf8");
  const roundService = readFileSync("src/lib/server/game-round-service.ts", "utf8");
  const roundRules = readFileSync("src/lib/shared/game-round-rules.ts", "utf8");

  assert.match(command, /advanceGameRound/);
  assert.match(command, /previousJurassicTunnelDestinationId/);
  assert.doesNotMatch(command, /advanceJurassicTunnelRound/);
  assert.doesNotMatch(command, /chooseJurassicTunnelDestination/);

  assert.match(roundService, /chooseJurassicTunnelDestination/);
  assert.match(
    roundService,
    /SET round_number=\$2,jurassic_tunnel_territory_id=\$3/,
  );

  assert.match(roundRules, /JURASSIC_TUNNEL_EXCLUDED_TERRITORY_ID = 1/);
  assert.match(roundRules, /JURASSIC_TUNNEL_SOURCE_ID = 3/);
  assert.match(roundRules, /territoryId !== previousDestination/);
});

test("ataque classifica combate usando a topologia efetiva da rodada", () => {
  const source = readFileSync("src/lib/server/game-combat-command-service.ts", "utf8");
  assert.match(source, /getEffectiveGameTopology/);
  assert.match(source, /isAttackOriginBlocked/);
  assert.match(source, /findTerritoryConnection\(\s*topology\.connections/);
  assert.match(source, /connection\.passable \? "normal" : "barrier"/);
  assert.match(source, /attackProfile/);
  assert.doesNotMatch(source, /getBaseTerritoryConnection/);
  assert.doesNotMatch(source, /isJurassicTunnelConnection/);
});

test("manobra alcança territórios próprios por cadeia de conexões", () => {
  const connections = [
    { territoryA: 1, territoryB: 2, exists: true, passable: true, barrierName: null, description: null },
    { territoryA: 2, territoryB: 3, exists: true, passable: true, barrierName: null, description: null },
    { territoryA: 3, territoryB: 4, exists: true, passable: true, barrierName: null, description: null },
  ];

  assert.deepEqual(
    new Set(reachableTerritoryIds(connections, 1, [1, 2, 3])),
    new Set([1, 2, 3]),
  );
  assert.equal(reachableTerritoryIds(connections, 1, [1, 2, 3]).includes(4), false);
});

test("Túnel Jurássico participa da cadeia de manobra", () => {
  const tunnel = jurassicTunnelConnection(20);
  assert.ok(tunnel);
  const connections = [
    tunnel,
    { territoryA: 20, territoryB: 21, exists: true, passable: true, barrierName: null, description: null },
  ];
  assert.deepEqual(
    new Set(reachableTerritoryIds(connections, 3, [3, 20, 21])),
    new Set([3, 20, 21]),
  );
});
test("backend da manobra recalcula a melhor rota usando a topologia efetiva", () => {
  const source = readFileSync("src/lib/server/game-maneuver-command-service.ts", "utf8");
  assert.match(source, /bestTerritoryRoute/);
  assert.match(source, /maneuverTraversalProfile/);
  assert.match(source, /getEffectiveGameTopology/);
  assert.match(source, /topology\.connections/);
  assert.doesNotMatch(source, /reachableTerritoryIds/);
  assert.doesNotMatch(source, /getPassableTerritoryConnections/);
  assert.doesNotMatch(source, /getBaseTerritoryConnections/);
  assert.doesNotMatch(source, /effectiveTerritoryConnections/);
  assert.doesNotMatch(source, /FROM territory_connections/);
});

test("modal de troca renderiza as cartas da mão", () => {
  const source = readFileSync("src/components/game-turn-panel.tsx", "utf8");
  assert.match(source, /Selecione três cartas na sua mão[\s\S]*snapshot\.myCards\.map/);
});

test("combate sincronizado persiste etapas e rolagens separadas", () => {
  const battle = readFileSync("src/lib/server/game-battle-service.ts", "utf8");
  const commands = readFileSync("src/lib/server/game-combat-command-service.ts", "utf8");
  assert.match(commands, /"awaiting_attacker_roll"/);
  assert.match(commands, /"awaiting_defender_roll"/);
  assert.match(commands, /export async function rollBattleDiceCommand/);
  assert.match(commands, /advanceBattlePresentation/);
  assert.match(battle, /nextBattlePresentationTransition/);
});

test("rolagem de combate valida atacante e defensor pelo estágio, sem turno global", () => {
  const source = readFileSync("src/lib/server/game-combat-command-service.ts", "utf8");
  const executeRollBattleDiceStart = source.indexOf(
    "export async function executeRollBattleDice",
  );
  const executeRollBattleDiceEnd = source.indexOf(
    "export async function attackCommand",
    executeRollBattleDiceStart,
  );
  assert.ok(executeRollBattleDiceStart >= 0);
  assert.ok(executeRollBattleDiceEnd > executeRollBattleDiceStart);

  const rollBattleDice = source.slice(
    executeRollBattleDiceStart,
    executeRollBattleDiceEnd,
  );
  assert.doesNotMatch(rollBattleDice, /assertAttackTurn\(/);
  assert.match(rollBattleDice, /battle\.stage === "awaiting_attacker_roll"/);
  assert.match(rollBattleDice, /player\.id !== battle\.attackerPlayerId/);
  assert.match(rollBattleDice, /battle\.stage === "awaiting_defender_roll"/);
  assert.match(rollBattleDice, /player\.id !== battle\.defenderPlayerId/);
});

test("último dado do sorteio permanece visível antes de avançar", () => {
  const transitions = readFileSync("src/lib/shared/game-transitions.ts", "utf8");
  const presentation = readFileSync("src/lib/server/game-presentation-service.ts", "utf8");
  const commands = readFileSync("src/lib/server/game-command-service.ts", "utf8");

  assert.match(transitions, /ORDER_ROLL_PRESENTATION_MS\s*=\s*2_000/);
  assert.match(presentation, /isOrderRollPresentationDue/);
  assert.match(presentation, /rolled_at\.getTime\(\)/);

  const rollOrderDie = commands.slice(
    commands.indexOf("export async function rollOrderDieCommand"),
    commands.indexOf("export async function phaseCommand"),
  );
  assert.ok(rollOrderDie.length > 0);
  assert.doesNotMatch(rollOrderDie, /order_roll_round=order_roll_round\+1/);
  assert.doesNotMatch(rollOrderDie, /status='playing'/);
});

test("territórios mantêm borda brilhante conforme a região", () => {
  const source = readFileSync("src/components/interactive-board.tsx", "utf8");
  assert.match(source, /const regionBorders/);
  assert.match(source, /norte:/);
  assert.match(source, /nordeste:/);
  assert.match(source, /"centro-oeste":/);
  assert.match(source, /sudeste:/);
  assert.match(source, /sul:/);
  assert.match(source, /path\.style\.stroke\s*=\s*regionStyle\.stroke/);
});

test("Túnel Jurássico usa curva derivada das geometrias calculadas do SVG", () => {
  const source = readFileSync("src/components/jurassic-tunnel-connection.tsx", "utf8");
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const svgGeometry = readFileSync("src/lib/territory-svg-geometry.ts", "utf8");
  assert.match(source, /Math\.hypot\(dx, dy\)/);
  assert.match(source, /normalX = -dy \/ distance/);
  assert.match(source, /Math\.min\(distance \* 0\.15, MAX_CURVE\)/);
  assert.match(source, / Q \$\{controlX\} \$\{controlY\}/);
  assert.match(source, /viewBox="0 0 1254 1254"/);
  assert.match(source, /Túnel Jurássico/);
  assert.match(source, /Acre ↔/);
  assert.match(board, /territoryGeometryFromPath\(path\)/);
  assert.match(board, /geometries\.get\(3\)/);
  assert.match(svgGeometry, /pathElement\.getBBox\(\)/);
});

test("conquista libera o resultado antes da transferência", () => {
  const battle = readFileSync("src/lib/server/game-battle-service.ts", "utf8");
  const conquest = readFileSync("src/lib/server/game-conquest-command-service.ts", "utf8");
  assert.match(battle, /saveBattle\(client, room, null\)/);
  assert.match(conquest, /await advanceBattlePresentation\(client, room\)/);
});

test("snapshot não executa queries concorrentes no mesmo PoolClient", () => {
  const source = readFileSync("src/lib/server/game-snapshot-service.ts", "utf8");
  assert.doesNotMatch(source, /Promise\.all/);
});

test("layout declara scroll smooth para transições do Next", () => {
  const source = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(source, /data-scroll-behavior="smooth"/);
});

test("setas delegam o cálculo de geometria do path e mantêm o viewBox do mapa", () => {
  const source = readFileSync("src/components/territory-arrow.tsx", "utf8");
  const svgGeometry = readFileSync("src/lib/territory-svg-geometry.ts", "utf8");
  assert.match(source, /territoryGeometryFromPath\(pathElement\)/);
  assert.match(svgGeometry, /pathElement\.getBBox\(\)/);
  assert.match(source, /viewBox="0 0 1254 1254"/);
});
