import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/components/profile/command-quarters/profile-command-format.ts",
  "utf8",
);

test("status copy keeps presence and activity as independent dimensions", () => {
  assert.match(source, /PRESENCE_COPY\[presence\.state\]/);
  assert.match(source, /ACTIVITY_COPY\[activity\.state\]/);
  assert.match(source, /`\$\{PRESENCE_COPY\[presence\.state\]\} · \$\{ACTIVITY_COPY\[activity\.state\]\}`/);
  assert.doesNotMatch(source, /if \(activity\.state === "match"\) return "Em partida"/);
  assert.doesNotMatch(source, /if \(activity\.state === "lobby"\) return "Em sala"/);
});
