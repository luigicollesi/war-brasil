import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const arsenalSource = await readFile(
  new URL("../src/components/profile/v4/profile-arsenal.tsx", import.meta.url),
  "utf8",
);

test("profile arsenal follows the current territory_skin slot contract", () => {
  assert.match(arsenalSource, /territory_skin/);
  assert.doesNotMatch(arsenalSource, /territory_effect/);
  assert.match(arsenalSource, /satisfies readonly CosmeticSlot\[\]/);
});
