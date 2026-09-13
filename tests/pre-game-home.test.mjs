import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/page.tsx", "utf8");
const home = readFileSync("src/components/pre-game/home/command-home-client.tsx", "utf8");
const content = readFileSync("src/components/pre-game/home/command-home-content.tsx", "utf8");
const intent = readFileSync("src/components/pre-game/home/command-home-scene-intent.ts", "utf8");
const fallbackMarker = readFileSync("src/components/pre-game/home/command-home-fallback.tsx", "utf8");
const styles = readFileSync("src/components/pre-game/home/command-home.module.css", "utf8");
const introStyles = readFileSync("src/components/pre-game/home/command-home-intro.module.css", "utf8");
const foundationIndex = readFileSync("src/components/pre-game/foundation/index.ts", "utf8");
const runtime = readFileSync("src/components/pre-game/foundation/pre-game-command-runtime.tsx", "utf8");
const contract = readFileSync("src/components/pre-game/foundation/scene-contract.ts", "utf8");
const presets = readFileSync("src/components/pre-game/foundation/scene-presets.ts", "utf8");
const scene = readFileSync("src/components/pre-game/foundation/command-scene-canvas.tsx", "utf8");
const sceneHost = readFileSync("src/components/pre-game/foundation/command-scene.tsx", "utf8");
const shell = readFileSync("src/components/pre-game/foundation/command-shell.tsx", "utf8");
const entranceTimeline = readFileSync("src/components/pre-game/foundation/entrance-timeline.ts", "utf8");

const legacyPolishPath = "src/components/pre-game/home/command-home-polish.module.css";
const experimentalEntranceMapPath =
  "src/components/pre-game/foundation/command-entrance-map.module.css";

test("HOME preserva metadata, canonical e structured data existentes", () => {
  assert.match(page, /export const metadata: Metadata/);
  assert.match(page, /canonical: "\/"/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /"@type": "WebApplication"/);
  assert.match(page, /<CommandHomeClient>/);
  assert.match(page, /<CommandHomeContent \/>/);
});

test("HOME consome somente o contrato público do runtime Foundation", () => {
  assert.match(home, /useCommandSceneDirective/);
  assert.match(home, /useCommandSceneState/);
  assert.match(home, /COMMAND_ENTRANCE_DURATION_MS/);
  assert.match(intent, /import type \{ CommandSceneDirective \} from "\.\.\/foundation"/);
  assert.match(foundationIndex, /COMMAND_ENTRANCE_DURATION_MS/);
  assert.match(foundationIndex, /CommandSceneDirective/);
  assert.doesNotMatch(runtime, /entranceStartedAtMs|entranceDurationMs/);

  const homeSources = `${home}\n${content}\n${intent}`;
  assert.doesNotMatch(
    homeSources,
    /@react-three\/fiber|from "three"|command-scene-canvas|scene-presets|CameraDirector|<Canvas|<CommandShell/,
  );
  assert.match(fallbackMarker, /HOME_FALLBACK_OWNER = "Foundation CommandShell"/);
  assert.doesNotMatch(
    fallbackMarker,
    /next\/image|<Image|war-brasil-42|globe|domainTable|orbit/i,
  );
  assert.equal(existsSync(legacyPolishPath), false);
});

test("HOME mantém identidade, CTA e três destinos do comando", () => {
  assert.doesNotMatch(page, /GameQuickGuide|HomeTerritoryMap|WarShell/);
  assert.match(content, /WAR/);
  assert.match(content, /BRASIL/);
  assert.doesNotMatch(content, /Ir para o comando/);
  assert.match(home, /ENTRAR NO COMANDO/);
  assert.match(home, /href: "\/matchmaking"/);
  assert.match(home, /href: "\/rules"/);
  assert.match(home, /href: "\/profile"/);
  assert.match(home, /aria-label="Destinos do comando"/);
});

