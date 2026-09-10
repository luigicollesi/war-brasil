import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveInitialTerritoryBoardPresentation,
  nextInitialTerritoryPresentationWakeAt,
} from "../.test-build/client/map/board-presentation.js";

const START = "2026-09-06T12:00:00.000Z";
const START_MS = Date.parse(START);
const MAP_SVG = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");
const HIT_SOURCE = readFileSync(
  "src/lib/client/map/territory-hit-geometry.ts",
  "utf8",
);

function attribute(tag, name) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function hasClass(tag, className) {
  return (attribute(tag, "class") ?? "").split(/\s+/).includes(className);
}

function mapPathTags() {
  return [...MAP_SVG.matchAll(/<path\b[^>]*>/g)].map((match) => match[0]);
}

test("runtime uses each painted top face directly instead of generating hit polygons", () => {
  assert.match(HIT_SOURCE, /export function buildTerritoryHitLayer/);
  assert.match(HIT_SOURCE, /face\.dataset\.territoryHit = "true"/);
  assert.match(HIT_SOURCE, /face\.dataset\.territorySurface = "face"/);
  assert.match(HIT_SOURCE, /face\.style\.pointerEvents = "fill"/);
  assert.match(HIT_SOURCE, /result\.set\(id, \{ face, depths: \[\] \}\)/);

  for (const removedGeometry of [
    "parsePolygonPath",
    "insetPolygonPath",
    "safeInsetPolygonPath",
    "safeScaledPolygonPath",
    "resolveHitPolygonPath",
    "createHitPath",
  ]) {
    assert.doesNotMatch(HIT_SOURCE, new RegExp(removedGeometry));
  }
  assert.doesNotMatch(HIT_SOURCE, /createElementNS\(/);
});

test("decorative 2.5d layers never compete with top faces for pointer targeting", () => {
  assert.match(HIT_SOURCE, /for \(const depth of nodes\.depths\)/);
  assert.match(HIT_SOURCE, /depth\.style\.pointerEvents = "none"/);
  assert.match(
    HIT_SOURCE,
    /\[nodes\.deepRim, nodes\.bevelLight, nodes\.bevelDark\]/,
  );
  assert.match(HIT_SOURCE, /decoration\.style\.pointerEvents = "none"/);
});

test("asset preserves the 42 canonical face ids and four depth layers", () => {
  const faceIds = [
    ...MAP_SVG.matchAll(
      /<path(?=[^>]*data-id="(\d+)")(?=[^>]*data-layer="face")[^>]*>/g,
    ),
  ].map((match) => Number(match[1]));
  const depthEntries = [
    ...MAP_SVG.matchAll(
      /<path(?=[^>]*data-territory-id="(\d+)")(?=[^>]*data-layer="depth-([1-4])")[^>]*>/g,
    ),
  ].map((match) => [Number(match[1]), Number(match[2])]);

  assert.equal(faceIds.length, 42);
  assert.deepEqual(
    [...new Set(faceIds)].sort((a, b) => a - b),
    Array.from({ length: 42 }, (_, index) => index + 1),
  );
  assert.equal(depthEntries.length, 42 * 4);

  for (let territoryId = 1; territoryId <= 42; territoryId += 1) {
    const layers = depthEntries
      .filter(([id]) => id === territoryId)
      .map(([, layer]) => layer)
      .sort((a, b) => a - b);
    assert.deepEqual(layers, [1, 2, 3, 4], `territory ${territoryId}`);
  }

  assert.match(MAP_SVG, /viewBox="0 0 1254 1254"/);
  assert.match(MAP_SVG, /data-top-inset="4\.0"/);
  assert.match(MAP_SVG, /data-body-inset="1\.05"/);
});

test("every canonical top face and depth keeps valid source geometry", () => {
  const tags = mapPathTags();
  const faces = tags.filter((tag) => hasClass(tag, "territory"));
  const depths = tags.filter((tag) => hasClass(tag, "territory-depth"));

  assert.equal(faces.length, 42);
  assert.equal(depths.length, 42 * 4);

  for (const tag of faces) {
    const id = Number(attribute(tag, "data-territory-id"));
    const d = attribute(tag, "d");
    assert.ok(Number.isInteger(id) && id >= 1 && id <= 42);
    assert.ok(d, `territory ${id} face is missing d`);
  }

  for (const tag of depths) {
    const id = Number(attribute(tag, "data-territory-id"));
    const layer = attribute(tag, "data-layer");
    const d = attribute(tag, "d");
    assert.ok(Number.isInteger(id) && id >= 1 && id <= 42);
    assert.ok(d, `territory ${id} ${layer} is missing d`);
  }
});

test("Brasília 40 keeps one real top-face hit target and all visual depth layers", () => {
  const tags = mapPathTags();
  const face = tags.find(
    (tag) =>
      hasClass(tag, "territory") && attribute(tag, "data-territory-id") === "40",
  );
  const depths = tags.filter(
    (tag) =>
      hasClass(tag, "territory-depth") &&
      attribute(tag, "data-territory-id") === "40",
  );

  assert.ok(face, "territory 40 face is missing");
  assert.ok(attribute(face, "d"), "territory 40 face is missing geometry");
  assert.equal(depths.length, 4);
  for (const depth of depths) {
    assert.ok(attribute(depth, "d"), `territory 40 ${attribute(depth, "data-layer")} is missing d`);
  }
});

test("opening presentation is discrete and reveals only territories whose boundary passed", () => {
  const beforeStart = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS - 100,
    highlightPlayerId: "p1",
  });
  assert.equal(beforeStart.mode, "initial-territory-draw");
  assert.equal(beforeStart.titleVisible, true);
  assert.equal(beforeStart.revealedTerritoryIds.size, 0);

  const afterTwoSteps = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 400,
    highlightPlayerId: "p1",
  });
  assert.deepEqual([...afterTwoSteps.revealedTerritoryIds], [7, 3]);
  assert.equal(afterTwoSteps.highlightOn, false);
});

test("opening highlight starts only after the final reveal and advances on 500ms boundaries", () => {
  const firstHighlight = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 600,
    highlightPlayerId: "p1",
  });
  assert.equal(firstHighlight.highlightOn, true);

  const secondHighlightStep = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 1_100,
    highlightPlayerId: "p1",
  });
  assert.equal(secondHighlightStep.highlightOn, false);
});

test("presentation scheduler wakes only on the next semantic boundary", () => {
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS - 1_000,
    }),
    START_MS,
  );
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS + 250,
    }),
    START_MS + 400,
  );
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS + 600,
    }),
    START_MS + 1_100,
  );
});
