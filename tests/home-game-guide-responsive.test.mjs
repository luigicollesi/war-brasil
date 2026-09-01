import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("polimento responsivo do manual é carregado por último", () => {
  const layout = source("src/app/layout.tsx");
  const finalSections = layout.indexOf('import "./war-guide-final-sections.css"');
  const responsive = layout.indexOf('import "./war-guide-responsive.css"');

  assert.ok(finalSections >= 0);
  assert.ok(responsive > finalSections);
});

test("manual possui adaptações explícitas para desktop estreito, tablet e celular", () => {
  const styles = source("src/app/war-guide-responsive.css");

  assert.match(styles, /@media \(max-width: 1120px\)/);
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(max-width: 420px\)/);

  assert.match(styles, /\.wb-guide-map-legend\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.wb-guide-map-legend\s*\{[\s\S]*grid-template-columns: 1fr/);
});

test("tabela regional e exemplos críticos não exigem largura fixa no celular", () => {
  const styles = source("src/app/war-guide-responsive.css");

  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.wb-guide-region-table\.wb-guide-region-table--rules\s*\{[\s\S]*min-width: 0/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.wb-guide-region-table-wrap\s*\{[\s\S]*overflow-x: visible/);
  assert.match(styles, /\.wb-guide-connection-track\s*\{[\s\S]*minmax\(74px, auto\)/);
  assert.match(styles, /\.wb-guide-dice-comparison \.game-die\s*\{[\s\S]*width: 46px/);
});

test("layout estreito devolve espaço às notas e mantém ações utilizáveis", () => {
  const styles = source("src/app/war-guide-responsive.css");

  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.wb-guide-notes,[\s\S]*margin-left: 0/);
  assert.match(styles, /\.wb-guide-victory \.wb-button\s*\{[\s\S]*width: 100%/);
  assert.match(styles, /\.wb-guide-heading h2\s*\{[\s\S]*font-size: 2rem/);
  assert.match(styles, /\.wb-guide-territory strong\s*\{[\s\S]*white-space: normal/);
});

test("manual preserva foco visível e reduz movimento quando solicitado", () => {
  const styles = source("src/app/war-guide-responsive.css");

  assert.match(styles, /\.wb-guide a:focus-visible/);
  assert.match(styles, /outline: 2px solid var\(--wb-gold-bright\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation-duration: \.01ms !important/);
  assert.match(styles, /transition-duration: \.01ms !important/);
});
