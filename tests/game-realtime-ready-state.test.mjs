import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("socket só fica healthy depois de realtime.ready", () => {
  const source = readFileSync(
    "src/lib/client/transport/websocket-game-realtime-transport.ts",
    "utf8",
  );
  const openHandler = source.match(
    /socket\.onopen = \(\) => \{[\s\S]*?\n    \};/,
  )?.[0];

  assert.ok(openHandler);
  assert.doesNotMatch(openHandler, /transition\("connected"\)/);
  assert.match(
    source,
    /parsed\.type === "realtime\.ready"[\s\S]*?this\.transition\("connected"\)/,
  );
  assert.match(source, /DEGRADED_AFTER_ATTEMPTS/);
});
