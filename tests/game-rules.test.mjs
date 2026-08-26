import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidTrade, reinforcementBase, resolveBattle, tradeValue } from "../.test-build/game-rules.js";
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

test("valor global das trocas cresce conforme a sequência", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(tradeValue), [4, 6, 8, 10, 12, 15, 20, 25]);
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
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /owner_player_id=\$2 AND zone='hand'/);
  assert.match(source, /a\.room_id=\$1 AND a\.player_id=\$2/);
});

test("mutações críticas bloqueiam a sala antes de alterar o estado", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /FROM game_rooms WHERE id=\$1 FOR UPDATE/);
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

test("servidor persiste e renova o Túnel Jurássico por rodada", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /jurassic_tunnel_territory_id/);
  assert.match(source, /round_number/);
  assert.match(source, /territoryId!==1&&territoryId!==3/);
  assert.match(source, /advanceJurassicTunnelRound/);
  assert.match(source, /round_number=round_number\+1,jurassic_tunnel_territory_id=\$2/);
});

test("ataque aceita fronteira normal passável ou Túnel Jurássico", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  const attack = source.match(
    /export async function attack[\s\S]*?(?=\n\nexport async function rollBattleDice)/,
  )?.[0];
  assert.ok(attack);
  assert.match(attack, /isJurassicTunnelConnection/);
  assert.match(attack, /if\(!tunnelActive&&!connection\.exists\)/);
  assert.match(attack, /if\(!tunnelActive&&!connection\.passable\)/);
});

test("manobra alcança territórios próprios por cadeia de conexões", () => {
  const connections = [
    {
      territoryA: 1,
      territoryB: 2,
      exists: true,
      passable: true,
      barrierName: null,
      description: null,
    },
    {
      territoryA: 2,
      territoryB: 3,
      exists: true,
      passable: true,
      barrierName: null,
      description: null,
    },
    {
      territoryA: 3,
      territoryB: 4,
      exists: true,
      passable: true,
      barrierName: null,
      description: null,
    },
  ];

  assert.deepEqual(
    new Set(reachableTerritoryIds(connections, 1, [1, 2, 3])),
    new Set([1, 2, 3]),
  );

  assert.equal(
    reachableTerritoryIds(connections, 1, [1, 2, 3]).includes(4),
    false,
  );
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

test("backend da manobra valida caminho contínuo por territórios próprios", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");

  const maneuver = source.match(
    /export async function maneuver[\s\S]*?(?=\nasync function drawCard)/,
  )?.[0];

  assert.ok(maneuver);
  assert.match(maneuver, /reachableTerritoryIds/);
  assert.match(maneuver, /jurassicTunnelConnection/);
  assert.doesNotMatch(
    maneuver,
    /const connection=await getTerritoryConnection\(client,from,to\)/,
  );
});

test("modal de troca renderiza as cartas da mão", () => {
  const source = readFileSync("src/components/game-client.tsx", "utf8");

  assert.match(
    source,
    /Selecione três cartas na sua mão[\s\S]*snapshot\.myCards\.map/,
  );
});

test("combate sincronizado persiste etapas e rolagens separadas", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /"awaiting_attacker_roll"/);
  assert.match(source, /"awaiting_defender_roll"/);
  assert.match(source, /export async function rollBattleDice/);
  assert.match(source, /advanceBattlePresentation/);
});

test("rolagem de combate valida atacante e defensor pelo estágio, sem turno global", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  const rollBattleDice = source.match(
    /export async function rollBattleDice[\s\S]*?(?=\nexport async function completeConquest)/,
  )?.[0];
  assert.ok(rollBattleDice);
  assert.doesNotMatch(rollBattleDice, /assertTurn\(/);
  assert.match(rollBattleDice, /battle\.stage==="awaiting_attacker_roll"/);
  assert.match(rollBattleDice, /player\.id!==battle\.attackerPlayerId/);
  assert.match(rollBattleDice, /battle\.stage==="awaiting_defender_roll"/);
  assert.match(rollBattleDice, /player\.id!==battle\.defenderPlayerId/);
});

test("último dado do sorteio permanece visível antes de avançar", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /ORDER_ROLL_PRESENTATION_MS\s*=\s*2_000/);
  assert.match(source, /advanceOrderRollPresentation/);
  assert.match(source, /rolled_at\.getTime\(\)/);

  const rollOrderDie = source.match(
    /export async function rollOrderDie[\s\S]*?(?=\n\nasync function beginReinforcement)/,
  )?.[0];

  assert.ok(rollOrderDie);
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
  assert.match(source, /drop-shadow/);
});

test("Túnel Jurássico usa curva derivada dos anchors do SVG", () => {
  const source = readFileSync("src/components/jurassic-tunnel-connection.tsx", "utf8");
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const arrow = readFileSync("src/components/territory-arrow.tsx", "utf8");
  assert.match(source, /Math\.hypot\(dx, dy\)/);
  assert.match(source, /normalX = -dy \/ distance/);
  assert.match(source, /Math\.min\(distance \* 0\.15, MAX_CURVE\)/);
  assert.match(source, / Q \$\{controlX\} \$\{controlY\}/);
  assert.match(source, /viewBox="0 0 1254 1254"/);
  assert.match(source, /Túnel Jurássico/);
  assert.match(source, /Acre ↔/);
  assert.match(board, /getTerritoryAnchor\(path\)/);
  assert.match(arrow, /pathElement\.getBBox\(\)/);
});

test("conquista libera o resultado antes da transferência", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");

  const presentation = source.match(
    /async function advanceBattlePresentation[\s\S]*?(?=\n\nasync function advanceOrderRollPresentation)/,
  )?.[0];

  assert.ok(presentation);
  assert.match(
    presentation,
    /battle\.stage==="show_battle_result"\) await saveBattle\(client,room,null\)/,
  );
  assert.doesNotMatch(
    presentation,
    /show_battle_result"&&!room\.pending_from_territory_id/,
  );

  const conquest = source.match(
    /export async function completeConquest[\s\S]*?(?=\nexport async function maneuver)/,
  )?.[0];

  assert.ok(conquest);
  assert.match(conquest, /await advanceBattlePresentation\(client,room\)/);
});

test("snapshot não executa queries concorrentes no mesmo PoolClient", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");

  const snapshot = source.match(
    /async function snapshot[\s\S]*?(?=\n}\nexport async function getGameSnapshot)/,
  )?.[0];

  assert.ok(snapshot);
  assert.doesNotMatch(snapshot, /Promise\.all/);
});

test("layout declara scroll smooth para transições do Next", () => {
  const source = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(source, /data-scroll-behavior="smooth"/);
});

test("setas usam a geometria do path no viewBox do mapa", () => {
  const source = readFileSync("src/components/territory-arrow.tsx", "utf8");
  assert.match(source, /pathElement\.getBBox\(\)/);
  assert.match(source, /viewBox="0 0 1254 1254"/);
});
