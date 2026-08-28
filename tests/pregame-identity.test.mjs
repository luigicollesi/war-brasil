import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const identity = readFileSync("src/app/war-identity.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");
const matchmaking = readFileSync("src/app/matchmaking/page.tsx", "utf8");
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

test("Home, matchmaking e lobby compartilham WarShell", () => {
  assert.match(shell, /wb-shell/);
  assert.match(home, /<WarShell immersive>/);
  assert.match(matchmaking, /<WarShell/);
  assert.match(lobbyPage, /<WarShell/);
});

test("matchmaking usa composição contínua em vez de cards independentes", () => {
  assert.match(matchmaking, /wb-matchmaking-grid/);
  assert.match(matchmaking, /wb-matchmaking-separator/);
  assert.doesNotMatch(matchmaking, /rounded-3xl|shadow-\[/);
  assert.doesNotMatch(matchmaking, /Nesta versão inicial|etapas futuras|demonstrativos/);
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
