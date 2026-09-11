import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const identity = readFileSync("src/app/war-identity.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");
const matchmaking = readFileSync("src/app/matchmaking/page.tsx", "utf8");
const operations = readFileSync("src/components/operations-console.tsx", "utf8");
const operationsStyles = readFileSync("src/app/matchmaking/operations.module.css", "utf8");
const createRoom = readFileSync("src/components/create-room-button.tsx", "utf8");
const joinRoom = readFileSync("src/components/join-room-form.tsx", "utf8");
const operationsRequest = readFileSync("src/lib/client/operations/request.ts", "utf8");
const roomCode = readFileSync("src/lib/client/operations/room-code.ts", "utf8");
const lobbyPage = readFileSync("src/app/lobby/[code]/page.tsx", "utf8");
const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const shell = readFileSync("src/components/war-shell.tsx", "utf8");

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

test("matchmaking usa runtime Foundation persistente e preserva shells das trilhas ainda isoladas", () => {
  assert.match(shell, /wb-shell/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.match(home, /<WarShell immersive>/);
  assert.doesNotMatch(matchmaking, /<CommandShell|<WarShell/);
  assert.match(operations, /useCommandSceneDirective/);
  assert.match(lobbyPage, /<WarShell/);
});

test("matchmaking usa uma estação com dois modos em vez de cards independentes", () => {
  assert.match(matchmaking, /<OperationsConsole \/>/);
  assert.match(operations, /role="tablist"/);
  assert.match(operations, /role="tabpanel"/);
  assert.match(operations, /Nova operação/);
  assert.match(operations, /Localizar operação/);
  assert.doesNotMatch(operations, /war-brasil-42\.production\.svg/);
  assert.doesNotMatch(matchmaking, /wb-matchmaking-grid|wb-matchmaking-separator/);
  assert.doesNotMatch(matchmaking, /rounded-3xl|shadow-\[/);
});

test("operações preserva requests, normalização e protege submissões repetidas", () => {
  assert.match(createRoom, /fetchOperationsRequest\("\/api\/rooms"/);
  assert.match(createRoom, /requestInFlightRef\.current/);
  assert.match(createRoom, /disabled=\{isCreating\}/);
  assert.match(joinRoom, /fetchOperationsRequest\("\/api\/rooms\/join"/);
  assert.match(joinRoom, /normalizeOperationsRoomCode\(roomCode\)/);
  assert.match(roomCode, /\.trim\(\)[\s\S]*\.toLowerCase\(\)[\s\S]*\.replace\(\/\[\^a-z0-9-\]\//);
  assert.match(joinRoom, /requestInFlightRef\.current/);
  assert.match(joinRoom, /disabled=\{isJoining\}/);
  assert.match(joinRoom, /value=\{roomCode\}/);
  assert.match(operationsRequest, /AbortController/);
  assert.match(operationsRequest, /15_000/);
  assert.match(operations, /commandLocked/);
  assert.match(operations, /disabled=\{disabled\}/);
});

test("operações segue teclado horizontal de tabs e não captura scroll vertical", () => {
  assert.match(operations, /ArrowRight/);
  assert.match(operations, /ArrowLeft/);
  assert.match(operations, /Home/);
  assert.match(operations, /End/);
  assert.doesNotMatch(operations, /ArrowUp|ArrowDown/);
});

test("operações explicita reduced-motion e foco visível", () => {
  assert.match(operationsStyles, /prefers-reduced-motion: reduce/);
  assert.match(operationsStyles, /focus-visible/);
  assert.match(operations, /aria-live="polite"/);
  assert.match(joinRoom, /aria-invalid=\{Boolean\(error\)\}/);
});

test("lobby usa sala de comando com seis posições, mapa e ready rail", () => {
  assert.match(lobby, /6 - players\.length/);
  assert.match(lobby, /wb-lobby-map/);
  assert.match(lobby, /wb-ready-rail/);
  assert.match(lobby, /Pronto para batalha/);
  assert.match(lobby, /Sala sincronizada/);
  assert.doesNotMatch(lobby, /Atualiza a cada 1 s/);
});

test("ações principais usam os primitivos visuais compartilhados", () => {
  assert.match(identity, /\.wb-button--primary/);
  assert.match(identity, /\.wb-field/);
  assert.match(identity, /\.wb-status/);
  assert.match(identity, /\.wb-diamond/);
});
