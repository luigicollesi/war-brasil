import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/page.tsx", "utf8");
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const content = readFileSync(
  "src/components/pre-game/home/command-home-content.tsx",
  "utf8",
);
const intent = readFileSync(
  "src/components/pre-game/home/command-home-scene-intent.ts",
  "utf8",
);
const fallbackMarker = readFileSync(
  "src/components/pre-game/home/command-home-fallback.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/components/pre-game/home/command-home.module.css",
  "utf8",
);
const foundationIndex = readFileSync(
  "src/components/pre-game/foundation/index.ts",
  "utf8",
);

const legacyPolishPath =
  "src/components/pre-game/home/command-home-polish.module.css";

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
  assert.match(home, /import \{ useCommandSceneDirective \} from "\.\.\/foundation"/);
  assert.match(intent, /import type \{ CommandSceneDirective \} from "\.\.\/foundation"/);
  assert.match(foundationIndex, /useCommandSceneDirective/);
  assert.match(foundationIndex, /CommandSceneDirective/);

  const homeSources = `${home}\n${content}\n${intent}`;
  assert.doesNotMatch(homeSources, /@react-three\/fiber/);
  assert.doesNotMatch(homeSources, /from "three"/);
  assert.doesNotMatch(homeSources, /command-scene-canvas/);
  assert.doesNotMatch(homeSources, /scene-presets/);
  assert.doesNotMatch(homeSources, /CameraDirector/);
  assert.doesNotMatch(homeSources, /<Canvas/);
  assert.doesNotMatch(homeSources, /<CommandShell/);

  assert.match(fallbackMarker, /HOME_FALLBACK_OWNER = "Foundation CommandShell"/);
  assert.doesNotMatch(fallbackMarker, /next\/image|<Image|war-brasil-42|globe|domainTable|orbit/i);
  assert.equal(existsSync(legacyPolishPath), false);
});

test("HOME substitui o hero legado e publica intenção no runtime persistente", () => {
  assert.doesNotMatch(page, /GameQuickGuide/);
  assert.doesNotMatch(page, /HomeTerritoryMap/);
  assert.doesNotMatch(page, /WarShell/);
  assert.match(content, /WAR/);
  assert.match(content, /BRASIL/);
  assert.match(home, /ENTRAR NO COMANDO/);
  assert.match(home, /data-home-state=\{homeState\}/);
  assert.match(home, /data-scene="foundation"/);
  assert.match(home, /useCommandSceneDirective\(sceneIntent\)/);
});

test("HOME expõe os três destinos como links DOM com as rotas do spec", () => {
  assert.match(home, /href: "\/matchmaking"/);
  assert.match(home, /label: "OPERAÇÕES"/);
  assert.match(home, /href: "\/rules"/);
  assert.match(home, /label: "DOUTRINA"/);
  assert.match(home, /href: "\/profile"/);
  assert.match(home, /label: "COMANDO"/);
  assert.match(home, /<Link/);
  assert.match(home, /aria-label="Destinos do comando"/);
});

test("adapter cobre Terra, Brasil, Mesa e autorização sem coordenadas", () => {
  assert.match(intent, /ceremonyPhase === "earth"/);
  assert.match(intent, /focus: "earth"/);
  assert.match(intent, /ceremonyPhase === "brazil"/);
  assert.match(intent, /focus: "brazil"/);
  assert.match(intent, /focus: "table"/);
  assert.match(intent, /orbitalAlignment: 1/);
  assert.doesNotMatch(intent, /\b(?:x|y|z|fov|quaternion|camera|material)\s*:/i);
  assert.doesNotMatch(intent, /\bmode\s*:/);
});

test("adapter mapeia focos dos destinos para diretivas semânticas", () => {
  assert.match(intent, /operations:[\s\S]*conflictLevel: 1[\s\S]*territoryExplode: 0\.08/);
  assert.match(intent, /doctrine:[\s\S]*territoryExplode: 0\.12/);
  assert.match(intent, /profile:[\s\S]*focus: "insignia"/);
  assert.match(intent, /transitioningTo \?\? destinationFocus/);
});

test("ritual é pulável e repeat/reduced-motion derivam estado estável", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /useSyncExternalStore/);
  assert.match(home, /sessionStorage\.getItem\(HOME_RITUAL_SESSION_KEY\)/);
  assert.match(home, /sessionStorage\.setItem\(HOME_RITUAL_SESSION_KEY, "1"\)/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(home, /visitMode === "first" \? ceremonyPhase : "stable"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("cerimônia Terra -> Brasil -> Mesa não bloqueia a ação principal", () => {
  assert.match(home, /useState<HomeCeremonyPhase>\("earth"\)/);
  assert.match(home, /if \(current === "earth"\) return "brazil"/);
  assert.match(home, /if \(current === "brazil"\) return "table"/);
  assert.match(home, /if \(current === "table"\) return "stable"/);
  assert.match(home, /const enterCommand = \(\) =>/);
  assert.match(home, /onClick=\{enterCommand\}/);
});

test("mobile possui composição própria, safe-area e alvos touch grandes", () => {
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.destinationRail \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(styles, /\.destination \{[\s\S]*min-height: 68px;/);
  assert.match(styles, /\.skipCeremony \{[\s\S]*min-height: 44px;/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /@media \(hover: none\) and \(pointer: coarse\)/);
  assert.match(home, /tabIndex=\{-1\}/);
});

test("foco de teclado tem prioridade sobre intenção efêmera do ponteiro", () => {
  assert.match(home, /keyboardDestinationFocus \?\? pointerDestinationFocus/);
  assert.match(home, /onFocus=\{\(\) => setKeyboardDestinationFocus\(destination\.id\)\}/);
  assert.match(home, /onBlur=\{\(\) => clearKeyboardFocus\(destination\.id\)\}/);
  assert.match(home, /onPointerEnter=\{\(\) => setPointerDestinationFocus\(destination\.id\)\}/);
  assert.match(home, /onPointerLeave=\{\(\) => clearPointerFocus\(destination\.id\)\}/);
});

test("vermelho local permanece restrito ao destino Operações", () => {
  assert.match(styles, /destination\[data-destination="operations"\]/);
  assert.match(styles, /rgb\(139 32 38 \/ 12%\)/);
  assert.doesNotMatch(styles, /pulse|pulsing/i);
});
