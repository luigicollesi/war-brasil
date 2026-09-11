import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const contract = source("src/components/pre-game/foundation/scene-contract.ts");
const presets = source("src/components/pre-game/foundation/scene-presets.ts");
const shell = source("src/components/pre-game/foundation/command-shell.tsx");
const scene = source("src/components/pre-game/foundation/command-scene.tsx");
const canvas = source("src/components/pre-game/foundation/command-scene-canvas.tsx");
const primitives = source("src/components/pre-game/foundation/command-primitives.tsx");
const css = source("src/components/pre-game/foundation/command-foundation.module.css");
const svg = source("public/war-brasil-42.production.svg");
const pkg = JSON.parse(source("package.json"));

function canonicalTerritoryIds() {
  return [...svg.matchAll(/<path\b[^>]*class="[^"]*territory[^"]*"[^>]*data-id="(\d+)"[^>]*>/g)].map(
    (match) => Number(match[1]),
  );
}

test("Foundation publica contrato declarativo pequeno sem coordenadas de câmera ou viewport", () => {
  for (const mode of ["entrance", "operations", "lobby", "doctrine", "profile"]) {
    assert.ok(contract.includes(`"${mode}"`), `modo ausente: ${mode}`);
  }
  for (const focus of ["earth", "brazil", "table", "insignia", "none"]) {
    assert.ok(contract.includes(`"${focus}"`), `foco ausente: ${focus}`);
  }

  assert.match(contract, /type CommandSceneIntent/);
  assert.match(contract, /conflictLevel\?: CommandConflictLevel/);
  assert.match(contract, /territoryExplode\?: number/);
  assert.match(contract, /orbitalAlignment\?: CommandOrbitalAlignment/);
  assert.doesNotMatch(contract, /quaternion|cameraPosition|cameraTarget|viewport|compact|\bx:\s*number|\by:\s*number|\bz:\s*number/);
  assert.match(presets, /resolveCommandCameraPose/);
});

test("CommandShell mantém um único host de cena e conteúdo funcional separado do WebGL", () => {
  assert.equal((shell.match(/<CommandScene\b/g) ?? []).length, 1);
  assert.match(shell, /<div className=\{styles\.shellContent\}>\{children\}<\/div>/);
  assert.doesNotMatch(shell, /Canvas|three|@react-three\/fiber/);
  assert.doesNotMatch(shell, /key=\{normalizedIntent\.mode\}/);
  assert.match(scene, /dynamic\(/);
  assert.match(scene, /ssr: false/);
  assert.match(scene, /CommandSceneFallback/);
  assert.match(scene, /SceneErrorBoundary/);
});

test("renderer é único, reduz motion/loops e reage a perda do contexto WebGL", () => {
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
  assert.match(canvas, /frameloop=\{reducedMotion \? "demand" : "always"\}/);
  assert.match(scene, /prefers-reduced-motion: reduce/);
  assert.match(canvas, /webglcontextlost/);
  assert.match(canvas, /if \(reducedMotion\) return/);
  assert.match(canvas, /dpr=\{\[1, maxDpr\]\}/);
  assert.doesNotMatch(canvas, /shadowMap|castShadow|receiveShadow/);
});

test("composição compacta é interna, determinística e cobre mobile/tablet do EVAL", () => {
  assert.match(scene, /useMediaQuery\("\(max-width: 900px\)"\)/);
  assert.match(scene, /data-compact-scene=\{compactScene \? "true" : "false"\}/);
  assert.match(scene, /compact=\{compactScene\}/);
  assert.match(scene, /sizes="\(max-width: 900px\) 72vw, 46vw"/);
  assert.match(presets, /COMPACT_MODE_PRESETS/);
  assert.match(presets, /COMPACT_FOCUS_TARGETS/);
  assert.match(presets, /compact = false/);
  assert.match(canvas, /const DESKTOP_LAYOUT: SceneLayout/);
  assert.match(canvas, /const COMPACT_LAYOUT: SceneLayout/);
  assert.match(canvas, /objectScale: 0\.82/);
  assert.match(canvas, /<ArchitecturalRails compact=\{compact\} \/>/);
  assert.match(canvas, /if \(compact\) return null/);
});

test("Brasil 2.5D deriva somente do SVG canônico e mantém os 42 ids únicos", () => {
  const ids = canonicalTerritoryIds();
  assert.equal(ids.length, 42);
  assert.equal(new Set(ids).size, 42);
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 42 }, (_, index) => index + 1));

  assert.match(svg, /id="territory-1"[^>]*data-id="1"/);
  assert.match(svg, /id="territory-42"[^>]*data-id="42"/);
  assert.match(canvas, /CANONICAL_TERRITORY_COUNT = 42/);
  assert.match(canvas, /getAttribute\("data-id"\)/);
  assert.match(canvas, /useLoader\(SVGLoader, "\/war-brasil-42\.production\.svg"\)/);
  assert.match(canvas, /SVGLoader\.createShapes/);
  assert.match(canvas, /new ExtrudeGeometry/);
  assert.match(canvas, /new EdgesGeometry/);
  assert.match(canvas, /BrazilTerritoryAssembly/);
  assert.match(canvas, /territoryId: number/);
  assert.doesNotMatch(canvas, /data-territory-id|String\(pathIndex \+ 1\)/);
  assert.doesNotMatch(canvas, /position-x=\{.*territoryExplode|position-y=\{.*territoryExplode/);
});

