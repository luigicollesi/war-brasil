import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const quartersDir = "src/components/profile/command-quarters";

function source(path) {
  return readFileSync(path, "utf8");
}

test("PROFILE V2 remove artefatos da V1 para manter uma única fonte de verdade", () => {
  for (const path of [
    "src/components/profile/profile-hall.tsx",
    "src/components/profile/profile-hall.module.css",
    "src/components/profile/profile-environment-state.tsx",
    "src/components/profile/profile-environment-state.module.css",
    "src/components/profile/profile-state.module.css",
    "src/lib/profile/profile-data.ts",
    "tests/profile-data.test.mjs",
  ]) {
    assert.equal(existsSync(path), false, `${path} não deve voltar à PROFILE V2`);
  }
});

test("módulos do Quartel não importam Three, Canvas ou câmera diretamente", () => {
  const files = readdirSync(quartersDir).filter((name) => /\.(ts|tsx)$/.test(name));
  const combined = files.map((name) => source(join(quartersDir, name))).join("\n");

  assert.doesNotMatch(
    combined,
    /@react-three\/fiber|from ["']three["']|command-scene-canvas|\bCanvas\b|cameraPosition|\bfov\b/i,
  );
  assert.match(combined, /useCommandSceneDirective/);
});

test("controller central delega social, histórico e Intendência", () => {
  const hub = source(join(quartersDir, "profile-command-hub.tsx"));

  assert.match(hub, /ProfileNetworkStation/);
  assert.match(hub, /ProfileCampaignStation/);
  assert.match(hub, /ProfileQuartermasterStation/);
  assert.doesNotMatch(hub, /async function handleSearch/);
});
