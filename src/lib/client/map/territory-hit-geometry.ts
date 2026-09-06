import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const HIT_LAYER_SELECTOR = '[data-map-hit-layer="true"]';
const GEOMETRY_EPSILON = 1e-7;

export type TerritoryHitNodes = {
  face: SVGPathElement;
  depths: SVGPathElement[];
};

type Point = { x: number; y: number };

type ParsedPolygon = {
  points: Point[];
};

function parsePolygonPath(d: string): ParsedPolygon | null {
  const tokens = d.match(/[MLZmlz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  if (!tokens?.length) return null;

  const points: Point[] = [];
  let command = "";
  let index = 0;
  let current: Point = { x: 0, y: 0 };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[MLZmlz]$/.test(token)) {
      command = token;
      index += 1;
      if (command.toUpperCase() === "Z") continue;
    }

    if (!command || command.toUpperCase() === "Z") return null;
    if (index + 1 >= tokens.length) return null;

    const x = Number(tokens[index]);
    const y = Number(tokens[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    index += 2;

    const next =
      command === command.toLowerCase()
        ? { x: current.x + x, y: current.y + y }
        : { x, y };
    points.push(next);
    current = next;

    if (command.toUpperCase() === "M") {
      command = command === "m" ? "l" : "L";
    }
  }

  return points.length >= 3 ? { points } : null;
}

function signedArea(points: readonly Point[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function normalize(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  return length > GEOMETRY_EPSILON
    ? { x: x / length, y: y / length }
    : { x: 0, y: 0 };
}

function lineIntersection(
  a: Point,
  aDirection: Point,
  b: Point,
  bDirection: Point,
): Point | null {
  const denominator =
    aDirection.x * bDirection.y - aDirection.y * bDirection.x;
  if (Math.abs(denominator) < GEOMETRY_EPSILON) return null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = (dx * bDirection.y - dy * bDirection.x) / denominator;
  return {
    x: a.x + aDirection.x * t,
    y: a.y + aDirection.y * t,
  };
}

function insetPolygon(points: readonly Point[], inset: number): Point[] | null {
  if (inset <= 0) return [...points];
  const orientation = Math.sign(signedArea(points));
  if (orientation === 0) return null;

  const result: Point[] = [];
  const miterLimit = Math.max(inset * 8, 2);

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];

    const incoming = normalize(current.x - previous.x, current.y - previous.y);
    const outgoing = normalize(next.x - current.x, next.y - current.y);
    const incomingNormal =
      orientation > 0
        ? { x: -incoming.y, y: incoming.x }
        : { x: incoming.y, y: -incoming.x };
    const outgoingNormal =
      orientation > 0
        ? { x: -outgoing.y, y: outgoing.x }
        : { x: outgoing.y, y: -outgoing.x };

    const incomingPoint = {
      x: current.x + incomingNormal.x * inset,
      y: current.y + incomingNormal.y * inset,
    };
    const outgoingPoint = {
      x: current.x + outgoingNormal.x * inset,
      y: current.y + outgoingNormal.y * inset,
    };
    const intersection = lineIntersection(
      incomingPoint,
      incoming,
      outgoingPoint,
      outgoing,
    );

    if (
      intersection &&
      Math.hypot(intersection.x - current.x, intersection.y - current.y) <=
        miterLimit
    ) {
      result.push(intersection);
      continue;
    }

    const blendedNormal = normalize(
      incomingNormal.x + outgoingNormal.x,
      incomingNormal.y + outgoingNormal.y,
    );
    result.push({
      x: current.x + blendedNormal.x * inset,
      y: current.y + blendedNormal.y * inset,
    });
  }

  return result.length >= 3 ? result : null;
}

function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, a: Point, b: Point) {
  if (Math.abs(cross(a, b, point)) > 1e-5) return false;
  return (
    point.x >= Math.min(a.x, b.x) - 1e-5 &&
    point.x <= Math.max(a.x, b.x) + 1e-5 &&
    point.y >= Math.min(a.y, b.y) - 1e-5 &&
    point.y <= Math.max(a.y, b.y) + 1e-5
  );
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  if (
    ((abC > GEOMETRY_EPSILON && abD < -GEOMETRY_EPSILON) ||
      (abC < -GEOMETRY_EPSILON && abD > GEOMETRY_EPSILON)) &&
    ((cdA > GEOMETRY_EPSILON && cdB < -GEOMETRY_EPSILON) ||
      (cdA < -GEOMETRY_EPSILON && cdB > GEOMETRY_EPSILON))
  ) {
    return true;
  }

  return (
    (Math.abs(abC) <= GEOMETRY_EPSILON && pointOnSegment(c, a, b)) ||
    (Math.abs(abD) <= GEOMETRY_EPSILON && pointOnSegment(d, a, b)) ||
    (Math.abs(cdA) <= GEOMETRY_EPSILON && pointOnSegment(a, c, d)) ||
    (Math.abs(cdB) <= GEOMETRY_EPSILON && pointOnSegment(b, c, d))
  );
}

function isSimplePolygon(points: readonly Point[]) {
  if (points.length < 3 || Math.abs(signedArea(points)) <= GEOMETRY_EPSILON) {
    return false;
  }

  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0)
      ) {
        continue;
      }

      if (
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function pointInOrOnPolygon(point: Point, polygon: readonly Point[]) {
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])) {
      return true;
    }
  }

  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crossesRay =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function insetIsContained(
  source: readonly Point[],
  candidate: readonly Point[],
) {
  for (let index = 0; index < candidate.length; index += 1) {
    const current = candidate[index];
    const next = candidate[(index + 1) % candidate.length];
    if (!pointInOrOnPolygon(current, source)) return false;
    if (
      !pointInOrOnPolygon(
        { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 },
        source,
      )
    ) {
      return false;
    }
  }
  return true;
}

function formatNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

function polygonPath(points: readonly Point[]) {
  return `${points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
    .join(" ")} Z`;
}

export function insetPolygonPath(d: string, inset: number): string | null {
  const parsed = parsePolygonPath(d);
  if (!parsed) return null;
  const insetPoints = insetPolygon(parsed.points, inset);
  if (!insetPoints) return null;
  return polygonPath(insetPoints);
}

export function safeInsetPolygonPath(d: string, inset: number): string | null {
  const source = parsePolygonPath(d);
  if (!source || !isSimplePolygon(source.points)) return null;

  const insetPoints = insetPolygon(source.points, inset);
  if (!insetPoints || !isSimplePolygon(insetPoints)) return null;
  if (!insetIsContained(source.points, insetPoints)) return null;
  if (Math.abs(signedArea(insetPoints)) >= Math.abs(signedArea(source.points))) {
    return null;
  }

  return polygonPath(insetPoints);
}

function createHitPath({
  document,
  territoryId,
  surface,
  d,
  label,
  keyboard,
  fallback = false,
}: {
  document: Document;
  territoryId: number;
  surface: string;
  d: string;
  label: string;
  keyboard: boolean;
  fallback?: boolean;
}) {
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  path.setAttribute("d", d);
  path.setAttribute("fill", "transparent");
  path.setAttribute("stroke", "none");
  path.setAttribute("pointer-events", "fill");
  path.dataset.territoryHit = "true";
  path.dataset.territoryId = String(territoryId);
  path.dataset.territorySurface = surface;
  if (fallback) path.dataset.hitGeometryFallback = "true";
  path.style.cursor = "pointer";

  if (keyboard) {
    path.setAttribute("tabindex", "0");
    path.setAttribute("role", "button");
    path.setAttribute("aria-label", label);
  } else {
    path.setAttribute("aria-hidden", "true");
    path.setAttribute("tabindex", "-1");
  }

  return path;
}

function warnInvalidHitGeometry(territoryId: number, surface: string) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    `[map-25d] Territory ${territoryId} ${surface} could not produce a safe inset hit polygon.`,
  );
}

export function buildTerritoryHitLayer(
  document: Document,
  boardRoot: Element,
  territories: ReadonlyMap<number, TerritoryVisualNodes>,
): Map<number, TerritoryHitNodes> {
  boardRoot.querySelector(HIT_LAYER_SELECTOR)?.remove();

  const svg = document.documentElement;
  const topInset = Number(svg.getAttribute("data-top-inset"));
  const bodyInset = Number(svg.getAttribute("data-body-inset"));
  const faceInset = Number.isFinite(topInset) ? Math.max(0, topInset) : 4;
  const depthInset = Number.isFinite(bodyInset) ? Math.max(0, bodyInset) : 1.05;

  const layer = document.createElementNS(SVG_NS, "g");
  layer.dataset.mapHitLayer = "true";
  layer.setAttribute("fill-rule", "nonzero");

  const result = new Map<number, TerritoryHitNodes>();
  for (const [id, nodes] of territories) {
    result.set(id, { face: nodes.face, depths: [] });
  }

  for (const depthIndex of [3, 2, 1, 0]) {
    for (const [id, nodes] of territories) {
      const visualDepth = nodes.depths[depthIndex];
      if (!visualDepth) continue;
      const sourceD = visualDepth.getAttribute("d") ?? "";
      const hitD = safeInsetPolygonPath(sourceD, depthInset);
      if (!hitD) {
        warnInvalidHitGeometry(id, `depth-${depthIndex + 1}`);
        continue;
      }
      const hit = createHitPath({
        document,
        territoryId: id,
        surface: `depth-${depthIndex + 1}`,
        d: hitD,
        label: nodes.face.dataset.name ?? `Território ${id}`,
        keyboard: false,
      });
      layer.append(hit);
      result.get(id)?.depths.push(hit);
    }
  }

  for (const [id, nodes] of territories) {
    const sourceD = nodes.face.getAttribute("d") ?? "";
    if (!sourceD) {
      throw new Error(`Territory ${id} face: missing source geometry`);
    }

    const insetD = safeInsetPolygonPath(sourceD, faceInset);
    if (!insetD) warnInvalidHitGeometry(id, "face");
    const hit = createHitPath({
      document,
      territoryId: id,
      surface: "face",
      d: insetD ?? sourceD,
      label: nodes.face.dataset.name ?? `Território ${id}`,
      keyboard: true,
      fallback: !insetD,
    });
    layer.append(hit);
    result.set(id, {
      face: hit,
      depths: result.get(id)?.depths ?? [],
    });
  }

  boardRoot.append(layer);

  for (const nodes of territories.values()) {
    for (const surface of nodes.interactiveSurfaces) {
      surface.style.pointerEvents = "none";
    }
  }

  return result;
}
