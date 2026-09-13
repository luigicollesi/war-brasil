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
const presets = readFileSync("src/components/pre-game/foundation/scene-presets.ts", "utf8");
const scene = readFileSync("src/components/pre-game/foundation/command-scene-canvas.tsx", "utf8");
const sceneHost = readFileSync("src/components/pre-game/foundation/command-scene.tsx", "utf8");
const shell = readFileSync("src/components/pre-game/foundation/command-shell.tsx", "utf8");
const entranceTimeline = readFileSync("src/components/pre-game/foundation/entrance-timeline.ts", "utf8");

const legacyPolishPath = "src/components/pre-game/home/command-home-polish.module.css";
const experimentalEntranceMapPath = "src/components/pre-game/foundation/command-entrance-map.module.css";

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
  assert.doesNotMatch(homeSources, /@react-three\/fiber|from "three"|command-scene-canvas|scene-presets|CameraDirector|<Canvas|<CommandShell/);
  assert.match(fallbackMarker, /HOME_FALLBACK_OWNER = "Foundation CommandShell"/);
  assert.doesNotMatch(fallbackMarker, /next\/image|<Image|war-brasil-42|globe|domainTable|orbit/i);
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

test("adapter continua sem coordenadas e publica apenas intenção semântica", () => {
  assert.match(intent, /focus: "earth"/);
  assert.match(intent, /focus: "brazil"/);
  assert.match(intent, /focus: "table"/);
  assert.match(intent, /focus: "insignia"/);
  assert.doesNotMatch(intent, /entranceStartedAtMs|entranceDurationMs/);
  assert.doesNotMatch(intent, /\b(?:x|y|z|fov|quaternion|camera|material)\s*:/i);
  assert.doesNotMatch(intent, /\bmode\s*:/);
});

test("ritual é pulável, reduced-motion é estável e a intro reaparece a cada montagem da HOME", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /useSyncExternalStore/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(home, /sceneState !== "fallback"/);
  assert.match(home, /sceneState !== "ready"/);
  assert.doesNotMatch(home, /sessionStorage|ritualSeenInRuntime|repeatVisit|RETORNO RECONHECIDO/);
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

test("abertura parte do preto, deforma o Brasil colorido e converge para a cena real do dev", () => {
  assert.match(introStyles, /--home-intro-duration: 3000ms/);
  assert.match(introStyles, /background: #000 !important/);
  assert.match(introStyles, /homeMapCompression/);
  assert.match(introStyles, /rotateY\(82deg\)/);
  assert.match(introStyles, /rotateY\(-31deg\)/);
  assert.match(introStyles, /homeMapMilitarize/);
  assert.match(introStyles, /homeDevSceneReveal/);
  assert.match(introStyles, /homeMapDepthHandoff/);
  assert.match(introStyles, /data-command-fallback-brazil/);
  assert.match(introStyles, /data-command-canvas-layer/);
  assert.doesNotMatch(sceneHost, /EntranceBrazilMap|command-entrance-map/);
  assert.equal(existsSync(experimentalEntranceMapPath), false);
});

test("o frame final continua sendo a Foundation original do dev", () => {
  assert.match(sceneHost, /<CommandSceneFallback intent=\{normalizedIntent\} \/>/);
  assert.match(sceneHost, /<CommandSceneCanvas/);
  assert.match(sceneHost, /data-command-fallback-brazil/);
  assert.match(scene, /PLATE_TONES/);
  assert.match(scene, /BrazilTerritoryAssembly/);
  assert.match(scene, /DomainTable/);
  assert.match(scene, /OrbitalCrown/);
  assert.match(scene, /StrategicGlobe/);
  assert.doesNotMatch(scene, /homeMapGenesis|entranceProgress|canonicalFill/);
});

test("todos os principais elementos da HOME entram dentro da mesma coreografia", () => {
  for (const name of [
    "homeMapTravel",
    "homeMapCompression",
    "homeMapMilitarize",
    "homeDevSceneReveal",
    "homeAtmosphereIn",
    "homeChromeIn",
    "homeIdentitySettle",
    "homeCommandSettle",
    "homeFooterSettle",
  ]) assert.match(introStyles, new RegExp(name));
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

test("poses 3D continuam exatamente sob responsabilidade da Foundation", () => {
  assert.match(presets, /ENTRANCE_FOCUS_PRESETS/);
  assert.match(presets, /COMPACT_ENTRANCE_FOCUS_PRESETS/);
  assert.match(scene, /MathUtils\.damp/);
  assert.match(scene, /targetSeparation/);
  assert.match(scene, /targetScale/);
  assert.doesNotMatch(scene, /entranceStartedAtMs|entranceDurationMs/);
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
  assert.match(introStyles, /--home-map-shift: 14vw/);
});

test("foco de teclado mantém prioridade sobre intenção efêmera do ponteiro", () => {
  assert.match(home, /keyboardDestinationFocus \?\? pointerDestinationFocus/);
  assert.match(home, /onFocus=\{\(\) => setKeyboardDestinationFocus\(destination\.id\)\}/);
  assert.match(home, /onPointerEnter=\{\(\) => setPointerDestinationFocus\(destination\.id\)\}/);
});

test("vermelho local permanece restrito ao destino Operações", () => {
  assert.match(styles, /destination\[data-destination="operations"\]/);
  assert.match(styles, /rgb\(139 32 38 \/ 12%\)/);
  assert.doesNotMatch(styles, /pulse|pulsing/i);
});
