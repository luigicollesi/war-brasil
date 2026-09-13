import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const identity = readFileSync("src/app/war-identity.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");
const homeClient = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const matchmaking = readFileSync("src/app/matchmaking/page.tsx", "utf8");
const operations = readFileSync("src/components/operations-console.tsx", "utf8");
const operationsStyles = readFileSync(
  "src/app/matchmaking/operations.module.css",
  "utf8",
);
const createRoom = readFileSync("src/components/create-room-button.tsx", "utf8");
const joinRoom = readFileSync("src/components/join-room-form.tsx", "utf8");
const operationsRequest = readFileSync("src/lib/client/operations/request.ts", "utf8");
const roomCode = readFileSync("src/lib/client/operations/room-code.ts", "utf8");
const lobbyPage = readFileSync("src/app/lobby/[code]/page.tsx", "utf8");
const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const shell = readFileSync("src/components/war-shell.tsx", "utf8");
const foundation = readFileSync(
  "src/components/pre-game/foundation/index.ts",
  "utf8",
);
const foundationScene = readFileSync(
  "src/components/pre-game/foundation/command-scene.tsx",
  "utf8",
);

test("identidade centraliza a paleta e tipografia do pré-jogo", () => {
  assert.match(identity, /--wb-bg:/);
  assert.match(identity, /--wb-gold:/);
  assert.match(identity, /--wb-blue:/);
  assert.match(identity, /--wb-text:/);
  assert.match(identity, /--wb-motion-normal:/);
  assert.match(layout, /war-identity\.css/);
  assert.match(layout, /Barlow_Condensed/);
  assert.match(layout, /Inter/);
});

test("Home, Operations e Lobby compartilham o runtime Foundation persistente", () => {
  assert.match(shell, /wb-shell/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.match(home, /<CommandHomeClient>/);
  assert.match(homeClient, /useCommandSceneDirective\(sceneIntent\)/);
  assert.doesNotMatch(home, /<WarShell/);
  assert.doesNotMatch(matchmaking, /<CommandShell|<WarShell/);
  assert.match(operations, /useCommandSceneDirective/);
  assert.doesNotMatch(lobbyPage, /<WarShell/);
  assert.match(lobbyPage, /<LobbyClient code=\{code\} \/>/);
  assert.match(lobby, /useCommandSceneDirective/);
  assert.match(foundation, /PreGameCommandRuntime/);
  assert.match(foundation, /useCommandSceneDirective/);
});

test("Operations separa jogo clássico bloqueado de sala personalizada operacional", () => {
  assert.match(matchmaking, /<OperationsConsole \/>/);
  assert.match(operations, /data-game-mode="classic"/);
  assert.match(operations, /Jogo clássico/);
  assert.match(operations, /Encontrar partida/);
  assert.match(operations, /type="button"[\s\S]*?disabled[\s\S]*?classicButton/);
  assert.match(operations, /data-game-mode="custom"/);
  assert.match(operations, /Sala personalizada/);
  assert.match(operations, /role="tablist"/);
  assert.match(operations, /role="tabpanel"/);
  assert.match(operations, /Criar sala/);
  assert.match(operations, /Entrar em sala/);
  assert.doesNotMatch(matchmaking, /wb-matchmaking-grid|wb-matchmaking-separator/);
  assert.doesNotMatch(operations, /war-brasil-42\.production\.svg/);
});

test("Matchmaking mantém a estação dentro da viewport e reduz movimento quando solicitado", () => {
  assert.match(operationsStyles, /height:\s*100dvh/);
  assert.match(operationsStyles, /overflow:\s*hidden/);
  assert.match(operationsStyles, /@media \(max-height: 700px\)/);
  assert.match(operationsStyles, /@media \(max-width: 640px\) and \(max-height: 580px\)/);
  assert.match(operationsStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(operationsStyles, /stationEnter/);
});

test("Operations preserva requests, normalização e proteção contra submissão repetida", () => {
  assert.match(createRoom, /fetchOperationsRequest\("\/api\/rooms"/);
  assert.match(createRoom, /requestInFlightRef\.current/);
  assert.match(joinRoom, /fetchOperationsRequest\("\/api\/rooms\/join"/);
  assert.match(joinRoom, /normalizeOperationsRoomCode\(roomCode\)/);
  assert.match(roomCode, /\.trim\(\)[\s\S]*\.toLowerCase\(\)[\s\S]*\.replace\(/);
  assert.match(joinRoom, /requestInFlightRef\.current/);
  assert.match(operationsRequest, /AbortController/);
  assert.match(operationsRequest, /15_000/);
});

test("Lobby usa seis posições e delega a Mesa para a Foundation", () => {
  assert.match(lobby, /6 - players\.length/);
  assert.match(lobby, /focus: "table"/);
  assert.match(lobby, /sceneStartAuthorized/);
  assert.match(lobby, /sceneAllReady/);
  assert.doesNotMatch(lobby, /war-brasil-42\.production\.svg|wb-lobby-map/);
  assert.match(foundationScene, /war-brasil-42\.production\.svg/);
  assert.match(lobby, /Sala sincronizada/);
  assert.doesNotMatch(lobby, /Atualiza a cada 1 s/);
});

test("ações principais preservam os primitivos visuais compartilhados", () => {
  assert.match(identity, /\.wb-button--primary/);
  assert.match(identity, /\.wb-field/);
  assert.match(identity, /\.wb-status/);
  assert.match(identity, /\.wb-diamond/);
});
