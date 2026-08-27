import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTerritoryGeometry,
  distanceSquaredToSegment,
  fitTerritoryMarkerSize,
} from "../.test-build/territory-geometry.js";

function rectangleBoundary(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

test("distância ao segmento considera o ponto projetado entre as amostras", () => {
  assert.equal(
    distanceSquaredToSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ),
    25,
  );
});

test("retângulo regular mantém anchor central e safeRadius correto", () => {
  const geometry = calculateTerritoryGeometry({
    bbox: { x: 0, y: 0, width: 100, height: 80 },
    boundary: rectangleBoundary(100, 80),
    contains: ({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 80,
  });

  assert.equal(geometry.x, 50);
  assert.equal(geometry.y, 40);
  assert.equal(geometry.safeRadius, 40);
  assert.equal(geometry.bboxWidth, 100);
  assert.equal(geometry.bboxHeight, 80);
});

test("forma côncava escolhe um ponto realmente interno", () => {
  const boundary = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 30 },
    { x: 30, y: 30 },
    { x: 30, y: 100 },
    { x: 0, y: 100 },
  ];
  const contains = ({ x, y }) =>
    x >= 0 && y >= 0 && x <= 100 && y <= 100 && (y <= 30 || x <= 30);
  const geometry = calculateTerritoryGeometry({
    bbox: { x: 0, y: 0, width: 100, height: 100 },
    boundary,
    contains,
  });

  assert.equal(contains(geometry), true);
  assert.ok(geometry.safeRadius > 0);
  assert.notDeepEqual(
    { x: geometry.x, y: geometry.y },
    { x: 50, y: 50 },
  );
});

test("território fino produz safeRadius pequeno", () => {
  const geometry = calculateTerritoryGeometry({
    bbox: { x: 0, y: 0, width: 10, height: 100 },
    boundary: rectangleBoundary(10, 100),
    contains: ({ x, y }) => x >= 0 && x <= 10 && y >= 0 && y <= 100,
  });

  assert.equal(geometry.x, 5);
  assert.equal(geometry.y, 50);
  assert.equal(geometry.safeRadius, 5);
});

test("dimensionamento do marcador respeita primeiro o limite geométrico seguro", () => {
  const size = fitTerritoryMarkerSize(
    {
      x: 50,
      y: 50,
      safeRadius: 10,
      bboxWidth: 500,
      bboxHeight: 500,
    },
    {
      preferredScale: 0.5,
      preferredMin: 40,
      maximum: 120,
      safetyFactor: 1,
    },
  );

  assert.ok(size > 14 && size < 14.2);
});

test("território maior permite marcador maior quando há espaço seguro", () => {
  const sizing = {
    preferredScale: 0.25,
    preferredMin: 12,
    maximum: 120,
    safetyFactor: 0.78,
  };
  const small = fitTerritoryMarkerSize(
    { x: 0, y: 0, safeRadius: 20, bboxWidth: 50, bboxHeight: 50 },
    sizing,
  );
  const large = fitTerritoryMarkerSize(
    { x: 0, y: 0, safeRadius: 80, bboxWidth: 200, bboxHeight: 200 },
    sizing,
  );

  assert.ok(large > small);
  assert.ok(large <= sizing.maximum);
});

test("fallback sem área segura nunca força tamanho mínimo para fora do território", () => {
  const size = fitTerritoryMarkerSize(
    { x: 0, y: 0, safeRadius: 0, bboxWidth: 100, bboxHeight: 100 },
    {
      preferredScale: 0.4,
      preferredMin: 24,
      maximum: 100,
    },
  );

  assert.equal(size, 0);
});
