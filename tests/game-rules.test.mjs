import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidTrade, reinforcementBase, resolveBattle, tradeValue } from "../.test-build/game-rules.js";
import { findTerritoryConnection } from "../.test-build/territory-connections.js";

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

test("combate sincronizado persiste etapas e rolagens separadas", () => {
  const source = readFileSync("src/lib/game.ts", "utf8");
  assert.match(source, /"awaiting_attacker_roll"/);
  assert.match(source, /"awaiting_defender_roll"/);
  assert.match(source, /export async function rollBattleDice/);
  assert.match(source, /advanceBattlePresentation/);
});

test("setas usam a geometria do path no viewBox do mapa", () => {
  const source = readFileSync("src/components/territory-arrow.tsx", "utf8");
  assert.match(source, /pathElement\.getBBox\(\)/);
  assert.match(source, /viewBox="0 0 1254 1254"/);
});
