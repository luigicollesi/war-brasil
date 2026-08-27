import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { maneuverMovableTroops } from "../.test-build/game-rules.js";

test("tropas transferidas após conquista continuam disponíveis para manobra", () => {
  const conquest = readFileSync(
    "src/lib/game-conquest-command-service.ts",
    "utf8",
  );

  assert.match(conquest, /SET troops=\$3,moved_in_turn=0/);
  assert.doesNotMatch(conquest, /SET troops=\$3,moved_in_turn=\$3/);
  assert.equal(maneuverMovableTroops(4, 0), 3);
});

test("somente tropas recebidas durante manobra entram no bloqueio moved_in_turn", () => {
  const maneuver = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(
    maneuver,
    /SET troops=troops\+\$3,moved_in_turn=moved_in_turn\+\$3/,
  );
  assert.equal(maneuverMovableTroops(4, 3), 0);
});
