import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const workspace = readFileSync("src/components/lobby-command-workspace.tsx", "utf8");
const workspaceStyles = readFileSync("src/components/lobby-command-workspace.module.css", "utf8");
const formation = readFileSync("src/components/lobby-formation-panel.tsx", "utf8");
const formationStyles = readFileSync("src/components/lobby-formation-panel.module.css", "utf8");
const station = readFileSync("src/components/lobby-station-panel.tsx", "utf8");
const stationStyles = readFileSync("src/components/lobby-station-panel.module.css", "utf8");
const ready = readFileSync("src/components/lobby-ready-dock.tsx", "utf8");
const readyStyles = readFileSync("src/components/lobby-ready-dock.module.css", "utf8");
const sync = readFileSync("src/hooks/use-lobby-sync.ts", "utf8");
const syncCoordinator = readFileSync("src/lib/client/lobby-sync-coordinator.ts", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const foundationScene = readFileSync(
  "src/components/pre-game/foundation/command-scene.tsx",
  "utf8",
);
const foundationRuntime = readFileSync(
  "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  "utf8",
);

const visualComponents = [workspace, formation, station, ready].join("\n");
const visualStyles = [workspaceStyles, formationStyles, stationStyles, readyStyles].join("\n");

test("lobby usa snapshot vigente como fonte de verdade e assentos estáveis", () => {
  assert.match(lobby, /const \{ snapshot, error: syncError, isLoading, refresh \} = useLobbySync\(code\)/);
  assert.match(formation, /players\.map\(\(player, index\) =>/);
  assert.match(formation, /slot=\{index \+ 1\}/);
  assert.match(rooms, /ORDER BY joined_at ASC, id ASC/);
  assert.doesNotMatch(lobby, /setPlayers|setReadyPlayers|setStations|useReducer/);
  assert.doesNotMatch(visualComponents, /setPlayers|setReadyPlayers|setStations|useReducer/);
});

test("entrada, saída e ready usam realtime com watchdog HTTP sem reload manual", () => {
  assert.match(sync, /FALLBACK_POLLING_INTERVAL_MS = 2_000/);
  assert.match(sync, /REALTIME_WATCHDOG_INTERVAL_MS = 30_000/);
  assert.match(sync, /createGameRealtimeTransport/);
  assert.match(sync, /gameRealtimeMode/);
  assert.match(sync, /event\.type !== "game\.invalidate"/);
  assert.match(sync, /coordinator\.refreshAfterCurrent\(\)/);
  assert.match(sync, /refreshRef\.current = coordinator\.refreshAfterCurrent/);
  assert.match(syncCoordinator, /if \(inFlight\) return inFlight/);
  assert.match(syncCoordinator, /await current/);
  assert.match(syncCoordinator, /return sync\(\)/);
  assert.match(sync, /setSnapshot\(nextSnapshot\)/);
  assert.match(lobby, /await refresh\(\)/);
  assert.doesNotMatch(lobby, /location\.reload|window\.location\.reload/);
});

test("ready permanece confirmado pelo servidor e perceptível sem depender de cor", () => {
  assert.match(lobby, /await refresh\(\)/);
  assert.match(ready, /aria-pressed=\{me\.isReady\}/);
  assert.match(formation, /player\.isReady \? "✓ Pronto" : "• Configurando"/);
  assert.match(formation, /data-ready=\{player\.isReady \? "true" : "false"\}/);
  assert.match(ready, /player\.isReady \? "ready" : "configuring"/);
});

test("ready pendente não antecipa estado e falha aparece junto da ação", () => {
  assert.match(lobby, /scope: "profile" \| "ready" \| "settings" \| "bot" \| "copy"/);
  assert.match(lobby, /scope: action/);
  assert.match(lobby, /const readyPending = pendingAction === "ready"/);
  assert.match(lobby, /const readyError = actionError\?\.scope === "ready"/);
  assert.match(ready, /aria-busy=\{readyPending\}/);
  assert.match(ready, /aguardando servidor/);
  assert.doesNotMatch(lobby, /set.*Ready/);
});

test("ação crítica de ready permanece dentro do workspace e sem sobreposição fixed", () => {
  assert.match(workspace, /<LobbyReadyDock/);
  assert.match(ready, /aria-label="Preparação da partida"/);
  assert.doesNotMatch(readyStyles, /position:\s*fixed/);
  assert.match(workspaceStyles, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(visualComponents, /useThree|Camera|camera\./);
});

test("Lobby publica diretiva sem criar segundo CommandShell ou renderer", () => {
  assert.match(lobby, /useCommandSceneDirective/);
  assert.match(lobby, /focus: "table"/);
  assert.match(lobby, /conflictLevel: sceneStartAuthorized \? 3 : sceneAllReady \? 1 : 0/);
  assert.match(lobby, /orbitalAlignment: sceneStartAuthorized \? 1 : 0/);
  assert.equal((foundationRuntime.match(/<CommandShell\b/g) ?? []).length, 1);
  assert.match(foundationRuntime, /<CommandShell[\s\S]*?intent=\{intent\}[\s\S]*?>/);
  assert.doesNotMatch(visualComponents, /<CommandShell|@react-three|from "three"|CommandSceneCanvas|useThree/);
});

test("código da operação permanece copiável, selecionável e com recuperação local", () => {
  assert.match(lobby, /navigator\.clipboard\.writeText\(code\.toUpperCase\(\)\)/);
  assert.match(workspace, /aria-label=\{`Copiar código da sala \$\{roomCode\}`\}/);
  assert.match(lobby, /scope: "copy"/);
  assert.match(lobby, /Cópia automática indisponível/);
  assert.match(workspace, /Compartilhe o código para convocar outros comandos/);
  assert.match(workspaceStyles, /user-select:\s*all/);
});

test("reconexão mantém última formação, anuncia estado e oferece retry", () => {
  assert.match(sync, /setSnapshot\(nextSnapshot\)/);
  assert.match(workspace, /Reconectando/);
  assert.match(workspace, /Mantendo a última formação confirmada/);
  assert.match(workspace, /Sincronizar agora/);
  assert.match(workspace, /aria-live="polite"/);
});

test("sala de guerra representa seis postos e degrada para matriz mobile", () => {
  assert.match(formation, /6 - players\.length/);
  assert.match(formation, /data-tactical-nexus="brasil"/);
  assert.match(formation, /war-brasil-42\.production\.svg/);
  assert.match(formationStyles, /\.stationField > :nth-child\(1\)/);
  assert.match(formationStyles, /\.stationField > :nth-child\(6\)/);
  assert.match(formationStyles, /@media \(max-width: 720px\)/);
  assert.match(formationStyles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(formationStyles, /grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test("configuração local mantém agrupamento semântico e controles no DOM", () => {
  assert.match(station, /<fieldset className=\{styles\.colorEditor\}>/);
  assert.match(station, /<legend className="wb-label">Cor da facção<\/legend>/);
  assert.match(station, /id="faction-name"/);
  assert.match(station, /className=\{styles\.commandCredential\}/);
  assert.match(ready, /Pronto para batalha/);
});

test("holograma Brasil é decorativo e fallback funcional continua na Foundation", () => {
  assert.match(formation, /src="\/war-brasil-42\.production\.svg"/);
  assert.match(formation, /alt=""/);
  assert.match(foundationScene, /war-brasil-42\.production\.svg/);
  assert.match(foundationScene, /data-webgl=\{webglState\}/);
  assert.doesNotMatch(visualComponents, /Canvas|useThree|@react-three/);
  assert.match(formationStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(stationStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(readyStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("autorização de conflito não cria nova espera antes da navegação", () => {
  assert.match(lobby, /snapshot\.room\.status !== "waiting"/);
  assert.match(lobby, /router\.replace\(`\/game\/\$\{snapshot\.room\.code\}`\)/);
  assert.match(lobby, /CONFLITO AUTORIZADO/);
  const navigationStart = lobby.indexOf("useEffect(() =>");
  const heartbeatStart = lobby.indexOf("useEffect(() =>", navigationStart + 1);
  const navigationEffect = lobby.slice(navigationStart, heartbeatStart);
  assert.doesNotMatch(navigationEffect, /setTimeout|setInterval/);
});

test("identidade visual mantém verde militar, latão e vermelho reservado ao conflito", () => {
  assert.match(visualStyles, /var\(--wb-gold\)|rgb\(214 169 62/);
  assert.match(workspace, /data-start-authorized=\{startAuthorized \? "true" : "false"\}/);
  assert.match(formationStyles, /data-start-authorized="true"/);
  assert.match(readyStyles, /data-start-authorized="true"/);
  assert.doesNotMatch(visualStyles, /cyan|#00ffff|#00e5ff/i);
});


test("lobby mantém heartbeat do assento e saída explícita sem unload destrutivo", () => {
  assert.match(lobby, /\/api\/rooms\/\$\{encodeURIComponent\(code\)\}\/heartbeat/);
  assert.match(lobby, /30_000/);
  assert.match(lobby, /method: "DELETE"/);
  assert.match(lobby, /router\.replace\("\/matchmaking"\)/);
  assert.match(workspace, /SAIR DA SALA/);
  assert.doesNotMatch(lobby, /beforeunload|pagehide/);
});

test("partida navega publicamente pelo código da sala", () => {
  assert.match(lobby, /snapshot\.room\.code/);
  assert.doesNotMatch(lobby, /\/game\/\$\{snapshot\.room\.id\}/);
});
