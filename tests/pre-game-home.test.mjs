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
const entranceMapStyles = readFileSync("src/components/pre-game/foundation/command-entrance-map.module.css", "utf8");
const foundationIndex = readFileSync("src/components/pre-game/foundation/index.ts", "utf8");
const runtime = readFileSync("src/components/pre-game/foundation/pre-game-command-runtime.tsx", "utf8");
const presets = readFileSync("src/components/pre-game/foundation/scene-presets.ts", "utf8");
const scene = readFileSync("src/components/pre-game/foundation/command-scene-canvas.tsx", "utf8");
const sceneHost = readFileSync("src/components/pre-game/foundation/command-scene.tsx", "utf8");
const shell = readFileSync("src/components/pre-game/foundation/command-shell.tsx", "utf8");
const entranceTimeline = readFileSync("src/components/pre-game/foundation/entrance-timeline.ts", "utf8");

const legacyPolishPath = "src/components/pre-game/home/command-home-polish.module.css";

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

test("ritual é pulável e repeat/reduced-motion continuam estáveis", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /useSyncExternalStore/);
  assert.match(home, /sessionStorage\.getItem\(HOME_RITUAL_SESSION_KEY\)/);
  assert.match(home, /sessionStorage\.setItem\(HOME_RITUAL_SESSION_KEY, "1"\)/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(introStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("entrada usa um único relógio contínuo de 3000ms sem depender do WebGL", () => {
  assert.match(entranceTimeline, /COMMAND_ENTRANCE_DURATION_MS = 3000/);
  assert.match(home, /useState<HomeCeremonyPhase>\("brazil"\)/);
  assert.match(home, /useState<number \| null>\(null\)/);
  assert.match(home, /performance\.now\(\)/);
  assert.match(home, /setCeremonyPhase\("table"\)/);
  assert.match(home, /setCeremonyPhase\("stable"\)/);
  assert.match(home, /COMMAND_ENTRANCE_DURATION_MS/);
  assert.match(home, /homeTransition === "preparing"/);
  assert.match(home, /"running"/);
  assert.doesNotMatch(home, /sceneState !== "ready"|sceneState === "fallback"\s*\?\s*"complete"/);
  assert.doesNotMatch(home, /HOME_INTRO_DELAY_MS|HOME_INTRO_COMPLETE_MS|HOME_INTRO_DURATION_MS/);
});

test("entrada mostra um único Brasil canônico do preto ao mapa militar final", () => {
  assert.match(sceneHost, /function EntranceBrazilMap/);
  assert.match(sceneHost, /data-command-entrance-map/);
  assert.match(sceneHost, /entranceOwnsBrazil = intent\.mode === "entrance"/);
  assert.match(sceneHost, /!entranceOwnsBrazil \?/);
  assert.match(sceneHost, /normalizedIntent\.mode === "entrance" \? <EntranceBrazilMap \/> : null/);
  assert.match(entranceMapStyles, /war-brasil-42\.production\.svg/);
  assert.match(entranceMapStyles, /mask: url\("\/war-brasil-42\.production\.svg"\)/);
  assert.match(entranceMapStyles, /#314a34/);
  assert.match(entranceMapStyles, /#132219/);
});

test("primeiro frame é preto e nenhum elemento principal surge em seco", () => {
  assert.match(introStyles, /background: #000/);
  assert.match(introStyles, /data-home-transition="preparing"[\s\S]*opacity: 0/);
  assert.match(introStyles, /data-command-entrance-map/);
  assert.match(introStyles, /data-command-fallback-table/);
  assert.match(introStyles, /data-command-atmosphere/);
  assert.match(introStyles, /data-command-chrome/);
  assert.match(introStyles, /data-home-identity/);
  assert.match(introStyles, /data-home-command-dock/);
  assert.match(introStyles, /data-home-footer/);
});

test("mapa aparece por compressão e descompressão antes de se reposicionar", () => {
  assert.match(introStyles, /@keyframes homeMapGenesis/);
  assert.match(introStyles, /rotateY\(76deg\)/);
  assert.match(introStyles, /rotateY\(-27deg\)/);
  assert.match(introStyles, /rotateY\(18deg\)/);
  assert.match(introStyles, /rotateY\(-8deg\)/);
  assert.match(introStyles, /scale\(\.72, \.94\)/);
  assert.match(introStyles, /18% \{[\s\S]*opacity: 1/);
  assert.match(introStyles, /100% \{[\s\S]*translate\(-50%, -50%\)/);
});

test("cor e interface materializam ao redor do mapa em vez de trocar telas", () => {
  assert.match(introStyles, /--home-intro-duration: 3000ms/);
  assert.match(introStyles, /--home-intro-easing: cubic-bezier\(\.4, \.14, \.3, 1\)/);
  for (const name of [
    "homeMapMilitarize",
    "homeMapMetalFinish",
    "homeTableMaterialize",
    "homeTableDetail",
    "homeIdentitySettle",
    "homeCommandSettle",
    "homeChromeIn",
    "homeAtmosphereIn",
    "homeFooterSettle",
  ]) assert.match(introStyles, new RegExp(name));
  assert.doesNotMatch(introStyles, /homeFallbackRelease|homeCanvasTakeover/);
  assert.match(introStyles, /data-command-canvas-layer[\s\S]*opacity: 0 !important/);
  assert.match(introStyles, /data-command-fallback[\s\S]*opacity: 1 !important/);
  assert.doesNotMatch(introStyles, /filter:\s*(?:grayscale|sepia|saturate|brightness|contrast)\(/);
});

test("Foundation oferece âncoras semânticas e intro não depende de estrutura posicional", () => {
  assert.match(sceneHost, /data-command-scene/);
  assert.match(sceneHost, /data-command-fallback/);
  assert.match(sceneHost, /data-command-fallback-table/);
  assert.match(sceneHost, /data-command-fallback-brazil/);
  assert.match(sceneHost, /data-command-entrance-map/);
  assert.match(sceneHost, /data-command-canvas-layer/);
  assert.match(shell, /data-command-atmosphere/);
  assert.match(shell, /data-command-chrome/);
  assert.doesNotMatch(introStyles, /nth-child|first-child|last-child/);
});

test("poses 3D continuam disponíveis para as demais experiências da Foundation", () => {
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
  assert.match(introStyles, /--home-map-shift: 15vw/);
  assert.match(entranceMapStyles, /width: min\(74vw, 520px\)/);
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
