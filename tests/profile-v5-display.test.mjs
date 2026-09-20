import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("public profile display owns the viewport outside CommandShell", async () => {
  const runtime = await source(
    "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  );
  const intent = await source(
    "src/components/pre-game/foundation/pre-game-route-intent.ts",
  );
  const page = await source("src/app/profile/[handle]/page.tsx");

  assert.match(intent, /isStandalonePublicProfileRoute/);
  assert.match(intent, /\^\\\/profile\\\/\(\[\^\/\]\+\)\$/);
  assert.match(intent, /PROFILE_INTERNAL_SEGMENTS/);
  assert.match(runtime, /standalonePublicProfile/);
  assert.match(runtime, /profileOwnsSurface/);
  assert.match(runtime, /profileOwnsSurface \? \(/);
  assert.doesNotMatch(page, /redirect\("\/profile"\)/);
});

test("public profile display uses equipped background, styled title and four-item 3D arsenal", async () => {
  const display = await source(
    "src/components/profile/public-commander-profile.tsx",
  );
  const stage = await source("src/components/profile/profile-display-stage.tsx");

  assert.match(display, /snapshot\.appearance\.background\.assetRef/);
  assert.match(display, /ProfileTitleRenderer/);
  assert.match(display, /ProfileDisplayStage arsenal=\{snapshot\.appearance\.arsenal\}/);
  assert.match(display, /CHAMAR PARA JOGAR/);
  assert.match(display, /SOLICITAR AMIZADE/);
  assert.match(display, /ACEITAR AMIZADE/);
  assert.match(display, /SIGILO/);

  assert.match(stage, /<Canvas/);
  assert.match(stage, /DiceShowcaseModel/);
  assert.match(stage, /TerritoryShowcaseModel/);
  assert.match(stage, /dice_attack/);
  assert.match(stage, /dice_defense/);
  assert.match(stage, /dice_neutral/);
  assert.match(stage, /size\.width <= 720/);
});

test("private dossier loads equipped background and exposes public display action", async () => {
  const page = await source("src/app/profile/page.tsx");
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.match(page, /getOwnProfileAppearance/);
  assert.match(page, /backgrounds\.find\(\(item\) => item\.equipped\)/);
  assert.match(page, /backgroundAssetRef=\{equippedBackground\}/);
  assert.match(shell, /profileBackdrop/);
  assert.match(dossier, /VER PERFIL/);
  assert.match(dossier, /\/profile\/\$\{encodeURIComponent\(identity\.handle\)\}/);
});

test("Ajustar Dossiê selects owned titles and profile backgrounds through appearance API", async () => {
  const settings = await source(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );

  assert.match(settings, /fetch\("\/api\/profile\/appearance"/);
  assert.match(settings, /method: "PATCH"/);
  assert.match(settings, /appearanceView === "titles"/);
  assert.match(settings, /appearanceView === "backgrounds"/);
  assert.match(settings, /ProfileTitleRenderer/);
  assert.match(settings, /background\.previewRef \?\? background\.assetRef/);
  assert.doesNotMatch(settings, /\/api\/profile\/titles/);
});
