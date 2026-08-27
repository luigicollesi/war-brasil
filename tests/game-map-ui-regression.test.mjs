import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("toggle de estradas permanece visível e tocável em tablet e celular", () => {
  const css = readFileSync(
    "src/app/game/[roomId]/game-roads.css",
    "utf8",
  );

  assert.match(css, /@media \(max-width: 1199px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.doesNotMatch(
    css,
    /\.game-road-toggle[^}]*display:\s*none/s,
  );
});

test("âncora territorial procura um ponto interno em vez de confiar só no bounding box", () => {
  const arrow = readFileSync(
    "src/components/territory-arrow.tsx",
    "utf8",
  );
  const svgAdapter = readFileSync(
    "src/lib/territory-svg-geometry.ts",
    "utf8",
  );
  const geometry = readFileSync(
    "src/lib/territory-geometry.ts",
    "utf8",
  );

  // O componente não deve voltar a carregar a implementação geométrica: ele
  // apenas delega para o adapter responsável por ler o SVG.
  assert.match(arrow, /territoryGeometryFromPath/);
  assert.match(arrow, /return territoryGeometryFromPath\(pathElement\)/);

  // A borda e o teste de interior continuam sendo derivados da geometria real
  // do SVG, agora isolados do componente React.
  assert.match(svgAdapter, /getBBox\(\)/);
  assert.match(svgAdapter, /getTotalLength\(\)/);
  assert.match(svgAdapter, /getPointAtLength\(/);
  assert.match(svgAdapter, /isPointInFill/);
  assert.match(svgAdapter, /calculateTerritoryGeometry/);

  // O núcleo puro procura candidatos internos em duas resoluções e mede a
  // distância até segmentos da borda, em vez de confiar apenas no bbox center.
  assert.match(geometry, /if \(!contains\(point\)\) return/);
  assert.match(geometry, /sampleGrid\(17\)/);
  assert.match(geometry, /sampleGrid\(33\)/);
  assert.match(geometry, /distanceSquaredToSegment/);
  assert.match(geometry, /safeRadius:/);
});
