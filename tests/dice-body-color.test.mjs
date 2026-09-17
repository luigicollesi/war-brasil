import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DICE_BODY_COLOR,
  deriveDiceBodyHighlight,
  resolveDiceBodyColors,
} from "../.test-build/client/dice/body-color.js";

test("deriva highlight mais claro preservando o tom bronze", () => {
  assert.equal(deriveDiceBodyHighlight("#663718"), "#99562A");
});

test("highlight explícito prevalece sobre a derivação automática", () => {
  assert.deepEqual(resolveDiceBodyColors("#663718", "#875028"), {
    bodyColor: "#663718",
    bodyHighlightColor: "#875028",
  });
});

test("cores são normalizadas para hexadecimal RGB em caixa alta", () => {
  assert.deepEqual(resolveDiceBodyColors("#663718", "#9a5a2d"), {
    bodyColor: "#663718",
    bodyHighlightColor: "#9A5A2D",
  });
});

test("entrada ausente ou inválida preserva o fallback dourado legado", () => {
  const expectedHighlight = deriveDiceBodyHighlight(DEFAULT_DICE_BODY_COLOR);
  assert.deepEqual(resolveDiceBodyColors(null, null), {
    bodyColor: DEFAULT_DICE_BODY_COLOR,
    bodyHighlightColor: expectedHighlight,
  });
  assert.deepEqual(resolveDiceBodyColors("bronze", "claro"), {
    bodyColor: DEFAULT_DICE_BODY_COLOR,
    bodyHighlightColor: expectedHighlight,
  });
});
