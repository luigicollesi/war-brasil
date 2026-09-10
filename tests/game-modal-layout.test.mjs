import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/game-modal.tsx", "utf8");
const anomaly = readFileSync("src/components/temporal-anomaly-modal.tsx", "utf8");
const layout = readFileSync("src/app/game/[roomId]/game-modal-layout.css", "utf8");
const page = readFileSync("src/app/game/[roomId]/page.tsx", "utf8");

test("modais comuns usam content-fit no desktop", () => {
  assert.match(modal, /scrollMode = "content"/);
  assert.match(modal, /data-game-modal-scroll=\{scrollMode\}/);
  assert.match(layout, /data-game-modal-scroll="content"/);
  assert.match(layout, /max-height:\s*none\s*!important/);
  assert.match(layout, /overflow:\s*clip\s*!important/);
});

test("scroll aparece somente como fallback de viewport desktop baixa", () => {
  assert.match(layout, /@media \(min-width: 768px\) and \(max-height: 680px\)/);
  assert.match(layout, /max-height:\s*calc\(100dvh - 32px\)\s*!important/);
  assert.match(layout, /overflow-y:\s*auto\s*!important/);
});

test("grades de cartas não criam viewport interno no desktop", () => {
  assert.match(layout, /\.game-card-modal[\s\S]*?> \.overflow-y-auto/);
  assert.match(layout, /\.game-card-modal[\s\S]*?max-height:\s*none\s*!important/);
  assert.match(layout, /\.game-card-modal[\s\S]*?overflow:\s*visible\s*!important/);
});

test("anomalia preserva sua política de viewport rolável", () => {
  assert.match(anomaly, /scrollMode="viewport"/);
  assert.match(anomaly, /temporal-anomaly-modal/);
});

test("política canônica de modal é carregada por último", () => {
  const modalLayout = page.indexOf('import "./game-modal-layout.css"');
  const previousModalCss = page.indexOf('import "./game-battle-dice-polish.css"');
  const mapPolish = page.indexOf('import "./map-25d-polish.css"');
  assert.ok(modalLayout > previousModalCss);
  assert.ok(modalLayout > mapPolish);
});
