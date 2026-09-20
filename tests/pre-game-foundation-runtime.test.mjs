import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const layout = source("src/app/layout.tsx");
const runtime = source(
  "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
);
const routes = source(
  "src/components/pre-game/foundation/pre-game-route-intent.ts",
);
const barrel = source("src/components/pre-game/foundation/index.ts");

test("RootLayout monta um único runtime persistente ao redor das páginas", () => {
  assert.equal((layout.match(/<PreGameCommandRuntime>/g) ?? []).length, 1);
  assert.match(
    layout,
    /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/,
  );
  assert.doesNotMatch(layout, /CommandScene|CommandShell|Canvas/);
});

test("runtime resolve scene mode pela rota sem expor câmera ou renderer", () => {
  assert.match(runtime, /usePathname\(\)/);
  assert.equal((runtime.match(/<CommandShell\b/g) ?? []).length, 1);
  assert.doesNotMatch(runtime, /Canvas|@react-three\/fiber|three\/|cameraPosition|fov/i);

  assert.match(routes, /"\/": "entrance"/);
  assert.match(routes, /"\/matchmaking": "operations"/);
  assert.match(routes, /"\/rules": "doctrine"/);
  assert.match(routes, /"\/profile": "profile"/);
  assert.match(routes, /startsWith\("\/lobby\/"\).*"lobby"/s);
  assert.match(routes, /return null/);
});

test("diretiva pública não permite trocar mode e não vaza entre rotas", () => {
  const directiveBlock = runtime.match(
    /export type CommandSceneDirective = Readonly<\{([\s\S]*?)\}>;/,
  );
  assert.ok(directiveBlock, "CommandSceneDirective ausente");
  assert.doesNotMatch(directiveBlock[1], /\bmode\b/);
  assert.match(directiveBlock[1], /focus\?:/);
  assert.match(directiveBlock[1], /conflictLevel\?:/);
  assert.match(directiveBlock[1], /territoryExplode\?:/);
  assert.match(directiveBlock[1], /orbitalAlignment\?:/);

  assert.match(runtime, /registration\.pathname !== pathname/);
  assert.match(runtime, /mode: routeIntent\.mode/);
});

test("renderer permanece interno e páginas recebem apenas API semântica", () => {
  assert.match(barrel, /PreGameCommandRuntime/);
  assert.match(barrel, /useCommandSceneDirective/);
  assert.match(barrel, /CommandSceneDirective/);
  assert.match(barrel, /resolvePreGameSceneMode/);
  assert.doesNotMatch(barrel, /CommandSceneCanvas/);
  assert.doesNotMatch(barrel, /from "\.\/command-scene"/);
});

test("rotas fora do pré-jogo não montam CommandShell", () => {
  assert.match(runtime, /if \(!intent\) return <>\{children\}<\/>;/);
  assert.doesNotMatch(routes, /"\/game"\s*:/);
});