test("territórios cenográficos não expõem seleção acidental antes de existir interação", () => {
  const start = canvas.indexOf("function BrazilTerritoryAssembly");
  const end = canvas.indexOf("function OrbitalCrown");
  const assembly = canvas.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(assembly, /onClick=|onPointer|onTouch|onKeyDown|tabIndex/);
});

test("Mesa, Globo e Coroa Orbital permanecem objetos de assinatura identificáveis", () => {
  assert.match(canvas, /name="StrategicGlobe"/);
  assert.match(canvas, /name="DomainTable"/);
  assert.match(canvas, /name="BrazilTerritoryAssembly"/);
  assert.match(canvas, /name="OrbitalCrown"/);
  assert.match(canvas, /name="OrbitalCrown-Territory"/);
  assert.match(canvas, /name="OrbitalCrown-Command"/);
  assert.match(canvas, /name="OrbitalCrown-Conflict"/);
  assert.match(canvas, /name="CommandInsignia"/);
});

test("fallback 2D permanece visível até o Brasil 3D estar realmente pronto", () => {
  assert.match(scene, /war-brasil-42\.production\.svg/);
  assert.match(scene, /fallbackTable/);
  assert.match(scene, /fallbackCrownRingA/);
  assert.match(scene, /fallbackCrownRingB/);
  assert.match(scene, /fallbackCrownRingC/);
  assert.match(scene, /sceneFailed \? "fallback"/);
  assert.match(canvas, /<BrazilTerritoryAssembly[\s\S]*?onReady=\{onReady\}[\s\S]*?\/>/);
  assert.match(canvas, /useEffect\(\(\) => \{\s*onReady\(\);/);
  assert.doesNotMatch(canvas, /onCreated=\{\(\{ gl \}\) => \{[\s\S]*?onReady\(\)/);
  assert.match(css, /\.canvasLayer \{[\s\S]*?opacity: 0/);
  assert.match(css, /\.sceneHost\[data-webgl="ready"\] \.canvasLayer/);
  assert.match(css, /\.sceneHost\[data-webgl="ready"\] \.sceneFallback/);
});

test("primitives 2D não dependem só de cor e compartilham tokens da Foundation", () => {
  assert.match(primitives, /role="status"/);
  assert.match(primitives, /role="img"/);
  assert.match(primitives, /aria-label=\{accessibleLabel\}/);
  assert.match(primitives, /<small>\{status\}<\/small>/);
  assert.match(shell, /COMMAND_FOUNDATION_TOKENS/);
  assert.match(css, /var\(--command-brass-bright/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Foundation não adiciona segunda stack de renderer ou animação", () => {
  assert.ok(pkg.dependencies["@react-three/fiber"]);
  assert.ok(pkg.dependencies.three);
  assert.equal(pkg.dependencies["@react-spring/three"], undefined);
  assert.equal(pkg.dependencies["framer-motion"], undefined);
  assert.equal(pkg.dependencies["motion"], undefined);
});
