import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const HIT_LAYER_SELECTOR = '[data-map-hit-layer="true"]';

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

    const next = command === command.toLowerCase()
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
  return length > 1e-8 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function lineIntersection(
  a: Point,
  aDirection: Point,
  b: Point,
  bDirection: Point,
): Point | null {
  const denominator =
    aDirection.x * bDirection.y - aDirection.y * bDirection.x;
  if (Math.abs(denominator) < 1e-8) return null;

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
    const incomingNormal = orientation > 0
      ? { x: -incoming.y, y: incoming.x }
      : { x: incoming.y, y: -incoming.x };
    const outgoingNormal = orientation > 0
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

function formatNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

export function insetPolygonPath(d: string, inset: number): string | null {
  const parsed = parsePolygonPath(d);
  if (!parsed) return null;
  const insetPoints = insetPolygon(parsed.points, inset);
  if (!insetPoints) return null;

  return `${insetPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
    .join(" ")} Z`;
}

function createHitPath({
  document,
  territoryId,
  surface,
  d,
  label,
  keyboard,
}: {
  document: Document;
  territoryId: number;
  surface: string;
  d: string;
  label: string;
  keyboard: boolean;
}) {
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  path.setAttribute("d", d);
  path.setAttribute("fill", "transparent");
  path.setAttribute("stroke", "none");
  path.setAttribute("pointer-events", "fill");
  path.dataset.territoryHit = "true";
  path.dataset.territoryId = String(territoryId);
  path.dataset.territorySurface = surface;
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
      const hitD = insetPolygonPath(sourceD, depthInset);
      if (!hitD) {
        throw new Error(`Territory ${id} depth ${depthIndex + 1}: unsupported hit geometry`);
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
    const hitD = insetPolygonPath(sourceD, faceInset);
    if (!hitD) {
      throw new Error(`Territory ${id} face: unsupported hit geometry`);
    }
    const hit = createHitPath({
      document,
      territoryId: id,
      surface: "face",
      d: hitD,
      label: nodes.face.dataset.name ?? `Território ${id}`,
      keyboard: true,
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
