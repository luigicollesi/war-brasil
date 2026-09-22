import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const quartersDir = "src/components/profile/command-quarters";

function source(path) {
  return readFileSync(path, "utf8");
}

test("PROFILE V4 mantém uma única composição privada e não restaura controllers legados", () => {
  for (const path of [
    "src/components/profile/profile-hall.tsx",
    "src/components/profile/profile-hall.module.css",
    "src/components/profile/profile-environment-state.tsx",
    "src/components/profile/profile-environment-state.module.css",
    "src/components/profile/profile-state.module.css",
    "src/components/profile/command-quarters/profile-command-hub.tsx",
    "src/components/profile/command-quarters/profile-quartermaster-station.tsx",
    "src/components/profile/profile-command-shell.tsx",
    "src/components/profile/profile-command-shell.module.css",
    "src/components/profile/profile-boundary-state.tsx",
    "src/components/profile/profile-boundary-state.module.css",
    "src/lib/profile/profile-data.ts",
    "tests/profile-data.test.mjs",
  ]) {
    assert.equal(existsSync(path), false, `${path} não deve voltar à PROFILE V4`);
  }
});

test("módulos especializados do Quartel não importam Three, Canvas ou câmera diretamente", () => {
  const files = readdirSync(quartersDir).filter((name) => /\.(ts|tsx)$/.test(name));
  const combined = files.map((name) => source(join(quartersDir, name))).join("\n");

  assert.doesNotMatch(
    combined,
    /@react-three\/fiber|from ["']three["']|command-scene-canvas|\bCanvas\b|cameraPosition|\bfov\b/i,
  );
});

test("Dossiê V4 delega social histórico e configurações aos módulos especializados", () => {
  const dossier = source("src/components/profile/v4/profile-dossier.tsx");

  assert.match(dossier, /ProfileNetworkStation/);
  assert.match(dossier, /ProfileCampaignStation/);
  assert.match(dossier, /ProfileSettingsPanel/);
  assert.doesNotMatch(dossier, /ProfileCommandHub|ProfileQuartermasterStation/);
  assert.doesNotMatch(dossier, /async function handleSearch/);
});
