import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PURE_MODULES = [
  "src/lib/shared/game-rules.ts",
  "src/lib/shared/game-round-rules.ts",
  "src/lib/shared/territory-connections.ts",
  "src/lib/shared/game-interaction.ts",
  "src/lib/shared/game-snapshot-hydration.ts",
  "src/lib/shared/game-command-patch.ts",
  "src/lib/shared/game-effective-connections.ts",
  "src/lib/shared/game-snapshot-sharing.ts",
  "src/lib/shared/game-view-model.ts",
  "src/lib/shared/game-map-focus.ts",
  "src/lib/shared/events/event-types.ts",
  "src/lib/shared/events/event-selector.ts",
  "src/lib/shared/events/event-catalog.ts",
  "src/lib/shared/events/event-resolver.ts",
  "src/lib/shared/events/event-topology.ts",
  "src/lib/shared/events/event-attack-rules.ts",
  "src/lib/shared/events/event-presentation.ts",
  "src/lib/shared/objectives/objective-presentation.ts",
  "src/lib/shared/bots/bot-action.ts",
  "src/lib/shared/bots/bot-attack.ts",
  "src/lib/shared/bots/bot-card-conquest.ts",
  "src/lib/shared/bots/bot-cards.ts",
  "src/lib/shared/bots/bot-combat-odds.ts",
  "src/lib/shared/bots/bot-conquest.ts",
  "src/lib/shared/bots/bot-defense.ts",
  "src/lib/shared/bots/bot-maneuver.ts",
  "src/lib/shared/bots/bot-objective-plan.ts",
  "src/lib/shared/bots/bot-reinforcement.ts",
  "src/lib/shared/bots/bot-required-actor.ts",
  "src/lib/shared/bots/bot-routing.ts",
  "src/lib/shared/bots/bot-state.ts",
  "src/lib/shared/bots/bot-strategy-config.ts",
  "src/lib/shared/bots/bot-strategy.ts",
  "src/lib/shared/bots/bot-territory-value.ts",
];

test("módulos puros de domínio não dependem de browser, React, banco ou server-only", () => {
  for (const path of PURE_MODULES) {
    const source = readFileSync(path, "utf8");

    assert.doesNotMatch(source, /from ["']react["']/i, path);
    assert.doesNotMatch(source, /server-only/, path);
    assert.doesNotMatch(source, /\bwindow\b/, path);
    assert.doesNotMatch(source, /\bdocument\b/, path);
    assert.doesNotMatch(source, /\bPoolClient\b|from ["']pg["']/i, path);
  }
});

test("módulos puros compilados pela suíte usam imports locais em vez de alias do bundler", () => {
  for (const path of PURE_MODULES) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from ["']@\//, path);
  }
});

test("configuração dedicada mantém a compilação dos testes fora do tsconfig de produção", () => {
  const config = readFileSync("tsconfig.test.json", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  assert.match(config, /"outDir"\s*:\s*"\.test-build"/);
  assert.match(config, /"rootDir"\s*:\s*"src\/lib"/);
  assert.match(config, /"module"\s*:\s*"commonjs"/);
  assert.equal(packageJson.scripts["test:compile"], "tsc -p tsconfig.test.json");
  assert.equal(packageJson.scripts.test, "npm run test:compile && npm run test:run");
});

test("UI de manobra reutiliza a regra centralizada de tropas movimentáveis", () => {
  const panel = readFileSync("src/components/game-turn-panel.tsx", "utf8");

  assert.match(panel, /maneuverMovableTroops\(/);
  assert.doesNotMatch(
    panel,
    /selectedSource\.troops\s*-\s*selectedSource\.movedInTurn\s*-\s*1/,
  );
});

test("sincronização delega hidratação e não recompõe topologia efetiva no hook", () => {
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(sync, /hydrateGameSnapshot\(payload, baseConnections\)/);
  assert.doesNotMatch(sync, /effectiveTerritoryConnections|effectiveGameConnections/);
});
