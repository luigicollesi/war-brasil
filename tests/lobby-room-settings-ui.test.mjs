import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync("src/components/lobby-room-settings.tsx", "utf8");
const settingsStyles = readFileSync(
  "src/components/lobby-room-settings.module.css",
  "utf8",
);
const client = readFileSync("src/components/lobby-client.tsx", "utf8");
const workspace = readFileSync("src/components/lobby-command-workspace.tsx", "utf8");

test("configurações ficam compactas e editáveis somente para o host", () => {
  assert.match(settings, /Configurações da sala/);
  assert.match(settings, /canManageRoom/);
  assert.match(settings, /aria-expanded/);
  assert.match(settings, /role="dialog"/);
  assert.match(settings, /Clássico/);
  assert.match(settings, /Supremacia/);
  assert.match(settings, /ruleset === "objective"/);
});

test("sorte balanceada usa semântica de switch e texto ON OFF", () => {
  assert.match(settings, /role="switch"/);
  assert.match(settings, /aria-checked=\{balancedDiceEnabled\}/);
  assert.match(settings, /balancedDiceEnabled \? "ON" : "OFF"/);
});

test("lobby muta settings por endpoint dedicado e converge via refresh", () => {
  assert.match(client, /\/settings/);
  assert.match(client, /method: "PATCH"/);
  assert.match(client, /await refresh\(\)/);
  assert.match(client, /canManageRoom/);
  assert.match(workspace, /LobbyRoomSettings/);
});


test("modal de configurações escapa do overflow do command bar por portal", () => {
  assert.match(settings, /createPortal/);
  assert.match(settings, /document\.body/);
  assert.match(settings, /panelRef/);
  assert.match(settingsStyles, /\.portalLayer\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(settingsStyles, /z-index:\s*1000/);
  assert.match(settingsStyles, /\.panel\s*\{[\s\S]*?pointer-events:\s*auto/);
});
