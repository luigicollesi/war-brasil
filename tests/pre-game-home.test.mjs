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
const openingTimeline = readFileSync("src/components/pre-game/foundation/opening-timeline.ts", "utf8");
const territoryIngress = readFileSync("src/components/pre-game/foundation/territory-ingress.ts", "utf8");
const genesisPass = readFileSync("src/components/pre-game/foundation/territory-genesis-pass.tsx", "utf8");
const genesisMaterial = readFileSync("src/components/pre-game/foundation/territory-genesis-material.ts", "utf8");
const profileOrb = readFileSync("src/components/pre-game/foundation/profile-orb-assembly.tsx", "utf8");

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

test("HOME consome somente contrato público e não controla progresso por frame", () => {
  assert.match(home, /useCommandSceneDirective/);
  assert.match(home, /useCommandSceneState/);
  assert.match(intent, /import type \{ CommandSceneDirective \} from "\.\.\/foundation"/);
  assert.match(foundationIndex, /COMMAND_ENTRANCE_RECIPE/);
  assert.match(foundationIndex, /sampleContinuousOpeningCue/);
  assert.match(foundationIndex, /smootherOpeningProgress/);
  assert.doesNotMatch(home, /performance\.now|setTimeout|COMMAND_ENTRANCE_DURATION_MS/);
  assert.doesNotMatch(runtime, /entranceStartedAtMs|entranceDurationMs/);

  const homeSources = `${home}\n${content}\n${intent}`;
  assert.doesNotMatch(
    homeSources,
    /@react-three\/fiber|from "three"|command-scene-canvas|scene-presets|CameraDirector|<Canvas|<CommandShell/,
  );
  assert.match(fallbackMarker, /HOME_FALLBACK_OWNER = "Foundation CommandShell"/);
  assert.equal(existsSync(legacyPolishPath), false);
});

test("HOME mantém identidade, CTA e três destinos do comando", () => {
  assert.match(content, /BELLUM/);
  assert.match(content, /CIVILE/);
  assert.match(content, /BRASIL/);
  assert.match(home, /ENTRAR NO COMANDO/);
  assert.match(home, /href: "\/matchmaking"/);
  assert.match(home, /href: "\/rules"/);
  assert.match(home, /href: "\/profile"/);
  assert.match(home, /aria-label="Destinos do comando"/);
});

test("adapter da HOME mantém a câmera em table durante toda Genesis", () => {
  assert.match(intent, /HomeCeremonyPhase = "primed" \| "playing" \| "stable"/);
  assert.match(intent, /focus: "table"/);
  assert.match(intent, /entranceState:[\s\S]*"settled"[\s\S]*"playing"[\s\S]*"primed"/);
  assert.doesNotMatch(intent, /focus: "earth"/);
  assert.doesNotMatch(intent, /\b(?:x|y|z|fov|quaternion|camera|material)\s*:/i);
});

test("Foundation modela primed, playing e settling sem progresso em React state", () => {
  assert.match(contract, /COMMAND_ENTRANCE_STATES = \["primed", "playing", "settled"\]/);
  assert.match(contract, /"loading"[\s\S]*"primed"[\s\S]*"playing"[\s\S]*"settling"[\s\S]*"ready"[\s\S]*"fallback"/);
  assert.match(home, /sceneState === "primed"/);
  assert.match(home, /sceneState === "playing" \|\| sceneState === "settling"/);
  assert.doesNotMatch(home, /useState<[^>]*progress|setProgress/i);
});

test("timeline compartilhada é única, normalizada, contínua e seekable", () => {
  assert.match(entranceTimeline, /COMMAND_ENTRANCE_DURATION_MS = 3000/);
  assert.match(entranceTimeline, /id: "home-genesis"/);
  assert.match(entranceTimeline, /settlingStart: 0\.88/);
  assert.match(entranceTimeline, /territoryIngress: \{ start: 0, end: 0\.44 \}/);
  assert.match(entranceTimeline, /genesis: \{ start: 0\.44, end: 0\.82 \}/);
  assert.match(entranceTimeline, /profileActivation: \{ start: 0\.8, end: 0\.99 \}/);
  assert.match(openingTimeline, /resolveOpeningProgress/);
  assert.match(openingTimeline, /sampleContinuousOpeningCue/);
  assert.match(openingTimeline, /smootherOpeningProgress/);
  assert.match(openingTimeline, /__WAR_OPENING_SEEK__/);
  assert.match(openingTimeline, /deterministicOpeningSeed/);
  assert.doesNotMatch(openingTimeline, /setTimeout/);
});