test("adapter publica intenção semântica incluindo somente o estado lógico da entrada", () => {
  assert.match(intent, /focus: "earth"/);
  assert.match(intent, /focus: "brazil"/);
  assert.match(intent, /focus: "table"/);
  assert.match(intent, /focus: "insignia"/);
  assert.match(intent, /entranceState: "initial"/);
  assert.match(intent, /entranceState: "running"/);
  assert.match(intent, /entranceState: "settled"/);
  assert.doesNotMatch(intent, /entranceStartedAtMs|entranceDurationMs/);
  assert.doesNotMatch(
    intent,
    /\b(?:x|y|z|fov|quaternion|camera|material)\s*:/i,
  );
  assert.doesNotMatch(intent, /\bmode\s*:/);
});

test("Foundation mantém entranceState no contrato sem receber timing ou coordenadas da HOME", () => {
  assert.match(contract, /COMMAND_ENTRANCE_STATES = \["initial", "running", "settled"\]/);
  assert.match(contract, /export type CommandEntranceState/);
  assert.match(contract, /entranceState\?: CommandEntranceState/);
  assert.match(runtime, /entranceState\?: CommandEntranceState/);
  assert.match(runtime, /entranceState: directive\.entranceState/);
  assert.doesNotMatch(contract, /entranceStartedAtMs|entranceDurationMs/);
  assert.doesNotMatch(runtime, /entranceStartedAtMs|entranceDurationMs/);
});

