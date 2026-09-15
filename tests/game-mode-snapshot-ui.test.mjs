import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = readFileSync("src/lib/shared/game-contract.ts", "utf8");
const snapshot = readFileSync("src/lib/server/game-snapshot-service.ts", "utf8");
const sharing = readFileSync("src/lib/shared/game-snapshot-sharing.ts", "utf8");
const turnPanel = readFileSync("src/components/game-turn-panel.tsx", "utf8");

test("game snapshot expõe ruleset efetivo da partida", () => {
  assert.match(contract, /ruleset:\s*GameRuleset/);
  assert.match(snapshot, /ruleset_snapshot/);
  assert.match(snapshot, /ruleset:\s*room\.ruleset/);
  assert.match(sharing, /left\.ruleset === right\.ruleset/);
});

test("supremacia não fabrica objetivo e mostra progresso territorial público", () => {
  assert.match(snapshot, /room\.ruleset === "objective"/);
  assert.match(snapshot, /myObjective:\s*objective/);
  assert.match(turnPanel, /snapshot\.room\.ruleset === "supremacy"/);
  assert.match(turnPanel, /snapshot\.territories\.length/);
  assert.match(turnPanel, /DOMÍNIO NACIONAL/);
  assert.match(turnPanel, /territórios/);
});
