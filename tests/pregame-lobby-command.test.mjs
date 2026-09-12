import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const styles = readFileSync("src/components/lobby-client.module.css", "utf8");
const identity = readFileSync("src/app/war-identity.css", "utf8");
const sync = readFileSync("src/hooks/use-lobby-sync.ts", "utf8");
const syncCoordinator = readFileSync(
  "src/lib/client/lobby-sync-coordinator.ts",
  "utf8",
);
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const foundationScene = readFileSync(
  "src/components/pre-game/foundation/command-scene.tsx",
  "utf8",
);
const foundationRuntime = readFileSync(
  "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  "utf8",
);

test("lobby usa o snapshot vigente como fonte de verdade e assentos estáveis", () => {
  assert.match(lobby, /const \{ snapshot, error: syncError, isLoading, refresh \} = useLobbySync\(code\)/);
  assert.match(lobby, /players\.map\(\(player, index\) =>/);
  assert.match(lobby, /slot=\{index \+ 1\}/);
  assert.match(rooms, /ORDER BY joined_at ASC, id ASC/);
  assert.doesNotMatch(lobby, /setPlayers|setReadyPlayers|setStations|useReducer/);
});

test("entrada, saída e ready continuam sincronizados sem reload manual", () => {
  assert.match(sync, /const POLLING_INTERVAL_MS = 1_000/);
  assert.match(sync, /createLobbySyncCoordinator/);
  assert.match(sync, /coordinator\.sync\(\)/);
  assert.match(sync, /refreshRef\.current = coordinator\.refreshAfterCurrent/);
  assert.match(syncCoordinator, /if \(inFlight\) return inFlight/);
  assert.match(syncCoordinator, /const current = inFlight/);
  assert.match(syncCoordinator, /await current/);
  assert.match(syncCoordinator, /return sync\(\)/);
  assert.match(sync, /setSnapshot\(data as LobbySnapshot\)/);
  assert.match(sync, /window\.setTimeout\(\(\) => void poll\(\), POLLING_INTERVAL_MS\)/);
  assert.match(sync, /const refresh = useCallback\(\(\) => refreshRef\.current\(\), \[\]\)/);
  assert.match(lobby, /await refresh\(\)/);
  assert.doesNotMatch(lobby, /location\.reload|window\.location\.reload/);
});

test("ready permanece confirmado pelo servidor e perceptível sem depender de cor", () => {
  assert.match(lobby, /await refresh\(\)/);
  assert.match(lobby, /aria-pressed=\{me\.isReady\}/);
  assert.match(lobby, /player\.isReady \? "✓ Pronto" : "• Configurando"/);
  assert.match(lobby, /data-ready=\{player\.isReady \? "true" : "false"\}/);
  assert.match(styles, /\.station\[data-ready="true"\] \.insignia/);
});

test("ready pendente não antecipa estado e falha aparece junto da ação", () => {
  assert.match(lobby, /scope: "profile" \| "ready" \| "bot" \| "copy"/);
  assert.match(lobby, /scope: action/);
  assert.match(lobby, /const readyPending = pendingAction === "ready"/);
  assert.match(lobby, /aguardando confirmação do servidor/);
  assert.match(lobby, /const readyError = actionError\?\.scope === "ready"/);
  assert.match(lobby, /aria-busy=\{readyPending\}/);
  assert.doesNotMatch(lobby, /set.*Ready/);
});

test("ação crítica de ready permanece fora da cena e fixa à viewport", () => {
  assert.match(lobby, /className=\{`wb-ready-rail \$\{styles\.readyRail\}/);
  assert.match(lobby, /aria-label="Preparação da partida"/);
  assert.match(identity, /\.wb-ready-rail\s*\{[\s\S]*?position:\s*fixed/);
  assert.doesNotMatch(lobby, /useThree|Camera|camera\./);
});

test("Lobby publica diretiva sem criar um segundo CommandShell ou renderer", () => {
  assert.match(lobby, /useCommandSceneDirective/);
  assert.match(lobby, /focus: "table"/);
  assert.match(lobby, /conflictLevel: sceneStartAuthorized \? 3 : sceneAllReady \? 1 : 0/);
  assert.match(lobby, /orbitalAlignment: sceneStartAuthorized \? 1 : 0/);
  assert.match(foundationRuntime, /<CommandShell intent=\{intent\}>/);
  assert.doesNotMatch(lobby, /<CommandShell|CommandSceneIntent|@react-three|from "three"|CommandSceneCanvas|useThree/);
});

test("código da operação permanece copiável, selecionável e com recuperação local", () => {
  assert.match(lobby, /navigator\.clipboard\.writeText\(code\.toUpperCase\(\)\)/);
  assert.match(lobby, /aria-label=\{`Copiar código da sala \$\{roomCode\}`\}/);
  assert.match(lobby, /scope: "copy"/);
  assert.match(lobby, /Cópia automática indisponível/);
  assert.match(lobby, /Compartilhe este código para convocar outros comandos/);
  assert.match(styles, /user-select: all/);
});

test("reconexão mantém última formação, anuncia estado e oferece retry", () => {
  assert.match(sync, /setSnapshot\(data as LobbySnapshot\)/);
  assert.match(lobby, /Reconectando ao comando/);
  assert.match(lobby, /última formação confirmada permanece visível/);
  assert.match(lobby, /Sincronizar agora/);
  assert.match(lobby, /aria-live="polite"/);
});

test("briefing representa seis postos e degrada para composição mobile própria", () => {
  assert.match(lobby, /6 - players\.length/);
  for (let slot = 1; slot <= 6; slot += 1) {
    assert.match(styles, new RegExp(`\\.station\\[data-slot="${slot}"\\]`));
  }
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: 1fr/);
  assert.match(lobby, /max-sm:flex max-sm:flex-col/);
  assert.match(lobby, /briefingStage\} max-sm:order-4/);
  assert.match(lobby, /localConsole\} max-sm:order-3/);
});

test("configuração local mantém agrupamento semântico e controles no DOM", () => {
  assert.match(lobby, /<fieldset[^>]*styles\.colorEditor/);
  assert.match(lobby, /<legend className="wb-label">Cor da facção<\/legend>/);
  assert.match(lobby, /<input[\s\S]*?id="faction-name"/);
  assert.match(lobby, /Pronto para batalha/);
});

test("fallback pertence à Foundation e Lobby não depende de WebGL", () => {
  assert.doesNotMatch(lobby, /Canvas|useThree|@react-three|war-brasil-42\.production\.svg/);
  assert.match(foundationScene, /war-brasil-42\.production\.svg/);
  assert.match(foundationScene, /data-webgl=\{webglState\}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /transition: none/);
});

test("autorização de conflito não cria nova espera antes da navegação", () => {
  assert.match(lobby, /snapshot\.room\.status !== "waiting"/);
  assert.match(lobby, /router\.replace\(`\/game\/\$\{snapshot\.room\.id\}`\)/);
  assert.match(lobby, /CONFLITO AUTORIZADO/);
  const navigationEffect = lobby.slice(
    lobby.indexOf("useEffect(() =>"),
    lobby.indexOf("async function updateMe"),
  );
  assert.doesNotMatch(navigationEffect, /setTimeout|setInterval/);
});

test("identidade visual usa autoridade material e reserva vermelho para conflito", () => {
  assert.match(styles, /--lobby-brass:/);
  assert.match(styles, /--lobby-blood:/);
  assert.match(styles, /data-start-authorized="true"/);
  assert.doesNotMatch(styles, /cyan|#00ffff|#00e5ff/i);
});
