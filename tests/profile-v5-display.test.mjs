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
  assert.match(
    display,
    /<ProfileDisplayStage[\s\S]*arsenal=\{snapshot\.appearance\.arsenal\}[\s\S]*topInsetPx=\{arsenalTop\}/,
  );
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

test("private dossier resolves its equipped background from browser cache before the server", async () => {
  const page = await source("src/app/profile/page.tsx");
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.match(page, /getPublicProfileAppearance/);
  assert.match(page, /const equippedTitle = appearance\?\.title \?\? null/);
  assert.doesNotMatch(page, /appearance\?\.background\.assetRef/);
  assert.doesNotMatch(page, /backgroundAssetRef=/);
  assert.match(shell, /readCachedProfileBackgroundRef\(handle\)/);
  assert.match(shell, /\/api\/profile\/appearance\/background/);
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
  assert.match(settings, /applyProfileBackgroundRef/);
  assert.match(settings, /await applyProfileBackgroundRef/);
  assert.doesNotMatch(settings, /\/api\/profile\/titles/);
});


test("desktop dossier reserves the viewport when a title is equipped", async () => {
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");
  const dossierStyles = await source("src/components/profile/v4/profile-dossier.module.css");
  const shellStyles = await source("src/components/profile/v4/profile-shell.module.css");

  assert.match(dossier, /data-has-title=\{appearanceTitle \|\| identity\.title/);
  assert.match(dossierStyles, /grid-template-rows:\s*minmax\(272px, 0\.82fr\) minmax\(0, 1\.18fr\)/);
  assert.match(dossierStyles, /identityMain\[data-has-title="true"\]/);
  assert.match(shellStyles, /data-active-surface="dossier"[\s\S]*height:\s*100dvh/);
  assert.match(shellStyles, /data-active-surface="dossier"[\s\S]*\.surface[\s\S]*overflow:\s*hidden/);
});


test("public profile arsenal couples responsive asset and label geometry through one layout contract", async () => {
  const stage = await source("src/components/profile/profile-display-stage.tsx");
  const layout = await source("src/components/profile/profile-display-stage-layout.ts");
  const styles = await source("src/components/profile/profile-display-stage.module.css");

  assert.match(stage, /PROFILE_DISPLAY_LAYOUTS/);
  assert.match(stage, /compactShort = compact && size\.height <= 760/);
  assert.match(stage, /worldPosition\("attack"\)/);
  assert.match(stage, /scale=\{layout\.attack\.scale\}/);
  assert.match(stage, /style=\{labelStyle\(item\.slot\)\}/);

  assert.match(layout, /desktop:[\s\S]*attack: \{ x: 0\.14, y: 0\.43[\s\S]*labelY: 0\.56/);
  assert.match(layout, /compact:[\s\S]*attack: \{ x: 0\.27, y: 0\.25[\s\S]*labelY: 0\.29/);
  assert.match(layout, /neutral: \{ x: 0\.27, y: 0\.68[\s\S]*labelY: 0\.72/);
  assert.match(layout, /compactShort/);

  assert.match(styles, /top:\s*var\(--profile-label-y\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*top:\s*var\(--profile-label-y-compact\)/);
  assert.match(styles, /@media \(max-width: 720px\) and \(max-height: 760px\)/);
  assert.doesNotMatch(styles, /\.label:nth-child/);
});


test("public profile mobile labels stay close to their assets without collapsing the two rows", async () => {
  const layout = await source("src/components/profile/profile-display-stage-layout.ts");

  assert.match(
    layout,
    /compact:[\s\S]*attack: \{ x: 0\.27, y: 0\.25, labelX: 0\.27, labelY: 0\.29/,
  );
  assert.match(
    layout,
    /neutral: \{ x: 0\.27, y: 0\.68, labelX: 0\.27, labelY: 0\.72/,
  );
  assert.match(
    layout,
    /compactShort:[\s\S]*attack: \{ x: 0\.27, y: 0\.23, labelX: 0\.27, labelY: 0\.27/,
  );
  assert.match(
    layout,
    /neutral: \{ x: 0\.27, y: 0\.66, labelX: 0\.27, labelY: 0\.7/,
  );
});


test("public profile centers arsenal in the measured space below the player title", async () => {
  const display = await source(
    "src/components/profile/public-commander-profile.tsx",
  );
  const stage = await source("src/components/profile/profile-display-stage.tsx");
  const styles = await source("src/components/profile/profile-display-stage.module.css");

  assert.match(display, /identityRef = useRef<HTMLElement>/);
  assert.match(display, /new ResizeObserver\(syncArsenalTop\)/);
  assert.match(display, /getBoundingClientRect\(\)\.bottom/);
  assert.match(display, /topInsetPx=\{arsenalTop\}/);
  assert.match(stage, /"--profile-display-top":/);
  assert.match(styles, /top:\s*var\(--profile-display-top,/);
  assert.match(styles, /bottom:\s*0;/);
});

test("public profile renders 3d arsenal above its labels", async () => {
  const styles = await source("src/components/profile/profile-display-stage.module.css");

  assert.match(styles, /\.canvas\s*\{[^}]*z-index:\s*2;/);
  assert.match(styles, /\.labels\s*\{[^}]*z-index:\s*1;/);
  assert.match(styles, /isolation:\s*isolate;/);
});
