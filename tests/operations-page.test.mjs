import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/matchmaking/page.tsx", "utf8");
const operations = readFileSync("src/components/operations-console.tsx", "utf8");
const operationsTypes = readFileSync("src/components/operations-types.ts", "utf8");
const operationsRequest = readFileSync("src/components/operations-request.ts", "utf8");
const createRoom = readFileSync("src/components/create-room-button.tsx", "utf8");
const joinRoom = readFileSync("src/components/join-room-form.tsx", "utf8");
const serverRooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const states = readFileSync(
  "src/app/matchmaking/operations-states.module.css",
  "utf8",
);
const responsive = readFileSync(
  "src/app/matchmaking/operations-responsive.module.css",
  "utf8",
);

test("Operations expõe os estados semânticos exigidos pelo spec", () => {
  for (const state of [
    "creating",
    "create-error",
    "joining",
    "invalid-code",
    "network-error",
    "success-transition",
  ]) {
    assert.match(operationsTypes, new RegExp(`"${state}"`));
  }

  assert.match(operationsTypes, /"create-focus"/);
  assert.match(operationsTypes, /"join-focus"/);
  assert.match(operationsTypes, /"typing-code"/);
  assert.match(operations, /data-interaction=\{interaction\}/);
  assert.match(operations, /data-state=\{activeStatus\}/);
  assert.match(operations, /data-scene-state="scene-fallback"/);
  assert.match(states, /data-state="creating"/);
  assert.match(states, /data-state="joining"/);
  assert.match(states, /data-state="invalid-code"/);
  assert.match(states, /data-state="network-error"/);
  assert.match(states, /data-state="success-transition"/);
});

test("Operations usa tabs horizontais com painel alcançável por teclado", () => {
  assert.match(operations, /role="tablist"/);
  assert.match(operations, /aria-orientation="horizontal"/);
  assert.match(operations, /role="tabpanel"/);
  assert.match(operations, /tabIndex=\{0\}/);
  assert.match(operations, /ArrowRight/);
  assert.match(operations, /ArrowLeft/);
  assert.doesNotMatch(operations, /ArrowUp|ArrowDown/);
});

test("Localizar operação preserva normalização vigente e usa exemplo compatível com o servidor", () => {
  assert.equal((joinRoom.match(/<input/g) ?? []).length, 1);
  assert.match(joinRoom, /value=\{roomCode\}/);
  assert.match(joinRoom, /\.trim\(\)[\s\S]*\.toLowerCase\(\)[\s\S]*\.replace\(\/\[\^a-z0-9-\]\//);
  assert.match(joinRoom, /placeholder="A7C9K2"/);
  assert.match(joinRoom, /inputMode="text"/);
  assert.match(joinRoom, /enterKeyHint="go"/);
  assert.match(joinRoom, /response\.status === 404 \|\| response\.status === 422/);
  assert.match(joinRoom, /onStatusChange\?\.\("invalid-code"\)/);
  assert.match(serverRooms, /\^\[A-Z0-9\]\{6\}\$/);
  assert.doesNotMatch(joinRoom, /maxLength=/);
});

test("Falha de rede e timeout são recuperáveis e distintos de erro funcional", () => {
  assert.match(operationsRequest, /class OperationsRequestError extends Error/);
  assert.match(operationsRequest, /"timeout"/);
  assert.match(operationsRequest, /"network"/);
  assert.match(createRoom, /instanceof OperationsRequestError/);
  assert.match(createRoom, /"create-error"/);
  assert.match(joinRoom, /failureStatus = "network-error"/);
  assert.match(joinRoom, /"join-error"/);
  assert.match(operations, /Falha de comunicação — tente novamente/);
});

test("Create e Join mantêm endpoints, proteção de duplicidade e destinos vigentes", () => {
  assert.match(createRoom, /fetchOperationsRequest\("\/api\/rooms"/);
  assert.match(joinRoom, /fetchOperationsRequest\("\/api\/rooms\/join"/);
  assert.match(createRoom, /requestInFlightRef\.current/);
  assert.match(joinRoom, /requestInFlightRef\.current/);
  assert.match(createRoom, /onStatusChange\?\.\("creating"\)/);
  assert.match(joinRoom, /onStatusChange\?\.\("joining"\)/);
  assert.match(createRoom, /onStatusChange\?\.\("success-transition"\)/);
  assert.match(joinRoom, /onStatusChange\?\.\("success-transition"\)/);
  assert.match(createRoom, /router\.push\(`\/lobby\/\$\{encodeURIComponent\(data\.room\.code\)\}`\)/);
  assert.match(joinRoom, /router\.push\(`\/lobby\/\$\{encodeURIComponent\(data\.room\.code\)\}`\)/);
});

test("Operations mantém fallback 2D e reduced-motion sem depender de WebGL", () => {
  assert.match(operations, /war-brasil-42\.production\.svg/);
  assert.match(operations, /data-scene-state="scene-fallback"/);
  assert.match(states, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(operations, /@react-three|three\/|<Canvas|WebGLRenderer/);
});

test("Operations recompõe a cena em viewport móvel baixo sem comprimir controles", () => {
  assert.match(page, /responsiveStyles\.pageAdaptive/);
  assert.match(operations, /responsiveStyles\.stationAdaptive/);
  assert.match(responsive, /max-width: 720px/);
  assert.match(responsive, /max-height: 640px/);
  assert.match(responsive, /\[data-map-bay\]/);
  assert.match(responsive, /min-height: 116px/);
  assert.match(responsive, /input\[name="roomCode"\]/);
  assert.match(responsive, /scroll-margin-block: 24vh/);
});
