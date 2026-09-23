import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("round troop victory evaluation loads the effective ruleset once", () => {
  const source = readFileSync("src/lib/server/game-command-service.ts", "utf8");
  const start = source.indexOf("async function evaluateRoundTroopWinners");
  const end = source.indexOf("export async function executeRollOrderDie", start);
  const block = source.slice(start, end);

  assert.match(block, /evaluateGameVictories\(/);
  assert.match(block, /players\.map\(\(player\) => player\.id\)/);
  assert.match(block, /const firstWinner = winners\[0\]/);
  assert.match(block, /finalizeGameVictories\(client, roomId, \[firstWinner\]\)/);
  assert.doesNotMatch(block, /for \(const candidate of players\)/);
  assert.doesNotMatch(block, /evaluateGameVictory\(/);
});
