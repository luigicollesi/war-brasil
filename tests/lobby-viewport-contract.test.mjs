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
const stationStyles = readFileSync("src/components/lobby-station-panel.module.css", "utf8");
const readyStyles = readFileSync("src/components/lobby-ready-dock.module.css", "utf8");
const backButton = readFileSync("src/components/pre-game-back-button.tsx", "utf8");

test("Matchmaking e Lobby usam retorno explícito sem depender do histórico", () => {
  assert.match(matchmaking, /<PreGameBackButton href="\/" \/>/);
  assert.match(workspace, /<PreGameBackButton href="\/matchmaking" \/>/);
  assert.match(lobbyClient, /<PreGameBackButton href="\/matchmaking" \/>/);
  assert.match(backButton, /<Link href=\{href\}/);
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
});

test("Formação mantém seis postos dentro de uma grade de altura estável", () => {
  assert.match(formation, /6 - players\.length/);
  assert.match(formation, /\{players\.length\}\/6 postos ocupados/);
  assert.match(formationStyles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(formationStyles, /grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(formationStyles, /min-height:\s*0/);
  assert.match(formationStyles, /overflow:\s*hidden/);
});

test("Mobile alterna apenas apresentação e mantém ready no fluxo", () => {
  assert.match(workspace, /type MobileLobbyPanel = "formation" \| "station"/);
  assert.match(workspace, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, />\s*Formação\s*/);
  assert.match(workspace, />\s*Sua estação\s*/);
  assert.match(stationStyles, /min-height:\s*0/);
  assert.doesNotMatch(readyStyles, /position:\s*fixed/);
});

test("LobbyClient continua controlador único dos contratos funcionais", () => {
  assert.match(lobbyClient, /useLobbySync\(code\)/);
  assert.match(lobbyClient, /fetch\(`\/api\/rooms\/\$\{encodeURIComponent\(code\)\}\/me`/);
  assert.match(lobbyClient, /fetch\(`\/api\/rooms\/\$\{encodeURIComponent\(code\)\}\/bots`/);
  assert.match(lobbyClient, /method: "DELETE"/);
  assert.match(lobbyClient, /router\.replace\(`\/game\/\$\{snapshot\.room\.id\}`\)/);
  assert.doesNotMatch(workspace, /fetch\(|useLobbySync|router\.replace/);
});
