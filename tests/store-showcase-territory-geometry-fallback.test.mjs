import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const SHOWCASE_PATH = "src/components/profile/v4/store-showcase/store-showcase.tsx";
const ERROR_BOUNDARY_PATH =
  "src/components/profile/v4/store-showcase/showcase-model-error-boundary.tsx";
const E2E_PATH = "scripts/e2e/store-showcase-e2e.mjs";

const read = (path) => readFileSync(path, "utf8");

test("SHOWCASE-36 isolates territory geometry failure and swaps only the model to canonical 2D fallback", () => {
  assert.equal(
    existsSync(ERROR_BOUNDARY_PATH),
    true,
    "showcase needs a model-level error boundary instead of crashing the shared Canvas",
  );

  const boundary = read(ERROR_BOUNDARY_PATH);
  const showcase = read(SHOWCASE_PATH);

  assert.match(boundary, /componentDidCatch|getDerivedStateFromError/);
  assert.match(boundary, /onError/);
  assert.match(showcase, /ShowcaseModelErrorBoundary/);
  assert.match(showcase, /failedTerritoryItemId/);
  assert.match(showcase, /TerritoryShowcaseFallback/);
  assert.match(showcase, /selectedItem\.id\s*===\s*failedTerritoryItemId/);
  assert.match(showcase, /data-showcase-geometry-fallback/);
});

test("SHOWCASE-36 browser eval forces SVG geometry extraction failure while leaving canonical SVG fallback available", () => {
  const e2e = read(E2E_PATH);

  assert.match(e2e, /geometryFailureContext/);
  assert.match(e2e, /DOMParser\.prototype\.parseFromString/);
  assert.match(e2e, /territory-18/);
  assert.match(e2e, /data-showcase-geometry-fallback/);
  assert.match(e2e, /Prévia 2D do território canônico/);
  assert.match(e2e, /geometryFallbackCommerce/);
});