test("ingresso territorial é radial, center-out, contínuo e determinístico", () => {
  assert.match(territoryIngress, /buildTerritoryIngressDescriptors/);
  assert.match(territoryIngress, /territoryBounds = new Map<number, Box3>/);
  assert.match(territoryIngress, /radialRank/);
  assert.match(territoryIngress, /Math\.pow\(radialRank, 1\.35\)/);
  assert.match(territoryIngress, /startSpread = cueSpan \* 0\.32/);
  assert.match(territoryIngress, /sampleTerritoryIngress/);
  assert.match(territoryIngress, /smootherOpeningProgress/);
  assert.match(territoryIngress, /deterministicOpeningSeed\(territoryId\)/);
  assert.doesNotMatch(territoryIngress, /Math\.random|setTimeout/);
});

test("BrazilTerritoryAssembly preserva literalmente a pose final de dev", () => {
  assert.match(scene, /name="BrazilTerritoryAssembly"/);
  assert.match(scene, /position=\{\[layout\.center\[0\], layout\.center\[1\], 0\.08\]\}/);
  assert.match(scene, /rotation=\{\[-0\.095, 0\.035, -0\.028\]\}/);
  assert.match(scene, /scale=\{layout\.objectScale\}/);
  assert.match(scene, /PLATE_TONES/);
  assert.match(scene, /COMMAND_FOUNDATION_TOKENS\.material\.plateRoughness/);
  assert.match(scene, /COMMAND_FOUNDATION_TOKENS\.material\.plateMetalness/);
  assert.match(scene, /color: "#d0aa57"/);
  assert.doesNotMatch(scene, /HOME_MAP_ROTATION|HOME_MAP_SCALE|sampleKeyframes|assembly\.position|assembly\.rotation|assembly\.scale/);
});

test("Genesis é pass transitório sobre as mesmas geometrias e não um segundo asset", () => {
  assert.match(scene, /readCanonicalFill/);
  assert.match(scene, /canonicalColor: canonicalColor\.clone\(\)/);
  assert.match(scene, /<TerritoryGenesisPass/);
  assert.match(genesisPass, /geometry=\{plate\.geometry\}/);
  assert.match(genesisPass, /name="HomeGenesisPass"/);
  assert.match(genesisPass, /entranceState !== "playing"/);
  assert.match(genesisPass, /globalProgress >= 1[\s\S]*?\? "ready"/);
  assert.match(genesisPass, /onScenePhaseChange\(nextPhase\)/);
  assert.doesNotMatch(sceneHost, /EntranceBrazilMap|command-entrance-map/);
  assert.equal(existsSync(experimentalEntranceMapPath), false);
});

