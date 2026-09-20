import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { normalizeOperationsRoomCode } = require(
  "../.test-build/client/operations/room-code.js",
);
const { fetchOperationsRequest, OperationsRequestError } = require(
  "../.test-build/client/operations/request.js",
);

const page = readFileSync("src/app/matchmaking/page.tsx", "utf8");
const operations = readFileSync("src/components/operations-console.tsx", "utf8");
const operationsTypes = readFileSync("src/components/operations-types.ts", "utf8");
const operationsRequest = readFileSync(
  "src/lib/client/operations/request.ts",
  "utf8",
);
const createRoom = readFileSync("src/components/create-room-button.tsx", "utf8");
const joinRoom = readFileSync("src/components/join-room-form.tsx", "utf8");
const serverRooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const states = readFileSync(
  "src/app/matchmaking/operations-states.module.css",
  "utf8",
);
const operationsStyles = readFileSync(
  "src/app/matchmaking/operations.module.css",
  "utf8",
);
const foundationBarrel = readFileSync(
  "src/components/pre-game/foundation/index.ts",
  "utf8",
);
const foundationScene = readFileSync(
  "src/components/pre-game/foundation/command-scene.tsx",
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

test("normalização de código preserva exatamente o comportamento vigente", () => {
  assert.equal(normalizeOperationsRoomCode(" A7C9K2 "), "a7c9k2");
  assert.equal(normalizeOperationsRoomCode("BR-42!"), "br-42");
  assert.equal(normalizeOperationsRoomCode("  ÁB C123? "), "bc123");
  assert.equal(normalizeOperationsRoomCode("---"), "---");
  assert.equal(normalizeOperationsRoomCode("   "), "");

  assert.match(joinRoom, /normalizeOperationsRoomCode\(roomCode\)/);
  assert.match(joinRoom, /placeholder="A7C9K2"/);
  assert.match(joinRoom, /inputMode="text"/);
  assert.match(joinRoom, /enterKeyHint="go"/);
  assert.match(joinRoom, /response\.status === 404 \|\| response\.status === 422/);
  assert.match(joinRoom, /onStatusChange\?\.\("invalid-code"\)/);
  assert.match(serverRooms, /\^\[A-Z0-9\]\{6\}\$/);
  assert.doesNotMatch(joinRoom, /maxLength=/);
});

test("helper de request classifica falha de rede e timeout de forma recuperável", async () => {
  await assert.rejects(
    () =>
      fetchOperationsRequest("/ops-network-test", undefined, {
        timeoutMs: 50,
        fetcher: async () => {
          throw new TypeError("offline");
        },
      }),
    (error) => {
      assert.ok(error instanceof OperationsRequestError);
      assert.equal(error.kind, "network");
      return true;
    },
  );

  const hangingFetcher = (_input, init = {}) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      );
    });

  await assert.rejects(
    () =>
      fetchOperationsRequest("/ops-timeout-test", undefined, {
        timeoutMs: 10,
        fetcher: hangingFetcher,
      }),
    (error) => {
      assert.ok(error instanceof OperationsRequestError);
      assert.equal(error.kind, "timeout");
      return true;
    },
  );
});

test("falhas de request liberam os estados pendentes para retry", () => {
  assert.match(operationsRequest, /globalThis\.setTimeout/);
  assert.match(operationsRequest, /globalThis\.clearTimeout/);
  assert.match(createRoom, /requestInFlightRef\.current = false/);
  assert.match(createRoom, /setIsCreating\(false\)/);
  assert.match(joinRoom, /requestInFlightRef\.current = false/);
  assert.match(joinRoom, /setIsJoining\(false\)/);
  assert.match(createRoom, /instanceof OperationsRequestError/);
  assert.match(joinRoom, /failureStatus = "network-error"/);
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

test("Operations consome o runtime Foundation sem renderer próprio", () => {
  assert.doesNotMatch(page, /<CommandShell|CommandSceneIntent|mode:\s*"operations"/);
  assert.match(operations, /useCommandSceneDirective\(sceneDirective\(mode, activeStatus\)\)/);
  assert.match(operations, /focus: "brazil"/);
  assert.match(operations, /territoryExplode: mode === "join" \? 0\.1 : 0\.08/);
  assert.match(operations, /orbitalAlignment: visual === "success" \? 1 : 0/);
  assert.match(foundationBarrel, /useCommandSceneDirective/);
  assert.match(foundationBarrel, /CommandSceneDirective/);
  assert.match(foundationScene, /CommandSceneFallback/);
  assert.match(foundationScene, /war-brasil-42\.production\.svg/);
  assert.doesNotMatch(page, /WarShell/);
  assert.doesNotMatch(page, /command-scene|command-scene-canvas/);
  assert.doesNotMatch(
    operations,
    /next\/image|war-brasil-42|data-ring|data-map-plate|@react-three|three\/|<Canvas|WebGLRenderer/,
  );
});

test("Operations recompõe a interface em mobile sem comprimir controles", () => {
  assert.match(page, /styles\.page/);
  assert.match(operations, /styles\.station/);
  assert.match(operationsStyles, /height:\s*100dvh/);
  assert.match(operationsStyles, /overflow:\s*hidden/);
  assert.match(operationsStyles, /@media \(max-width: 640px\)/);
  assert.match(operationsStyles, /@media \(max-height: 700px\)/);
  assert.match(
    operationsStyles,
    /@media \(max-width: 640px\) and \(max-height: 580px\)/,
  );
  assert.match(operationsStyles, /\.modePanel :global\(\.wb-button\)/);
  assert.match(operationsStyles, /\.modePanel :global\(\.wb-field\)/);
  assert.match(operationsStyles, /min-height:\s*38px/);
});

test("Operations preserva reduced-motion e fallback pela Foundation", () => {
  assert.match(states, /prefers-reduced-motion: reduce/);
  assert.match(operationsStyles, /prefers-reduced-motion: reduce/);
  assert.match(foundationScene, /prefers-reduced-motion: reduce/);
  assert.match(foundationScene, /data-webgl=\{webglState\}/);
  assert.doesNotMatch(operations, /WebGLRenderer|<Canvas/);
});
