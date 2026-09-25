import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const matchmaking = readFileSync("src/app/matchmaking/page.tsx", "utf8");
const lobbyPage = readFileSync("src/app/lobby/[code]/page.tsx", "utf8");
const lobbyClient = readFileSync("src/components/lobby-client.tsx", "utf8");
const workspace = readFileSync("src/components/lobby-command-workspace.tsx", "utf8");
const workspaceStyles = readFileSync("src/components/lobby-command-workspace.module.css", "utf8");
const formation = readFileSync("src/components/lobby-formation-panel.tsx", "utf8");
const formationStyles = readFileSync("src/components/lobby-formation-panel.module.css", "utf8");
const station = readFileSync("src/components/lobby-station-panel.tsx", "utf8");
const stationStyles = readFileSync("src/components/lobby-station-panel.module.css", "utf8");
const ready = readFileSync("src/components/lobby-ready-dock.tsx", "utf8");
const readyStyles = readFileSync("src/components/lobby-ready-dock.module.css", "utf8");
const backButton = readFileSync("src/components/pre-game-back-button.tsx", "utf8");
const lobbyContract = readFileSync("src/lib/shared/lobby.ts", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");

const lobbyLayoutStyles = [workspaceStyles, formationStyles, stationStyles, readyStyles].join("\n");

test("Matchmaking mantém link de retorno e Lobby usa saída explícita antes de navegar", () => {
  assert.match(matchmaking, /<PreGameBackButton href="\/home" label="Voltar ao Comando" \/>/);
  assert.match(workspace, /label=\{leaving \? "Saindo da operação…" : "Voltar para Operações"\}/);
  assert.match(workspace, /onClick=\{onBackToOperations\}/);
  assert.doesNotMatch(workspace, /SAIR DA SALA|onLeaveRoom/);
  assert.match(lobbyClient, /method: "DELETE"/);
  assert.match(lobbyClient, /router\.replace\("\/matchmaking"\)/);
  assert.match(backButton, /<Link href=\{href\}/);
  assert.match(backButton, /<button[\s\S]*?onClick=\{onClick\}/);
  assert.doesNotMatch(backButton, /router\.back|history\.back/);
});

test("Lobby usa 100dvh como orçamento e impede crescimento da página", () => {
  assert.match(lobbyPage, /height: "100dvh"/);
  assert.match(lobbyPage, /minHeight: 0/);
  assert.match(lobbyPage, /overflow: "hidden"/);
  assert.match(workspaceStyles, /height:\s*100%/);
  assert.match(workspaceStyles, /overflow:\s*hidden/);
  assert.match(workspaceStyles, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(workspaceStyles, /@media \(max-width: 720px\)/);
  assert.match(workspaceStyles, /@media \(max-height: 680px\)/);
  assert.match(workspaceStyles, /@media \(max-width: 720px\) and \(max-height: 580px\)/);
  assert.doesNotMatch(lobbyLayoutStyles, /overflow-y:\s*(?:auto|scroll)/);
});

test("Formação desktop é uma mesa de guerra Brasil com seis postos estáveis", () => {
  assert.match(workspace, /data-lobby-layout="war-table"/);
  assert.match(formation, /data-tactical-nexus="brasil"/);
  assert.match(formation, /\/war-brasil-42\.production\.svg/);
  assert.match(formation, /6 - players\.length/);
  assert.match(formation, /\{players\.length\}\/6 postos ocupados/);
  assert.match(formationStyles, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(180px, \.82fr\) minmax\(0, 1fr\)/);
  assert.match(formationStyles, /grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(formationStyles, /\.stationField > :nth-child\(1\)/);
  assert.match(formationStyles, /\.stationField > :nth-child\(6\)/);
  assert.match(formationStyles, /min-height:\s*0/);
  assert.match(formationStyles, /overflow:\s*hidden/);
});

test("Mobile remove o nexus literal e recompõe seis postos em 2x3", () => {
  assert.match(formationStyles, /@media \(max-width: 720px\)[\s\S]*?\.tacticalNexus[\s\S]*?display:\s*none/);
  assert.match(formationStyles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(formationStyles, /grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(workspace, /type MobileLobbyPanel = "formation" \| "station"/);
  assert.match(workspace, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, />\s*Formação\s*/);
  assert.match(workspace, />\s*Sua estação\s*/);
});

test("Credencial local usa identidade do perfil e mantém apenas cor como customização", () => {
  assert.match(station, /className=\{styles\.commandCredential\}/);
  assert.match(station, /Nome de exibição/);
  assert.match(station, /me\.displayName/);
  assert.match(station, /me\.handle/);
  assert.doesNotMatch(station, /id="faction-name"|name="factionName"/);
  assert.match(station, /className=\{styles\.colorEditor\}/);
  assert.match(stationStyles, /@media \(max-width: 720px\) and \(max-height: 580px\)/);
  assert.match(stationStyles, /\.commandCredential,[\s\S]*?display:\s*none/);
  assert.match(stationStyles, /\.identityControls[\s\S]*?gap:/);
});

test("Ready é trilho de autorização no fluxo e continua derivado de players", () => {
  assert.match(ready, /Array\.from\(\{ length: 6 \}/);
  assert.match(ready, /player\.isReady \? "ready" : "configuring"/);
  assert.match(ready, /className=\{styles\.authorizationRail\}/);
  assert.match(ready, /aria-pressed=\{me\.isReady\}/);
  assert.doesNotMatch(readyStyles, /position:\s*fixed/);
  assert.match(readyStyles, /grid-template-columns:\s*repeat\(6, minmax\(26px, 1fr\)\)/);
  assert.match(readyStyles, /@media \(max-height: 580px\)/);
});

test("Motion decorativo respeita prefers-reduced-motion", () => {
  assert.match(formationStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(formationStyles, /\.nexusOrbit,[\s\S]*?animation:\s*none/);
  assert.match(stationStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(readyStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("LobbyClient continua controlador único dos contratos funcionais", () => {
  assert.match(lobbyClient, /useLobbySync\(code\)/);
  assert.match(lobbyClient, /fetch\(`\/api\/rooms\/\$\{encodeURIComponent\(code\)\}\/me`/);
  assert.match(lobbyClient, /fetch\(`\/api\/rooms\/\$\{encodeURIComponent\(code\)\}\/bots`/);
  assert.match(lobbyClient, /method: "DELETE"/);
  assert.match(lobbyClient, /fetch\("\/api\/participation"/);
  assert.match(lobbyClient, /router\.replace\([\s\S]*?snapshot\.room\.code/);
  assert.doesNotMatch(workspace, /fetch\(|useLobbySync|router\.replace/);
  assert.doesNotMatch(formation, /fetch\(|useLobbySync/);
  assert.doesNotMatch(station, /fetch\(|useLobbySync/);
  assert.doesNotMatch(ready, /fetch\(|useLobbySync/);
});

test("cards humanos da formação abrem o perfil público em nova aba", () => {
  assert.match(formation, /href=\{\`\/profile\/\$\{encodeURIComponent\(player\.handle\)\}\`\}/);
  assert.match(formation, /target="_blank"/);
  assert.match(formation, /rel="noopener noreferrer"/);
  assert.match(formation, /player\.displayName/);
  assert.match(formationStyles, /\.stationProfileLink/);
});


test("Lobby carrega título equipado no snapshot sem fetch por jogador", () => {
  assert.match(lobbyContract, /equippedTitle: PublicCommanderTitleAppearance \| null/);
  assert.match(rooms, /LEFT JOIN profile\.commanders commander/);
  assert.match(rooms, /LEFT JOIN catalog\.commander_titles title/);
  assert.match(rooms, /title\.id AS title_id/);
  assert.match(rooms, /title\.style_key AS title_style_key/);
  assert.match(rooms, /title\.is_active = TRUE/);
  assert.match(rooms, /equippedTitle/);
  assert.match(rooms, /profileAppearanceAssetDeliveryPath\(player\.title_texture_ref\)/);
  assert.doesNotMatch(formation, /fetch\(/);
  assert.doesNotMatch(station, /fetch\(/);
});

test("Formação e credencial reutilizam o renderer canônico de títulos", () => {
  assert.match(formation, /ProfileTitleRenderer/);
  assert.match(formation, /title=\{player\.equippedTitle\}/);
  assert.match(formationStyles, /--profile-title-size-legendary:\s*\.62rem/);
  assert.match(formationStyles, /\.stationTitleViewport/);
  assert.match(station, /ProfileTitleRenderer/);
  assert.match(station, /title=\{me\.equippedTitle\}/);
  assert.match(stationStyles, /--profile-title-size-legendary:\s*\.82rem/);
  assert.match(station, /className=\{styles\.credentialName\}/);
});