test("ritual é pulável, reduced-motion é estável e a intro reaparece a cada montagem da HOME", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /useSyncExternalStore/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(home, /sceneState !== "fallback"/);
  assert.match(home, /sceneState !== "ready"/);
  assert.doesNotMatch(
    home,
    /sessionStorage|ritualSeenInRuntime|repeatVisit|RETORNO RECONHECIDO/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(introStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("entrada espera a Foundation e usa um único relógio contínuo de 3000ms", () => {
  assert.match(entranceTimeline, /COMMAND_ENTRANCE_DURATION_MS = 3000/);
  assert.match(home, /useState<HomeCeremonyPhase>\("brazil"\)/);
  assert.match(home, /useState<number \| null>\(null\)/);
  assert.match(home, /sceneState !== "ready"/);
  assert.match(home, /performance\.now\(\)/);
  assert.match(home, /setCeremonyPhase\("table"\)/);
  assert.match(home, /setCeremonyPhase\("stable"\)/);
  assert.match(home, /COMMAND_ENTRANCE_DURATION_MS/);
  assert.match(home, /homeTransition === "preparing"/);
  assert.match(home, /"running"/);
});

test("o próprio BrazilTerritoryAssembly é o mapa colorido e o mapa final", () => {
  assert.match(scene, /readCanonicalFill/);
  assert.match(scene, /initialColor: initialColor\.clone\(\)/);
  assert.match(scene, /finalColor: finalColor\.clone\(\)/);
  assert.match(scene, /COMMAND_ENTRANCE_DURATION_MS/);
  assert.match(scene, /HOME_MAP_ROTATION_Y/);
  assert.match(scene, /sampleKeyframes/);
  assert.match(scene, /intent\.entranceState === "running"/);
  assert.match(scene, /material\.color\.lerpColors/);
  assert.match(scene, /plate\.initialColor/);
  assert.match(scene, /plate\.finalColor/);
  assert.match(scene, /new Color\(readCanonicalFill/);
  assert.doesNotMatch(sceneHost, /EntranceBrazilMap|command-entrance-map/);
  assert.equal(existsSync(experimentalEntranceMapPath), false);
});

test("a compressão e descompressão terminam exatamente na transformação original do dev", () => {
  assert.match(scene, /HOME_MAP_ROTATION_Y[\s\S]*1\.43/);
  assert.match(scene, /HOME_MAP_ROTATION_Y[\s\S]*-0\.54/);
  assert.match(
    scene,
    /assembly\.position\.set\(layout\.center\[0\], layout\.center\[1\], 0\.08\)/,
  );
  assert.match(scene, /assembly\.rotation\.set\(-0\.095, 0\.035, -0\.028\)/);
  assert.match(scene, /assembly\.scale\.setScalar\(layout\.objectScale\)/);
  assert.match(scene, /PLATE_TONES/);
  assert.match(
    scene,
    /COMMAND_FOUNDATION_TOKENS\.material\.plateRoughness/,
  );
  assert.match(
    scene,
    /COMMAND_FOUNDATION_TOKENS\.material\.plateMetalness/,
  );
  assert.match(scene, /EDGE_FINAL_COLOR = new Color\("#d0aa57"\)/);
});

test("o frame final continua contendo a Foundation original do dev", () => {
  assert.match(sceneHost, /<CommandSceneFallback intent=\{normalizedIntent\} \/>/);
  assert.match(sceneHost, /<CommandSceneCanvas/);
  assert.match(sceneHost, /data-command-fallback-brazil/);
  assert.match(scene, /BrazilTerritoryAssembly/);
  assert.match(scene, /DomainTable/);
  assert.match(scene, /OrbitalCrown/);
  assert.match(scene, /StrategicGlobe/);
  assert.match(presets, /ENTRANCE_FOCUS_PRESETS/);
  assert.match(presets, /COMPACT_ENTRANCE_FOCUS_PRESETS/);
});

test("durante a entrada não existe um segundo mapa visível nem crossfade 2D->3D", () => {
  assert.match(
    introStyles,
    /data-home-transition="running"[\s\S]*\[data-command-fallback\][\s\S]*opacity: 0 !important/,
  );
  assert.match(introStyles, /homeFoundationGenesis/);
  assert.doesNotMatch(
    introStyles,
    /homeFallbackRelease|homeCanvasTakeover|homeMapDepthHandoff|homeMapMilitarize/,
  );
  assert.doesNotMatch(introStyles, /data-command-fallback-brazil/);
  assert.doesNotMatch(sceneHost, /EntranceBrazilMap/);
});

test("todos os elementos principais materializam dentro da mesma coreografia", () => {
  assert.match(introStyles, /--home-intro-duration: 3000ms/);
  assert.match(introStyles, /background: #000 !important/);
  for (const name of [
    "homeFoundationGenesis",
    "homeAtmosphereIn",
    "homeChromeIn",
    "homeIdentitySettle",
    "homeCommandSettle",
    "homeFooterSettle",
  ]) {
    assert.match(introStyles, new RegExp(name));
  }
  assert.match(content, /data-home-identity/);
  assert.match(home, /data-home-command-dock/);
  assert.match(home, /data-home-footer/);
});

test("Foundation oferece âncoras semânticas e intro não depende de estrutura posicional frágil", () => {
  assert.match(sceneHost, /data-command-scene/);
  assert.match(sceneHost, /data-command-fallback/);
  assert.match(sceneHost, /data-command-fallback-table/);
  assert.match(sceneHost, /data-command-fallback-brazil/);
  assert.match(sceneHost, /data-command-canvas-layer/);
  assert.match(shell, /data-command-atmosphere/);
  assert.match(shell, /data-command-chrome/);
  assert.doesNotMatch(introStyles, /nth-child|first-child|last-child/);
});

test("mobile preserva composição própria, safe-area e alvos touch", () => {
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.destinationRail \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(styles, /\.destination \{[\s\S]*min-height: 68px;/);
  assert.match(styles, /\.skipCeremony \{[\s\S]*min-height: 44px;/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(home, /tabIndex=\{-1\}/);
});

test("foco de teclado mantém prioridade sobre intenção efêmera do ponteiro", () => {
  assert.match(home, /keyboardDestinationFocus \?\? pointerDestinationFocus/);
  assert.match(
    home,
    /onFocus=\{\(\) => setKeyboardDestinationFocus\(destination\.id\)\}/,
  );
  assert.match(
    home,
    /onPointerEnter=\{\(\) => setPointerDestinationFocus\(destination\.id\)\}/,
  );
});

test("vermelho local permanece restrito ao destino Operações", () => {
  assert.match(styles, /destination\[data-destination="operations"\]/);
  assert.match(styles, /rgb\(139 32 38 \/ 12%\)/);
  assert.doesNotMatch(styles, /pulse|pulsing/i);
});