test("mesmo território move todas as suas shapes com um único descritor", () => {
  assert.match(genesisPass, /descriptors\.get\(plate\.territoryId\)/);
  assert.match(genesisPass, /sampleTerritoryIngress\(globalProgress, descriptor\)/);
  assert.match(genesisPass, /mesh\.position\.set\(/);
  assert.match(genesisPass, /descriptor\.spawn\[0\] \* remaining/);
  assert.doesNotMatch(genesisPass, /assembly\.position|assembly\.rotation|assembly\.scale/);
});

test("Genesis e anel dourado compartilham uma única curva contínua", () => {
  assert.match(genesisPass, /sampleContinuousOpeningCue\([\s\S]*COMMAND_ENTRANCE_RECIPE\.cues\.genesis/);
  assert.match(genesisPass, /handle\.setProgress\(genesisProgress\)/);
  assert.match(genesisPass, /sceneTargets\.setGenesisProgress\(genesisProgress\)/);
  assert.match(genesisPass, /ringSweep\.setProgress\(genesisProgress\)/);
  assert.match(genesisPass, /Math\.PI \* 2 \* genesisProgress/);
  assert.match(genesisPass, /name="GenesisRingSweep"/);
  assert.match(genesisPass, /scene\.getObjectByName\("DomainTable-GoldenRing"\)/);
  assert.match(scene, /name="DomainTable-GoldenRing"/);
  assert.match(scene, /userData=\{\{ finalOpacity: 1 \}\}/);
});

test("anel dourado já nasce invisível no primeiro paint da intro", () => {
  assert.match(scene, /transparent=\{openingActive\}/);
  assert.match(scene, /opacity=\{openingActive \? 0 : 1\}/);
  assert.match(genesisPass, /commandRing\.material\.opacity = 0/);
  assert.match(genesisPass, /commandRing\.finalOpacity \* progress/);
});

test("Profile Orb usa esfera translúcida e órbitas planetárias", () => {
  assert.match(scene, /ProfileOrbAssembly/);
  assert.match(profileOrb, /name="ProfileOrb-Core"/);
  assert.match(profileOrb, /<meshPhysicalMaterial/);
  assert.match(profileOrb, /transmission=\{0\.7\}/);
  assert.match(profileOrb, /thickness=\{0\.34\}/);
  assert.match(profileOrb, /name="ProfileOrb-OrbitA"/);
  assert.match(profileOrb, /name="ProfileOrb-OrbitB"/);
  assert.match(profileOrb, /name="ProfileOrb-OrbitC"/);
  assert.match(profileOrb, /orbitARef\.current\.rotation\.y \+= delta \* 0\.2/);
  assert.match(profileOrb, /orbitBRef\.current\.rotation\.x -= delta \* 0\.14/);
  assert.match(profileOrb, /orbitCRef\.current\.rotation\.y -= delta \* 0\.09/);
});

test("Profile Orb só entra na fase final e usa o mesmo relógio global", () => {
  assert.match(genesisPass, /COMMAND_ENTRANCE_RECIPE\.cues\.profileActivation/);
  assert.match(genesisPass, /sceneTargets\.setProfileProgress\(profileProgress\)/);
  assert.match(genesisPass, /profileOrb\.object\.scale\.setScalar/);
  assert.match(profileOrb, /openingActive/);
  assert.match(profileOrb, /initialScale = openingActive \? 0\.001 : targetScale/);
  assert.doesNotMatch(profileOrb, /performance\.now|setTimeout|Math\.random/);
});

test("assentamento é fase semântica e não reinicia a interpolação visual", () => {
  assert.match(genesisPass, /Settling is semantic only/);
  assert.match(genesisPass, /globalProgress >= COMMAND_ENTRANCE_RECIPE\.settlingStart/);
  assert.doesNotMatch(genesisPass, /sampleOpeningCue\([\s\S]*cues\.settling/);
  assert.doesNotMatch(genesisPass, /MathUtils\.damp/);
});

test("seek=1 segura intro-100 antes do cleanup", () => {
  assert.match(genesisPass, /const isSeekHold = forcedProgress !== null/);
  assert.match(genesisPass, /const nextPhase: CommandSceneState = isSeekHold/);
  assert.match(genesisPass, /if \(!isSeekHold && globalProgress >= 1\)/);
});

test("material Genesis usa GPU, coordenadas locais e seed territorial determinístico", () => {
  assert.match(genesisMaterial, /onBeforeCompile/);
  assert.match(genesisMaterial, /uGenesisProgress/);
  assert.match(genesisMaterial, /uGenesisSeed/);
  assert.match(genesisMaterial, /vGenesisPosition/);
  assert.match(genesisMaterial, /genesisHash/);
  assert.match(genesisMaterial, /discard/);
  assert.match(genesisMaterial, /polygonOffset: true/);
  assert.match(genesisMaterial, /deterministicOpeningSeed\(territoryId\)/);
  assert.doesNotMatch(genesisMaterial, /gl_FragCoord|Math\.random/);
});

test("progresso Genesis vive em useFrame sem setState ou alocação aleatória", () => {
  assert.match(genesisPass, /useFrame/);
  assert.match(genesisPass, /performance\.now\(\)/);
  assert.match(genesisPass, /resolveOpeningProgress/);
  assert.match(genesisPass, /sampleContinuousOpeningCue/);
  assert.match(genesisPass, /readOpeningSeek/);
  assert.doesNotMatch(genesisPass, /setState|useState|Math\.random|setTimeout/);
});

test("priming compila shader e garante frames pintáveis antes de tocar", () => {
  assert.match(scene, /gl\.compile\(scene, camera\)/);
  assert.doesNotMatch(scene, /gl\.compileAsync\(scene, camera\)/);
  assert.match(scene, /requestAnimationFrame/);
  assert.match(scene, /onScenePhaseChange\("primed"\)/);
  assert.match(home, /ceremonyPhase !== "primed"/);
  assert.match(home, /setCeremonyPhase\("playing"\)/);
});

test("Canvas nunca some durante Genesis e o fallback não simula a transformação", () => {
  assert.match(introStyles, /data-home-transition="primed"[\s\S]*data-command-canvas-layer/);
  assert.match(introStyles, /opacity: 1 !important/);
  assert.match(introStyles, /data-command-fallback[\s\S]*opacity: 0 !important/);
  assert.doesNotMatch(introStyles, /homeFoundationGenesis|background: #000 !important/);
  assert.doesNotMatch(introStyles, /data-command-fallback-brazil/);
});

test("frame estável continua contendo a Foundation original", () => {
  assert.match(sceneHost, /<CommandSceneFallback intent=\{normalizedIntent\} \/>/);
  assert.match(sceneHost, /<CommandSceneCanvas/);
  assert.match(sceneHost, /data-command-fallback-brazil/);
  assert.match(scene, /BrazilTerritoryAssembly/);
  assert.match(scene, /DomainTable/);
  assert.match(scene, /OrbitalCrown/);
  assert.match(scene, /StrategicGlobe/);
  assert.match(scene, /ProfileOrbAssembly/);
  assert.match(presets, /ENTRANCE_FOCUS_PRESETS/);
  assert.match(presets, /COMPACT_ENTRANCE_FOCUS_PRESETS/);
});

test("coreografia periférica usa tracks diferentes sem animar o Canvas", () => {
  assert.match(introStyles, /--home-intro-duration: 3000ms/);
  for (const name of [
    "homeAtmosphereIn",
    "homeChromeIn",
    "homeIdentitySettle",
    "homeCommandSettle",
    "homeFooterSettle",
  ]) {
    assert.match(introStyles, new RegExp(name));
  }
  assert.match(introStyles, /0%, 80%[\s\S]*homeCommandSettle|homeCommandSettle[\s\S]*0%, 80%/);
  assert.doesNotMatch(introStyles, /@keyframes homeFoundationGenesis/);
  assert.match(content, /data-home-identity/);
  assert.match(home, /data-home-command-dock/);
  assert.match(home, /data-home-footer/);
});

test("Foundation oferece âncoras semânticas sem seletores posicionais frágeis", () => {
  assert.match(sceneHost, /data-command-scene/);
  assert.match(sceneHost, /data-command-fallback/);
  assert.match(sceneHost, /data-command-canvas-layer/);
  assert.match(shell, /data-command-atmosphere/);
  assert.match(shell, /data-command-chrome/);
  assert.doesNotMatch(introStyles, /nth-child|first-child|last-child/);
});

test("ritual é pulável, reduced-motion/fallback assentam sem Genesis", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(home, /sceneState === "fallback"/);
  assert.match(scene, /!reducedMotion/);
  assert.match(scene, /intent\.entranceState !== "settled"/);
  assert.match(profileOrb, /if \(!root \|\| reducedMotion \|\| openingActive\) return/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(introStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("mobile preserva composição própria, safe-area e alvos touch", () => {
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.destinationRail \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(styles, /\.destination \{[\s\S]*min-height: 68px;/);
  assert.match(styles, /\.skipCeremony \{[\s\S]*min-height: 44px;/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /touch-action: manipulation/);
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
