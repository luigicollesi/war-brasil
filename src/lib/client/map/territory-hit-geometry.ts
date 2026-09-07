import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const HIT_LAYER_SELECTOR = '[data-map-hit-layer="true"]';
const GEOMETRY_EPSILON = 1e-7;

export type TerritoryHitNodes = {
  face: SVGPathElement;
  depths: SVGPathElement[];
};

export type HitPolygonStrategy = "offset" | "scaled";

export type HitPolygonResult = {
  d: string;
  strategy: HitPolygonStrategy;
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

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const crossesRay =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function pointInOrOnPolygon(point: Point, polygon: readonly Point[]) {
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])) {
      return true;
    }
  }
  return pointInPolygon(point, polygon);
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

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= GEOMETRY_EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
}

function clearanceFromEdges(point: Point, polygon: readonly Point[]) {
  let clearance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    clearance = Math.min(
      clearance,
      distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]),
    );
  }
  return clearance;
}

function polygonBounds(points: readonly Point[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function polygonCentroid(points: readonly Point[]): Point | null {
  let x = 0;
  let y = 0;
  let areaFactor = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    areaFactor += factor;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }

  if (Math.abs(areaFactor) <= GEOMETRY_EPSILON) return null;
  return {
    x: x / (3 * areaFactor),
    y: y / (3 * areaFactor),
  };
}

function bestInteriorAnchor(points: readonly Point[]): Point | null {
  const bounds = polygonBounds(points);
  const candidates: Point[] = [];
  const centroid = polygonCentroid(points);
  if (centroid) candidates.push(centroid);
  candidates.push({
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  });
  candidates.push({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  });

  const gridSteps = 9;
  for (let row = 1; row < gridSteps; row += 1) {
    for (let column = 1; column < gridSteps; column += 1) {
      candidates.push({
        x: bounds.minX + ((bounds.maxX - bounds.minX) * column) / gridSteps,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * row) / gridSteps,
      });
    }
  }

  let best: Point | null = null;
  let bestClearance = 0;
  for (const candidate of candidates) {
    if (!pointInPolygon(candidate, points)) continue;
    const clearance = clearanceFromEdges(candidate, points);
    if (clearance > bestClearance) {
      best = candidate;
      bestClearance = clearance;
    }
  }
  return best;
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

export function safeScaledPolygonPath(d: string, inset: number): string | null {
  const source = parsePolygonPath(d);
  if (!source || !isSimplePolygon(source.points)) return null;
  const anchor = bestInteriorAnchor(source.points);
  if (!anchor) return null;

  const bounds = polygonBounds(source.points);
  const minimumDimension = Math.min(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
  );
  if (minimumDimension <= GEOMETRY_EPSILON) return null;

  let factor = Math.max(0.25, Math.min(0.98, 1 - (2 * inset) / minimumDimension));
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = source.points.map((point) => ({
      x: anchor.x + (point.x - anchor.x) * factor,
      y: anchor.y + (point.y - anchor.y) * factor,
    }));

    if (
      isSimplePolygon(candidate) &&
      insetIsContained(source.points, candidate) &&
      Math.abs(signedArea(candidate)) < Math.abs(signedArea(source.points))
    ) {
      return polygonPath(candidate);
    }
    factor *= 0.82;
  }

  return null;
}

export function resolveHitPolygonPath(d: string, inset: number): HitPolygonResult | null {
  const offset = safeInsetPolygonPath(d, inset);
  if (offset) return { d: offset, strategy: "offset" };

  const scaled = safeScaledPolygonPath(d, inset);
  return scaled ? { d: scaled, strategy: "scaled" } : null;
}

function createHitPath({
  document,
  territoryId,
  surface,
  hit,
  label,
  keyboard,
}: {
  document: Document;
  territoryId: number;
  surface: string;
  hit: HitPolygonResult;
  label: string;
  keyboard: boolean;
}) {
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  path.setAttribute("d", hit.d);
  path.setAttribute("fill", "transparent");
  path.setAttribute("stroke", "none");
  path.setAttribute("pointer-events", "fill");
  path.dataset.territoryHit = "true";
  path.dataset.territoryId = String(territoryId);
  path.dataset.territorySurface = surface;
  path.dataset.hitGeometryStrategy = hit.strategy;
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
    `[map-25d] Territory ${territoryId} ${surface} could not produce a conservative hit polygon.`,
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
  layer.dataset.mapHitOrder = "visual-paint-order";
  layer.setAttribute("fill-rule", "nonzero");

  const faceHits = new Map<number, SVGPathElement>();
  const depthHits = new Map<number, SVGPathElement[]>();
  for (const id of territories.keys()) depthHits.set(id, []);

  const visualSurfaces = Array.from(
    boardRoot.querySelectorAll<SVGPathElement>(
      "path.territory-depth[data-territory-id], path.territory[data-territory-id]",
    ),
  );

  for (const visualSurface of visualSurfaces) {
    const id = Number(visualSurface.dataset.territoryId);
    if (!Number.isInteger(id) || id <= 0) continue;

    const nodes = territories.get(id);
    if (!nodes) continue;

    const isFace = visualSurface === nodes.face;
    const isDepth = nodes.depths.includes(visualSurface);
    if (!isFace && !isDepth) continue;

    const surface = isFace
      ? "face"
      : visualSurface.dataset.layer ?? "depth";
    const sourceD = visualSurface.getAttribute("d") ?? "";
    if (!sourceD) {
      if (isFace) {
        throw new Error(`Territory ${id} face: missing source geometry`);
      }
      warnInvalidHitGeometry(id, surface);
      continue;
    }

    const hit = resolveHitPolygonPath(sourceD, isFace ? faceInset : depthInset);
    if (!hit) {
      if (isFace) {
        throw new Error(
          `Territory ${id} face could not produce a conservative hit polygon`,
        );
      }
      warnInvalidHitGeometry(id, surface);
      continue;
    }

    const hitPath = createHitPath({
      document,
      territoryId: id,
      surface,
      hit,
      label: nodes.face.dataset.name ?? `Território ${id}`,
      keyboard: isFace,
    });
    layer.append(hitPath);

    if (isFace) {
      if (faceHits.has(id)) {
        throw new Error(`Territory ${id} face has duplicate hit geometry`);
      }
      faceHits.set(id, hitPath);
    } else {
      depthHits.get(id)?.push(hitPath);
    }
  }

  const result = new Map<number, TerritoryHitNodes>();
  for (const [id] of territories) {
    const face = faceHits.get(id);
    if (!face) {
      throw new Error(`Territory ${id} face hit geometry is missing`);
    }
    result.set(id, { face, depths: depthHits.get(id) ?? [] });
  }

  boardRoot.append(layer);

  for (const nodes of territories.values()) {
    for (const surface of nodes.interactiveSurfaces) {
      surface.style.pointerEvents = "none";
    }
  }

  return result;
}
