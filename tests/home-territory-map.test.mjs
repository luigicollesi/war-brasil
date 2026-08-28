import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  "src/components/home-territory-map.tsx",
  "utf8",
);
const page = readFileSync("src/app/page.tsx", "utf8");
const svg = readFileSync("public/war-brasil-42.production.svg", "utf8");

test("home reutiliza os nomes canônicos presentes no SVG do mapa", () => {
  assert.match(svg, /class="territory[^\"]*"[^>]*data-name="Amazonas Ocidental"/);
  assert.match(svg, /data-name="Acre"/);
  assert.match(component, /\.territory\[data-name\]/);
  assert.match(component, /territory\?\.dataset\.name/);
  assert.match(page, /<HomeTerritoryMap \/>/);
});

test("desktop exibe o território por hover e mobile mantém o nome por cinco segundos", () => {
  assert.match(component, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(component, /pointermove/);
  assert.match(component, /TOUCH_LABEL_DURATION_MS = 5_000/);
  assert.match(component, /setTimeout\(\(\) =>/);
  assert.match(component, /data-mode=\{label\.mode\}/);
});

test("label temporário contém somente o nome do território", () => {
  assert.match(component, /\{label\.name\}/);
  assert.doesNotMatch(component, /Região:/);
  assert.doesNotMatch(component, /Território:/);
  assert.doesNotMatch(component, /Fechar/);
});
