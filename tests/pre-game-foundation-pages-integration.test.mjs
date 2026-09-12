import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const layout = source("src/app/layout.tsx");
const routeIntent = source(
  "src/components/pre-game/foundation/pre-game-route-intent.ts",
);
const commandShell = source(
  "src/components/pre-game/foundation/command-shell.tsx",
);
const commandCss = source(
  "src/components/pre-game/foundation/command-foundation.module.css",
);
const homePage = source("src/app/page.tsx");
const homeClient = source(
  "src/components/pre-game/home/command-home-client.tsx",
);
const operationsPage = source("src/app/matchmaking/page.tsx");
const operationsClient = source("src/components/operations-console.tsx");
const operationsCss = source(
  "src/app/matchmaking/operations-foundation.module.css",
);
const lobbyPage = source("src/app/lobby/[code]/page.tsx");
const lobbyClient = source("src/components/lobby-client.tsx");
const doctrinePage = source("src/app/rules/page.tsx");
const doctrineClient = source(
  "src/components/doctrine/doctrine-experience.tsx",
);
const doctrineCss = source(
  "src/components/doctrine/doctrine-foundation-integration.module.css",
);
const profilePage = source("src/app/profile/page.tsx");
const profileLoading = source("src/app/profile/loading.tsx");
const profileError = source("src/app/profile/error.tsx");
const profileBridge = source(
  "src/components/profile/profile-command-shell.tsx",
);
const profileBridgeCss = source(
  "src/components/profile/profile-command-shell.module.css",
);

const consumerSources = [
  homePage,
  homeClient,
  operationsPage,
  operationsClient,
  lobbyPage,
  lobbyClient,
  doctrinePage,
  doctrineClient,
  profilePage,
  profileLoading,
  profileError,
  profileBridge,
].join("\n");

test("as cinco experiências compartilham um único runtime no RootLayout", () => {
  assert.equal((layout.match(/<PreGameCommandRuntime>/g) ?? []).length, 1);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);

  assert.match(routeIntent, /"\/": "entrance"/);
  assert.match(routeIntent, /"\/matchmaking": "operations"/);
  assert.match(routeIntent, /startsWith\("\/lobby\/"\).*"lobby"/s);
  assert.match(routeIntent, /"\/rules": "doctrine"/);
  assert.match(routeIntent, /"\/profile": "profile"/);
});

test("páginas consumidoras não montam renderer, shell 3D ou câmera próprios", () => {
  assert.doesNotMatch(
    consumerSources,
    /@react-three\/fiber|three\/addons|from "three"|<Canvas\b|<CommandScene\b|<CommandShell\b|CameraDirector/,
  );
});

test("mode pertence à rota e clientes publicam somente diretivas semânticas", () => {
  for (const [name, client] of [
    ["Home", homeClient],
    ["Operations", operationsClient],
    ["Lobby", lobbyClient],
    ["Doctrine", doctrineClient],
    ["Profile", profileBridge],
  ]) {
    assert.match(client, /useCommandSceneDirective/, `${name} não publica scene directive`);
    assert.doesNotMatch(client, /\bmode\s*:\s*"(?:entrance|operations|lobby|doctrine|profile)"/, `${name} declarou mode local`);
  }
});

test("Foundation mantém renderer, atmosfera e chrome presos ao viewport", () => {
  assert.match(commandCss, /\.sceneHost\s*\{[\s\S]*?position: fixed;/);
  assert.match(commandCss, /\.atmosphere\s*\{[\s\S]*?position: fixed;/);
  assert.match(commandCss, /\.shellChrome\s*\{[\s\S]*?position: fixed;/);
  assert.match(commandCss, /\.shellContent\s*\{[\s\S]*?min-height: 100dvh;/);
});

test("Foundation fornece clearances e páginas longas os consomem", () => {
  assert.match(commandShell, /--command-content-top/);
  assert.match(commandShell, /--command-content-inline/);
  assert.match(commandShell, /--command-content-bottom/);

  assert.match(operationsCss, /var\(--command-content-top/);
  assert.match(operationsCss, /var\(--command-content-bottom/);
  assert.match(doctrineCss, /var\(--command-content-top/);
  assert.match(doctrineCss, /var\(--command-content-bottom/);
  assert.match(profileBridgeCss, /var\(--command-content-top/);
  assert.match(profileBridgeCss, /var\(--command-content-inline/);
});

test("Lobby reserva espaço para o chrome e para a barra fixa de ready", () => {
  assert.match(lobbyPage, /--command-content-top/);
  assert.match(lobbyPage, /9rem \+ env\(safe-area-inset-bottom\)/);
  assert.match(lobbyPage, /scrollPaddingBottom/);
  assert.match(lobbyClient, /aria-label="Preparação da partida"/);
});

test("Profile não reintroduz WarShell em loaded, loading ou error", () => {
  assert.match(profilePage, /ProfileSceneBridge/);
  assert.match(profileLoading, /ProfileSceneBridge/);
  assert.match(profileError, /ProfileSceneBridge/);
  assert.doesNotMatch(`${profilePage}\n${profileLoading}\n${profileError}`, /WarShell/);
  assert.match(profileBridge, /aria-label="Navegação do perfil"/);
});
