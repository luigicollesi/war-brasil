import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = resolve(ROOT, "public/mapa-war-brasil-25d.svg");
const CONFIG_PATH = resolve(ROOT, "src/lib/shared/game-config.ts");
const REGION_ORDER = ["norte", "nordeste", "centro-oeste", "sudeste", "sul"];
const REGION_COLORS = {
  norte: "#67f58b",
  nordeste: "#63b4ff",
  "centro-oeste": "#ffd84d",
  sudeste: "#ff6262",
  sul: "#ff9a3d",
};
const POINT_PRECISION = 6;
const EPSILON = 1e-7;

function pointKey(point) {
  return `${point.x.toFixed(POINT_PRECISION)},${point.y.toFixed(POINT_PRECISION)}`;
}

function edgeKey(left, right) {
  const a = pointKey(left);
  const b = pointKey(right);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function parseTerritoryRegions(source) {
  const regions = new Map();
  const pattern = /^\s*(\d+):\s*\{\s*name:\s*"[^"]+",\s*region:\s*"([^"]+)"\s*\},?/gm;
  for (const match of source.matchAll(pattern)) {
    regions.set(Number(match[1]), match[2]);
  }

  if (regions.size !== 42) {
    throw new Error(`Expected 42 territory regions, received ${regions.size}.`);
  }
  for (const [id, region] of regions) {
    if (!REGION_ORDER.includes(region)) {
      throw new Error(`Territory ${id} has unsupported region ${region}.`);
    }
  }
  return regions;
}

function extractFaceMaskPaths(svg) {
  const paths = new Map();
  const maskPattern = /<mask\b(?=[^>]*\bid="face-mask-(\d+)")[^>]*>([\s\S]*?)<\/mask>/g;
  for (const match of svg.matchAll(maskPattern)) {
    const pathMatch = match[2].match(/<path\b[^>]*\bd="([^"]+)"[^>]*\/?\s*>/);
    if (!pathMatch) {
      throw new Error(`face-mask-${match[1]} does not contain a path geometry.`);
    }
    paths.set(Number(match[1]), pathMatch[1]);
  }

  if (paths.size !== 42) {
    throw new Error(`Expected 42 face-mask geometries, received ${paths.size}.`);
  }
  return paths;
}

function parsePolygonPath(d, id) {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  const points = [];
  let index = 0;
  let command = null;
  let current = { x: 0, y: 0 };
  let start = null;

  const number = () => {
    const token = tokens[index++];
    const value = Number(token);
    if (token == null || !Number.isFinite(value)) {
      throw new Error(`Territory ${id} has an invalid SVG path number.`);
    }
    return value;
  };

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error(`Territory ${id} path is missing a command.`);

    if (command === "M" || command === "m") {
      const relative = command === "m";
      const x = number();
      const y = number();
      current = {
        x: relative ? current.x + x : x,
        y: relative ? current.y + y : y,
      };
      start = { ...current };
      points.push({ ...current });
      command = relative ? "l" : "L";
      continue;
    }

    if (command === "L" || command === "l") {
      const relative = command === "l";
      const x = number();
      const y = number();
      current = {
        x: relative ? current.x + x : x,
        y: relative ? current.y + y : y,
      };
      points.push({ ...current });
      continue;
    }

    if (command === "H" || command === "h") {
      const value = number();
      current = {
        x: command === "h" ? current.x + value : value,
        y: current.y,
      };
      points.push({ ...current });
      continue;
    }

    if (command === "V" || command === "v") {
      const value = number();
      current = {
        x: current.x,
        y: command === "v" ? current.y + value : value,
      };
      points.push({ ...current });
      continue;
    }

    if (command === "Z" || command === "z") {
      if (!start) throw new Error(`Territory ${id} closes an empty path.`);
      current = { ...start };
      command = null;
      continue;
    }

    throw new Error(
      `Territory ${id} uses unsupported SVG command ${command}; region outlines expect polygonal M/L/H/V paths.`,
    );
  }

  if (points.length < 3) {
    throw new Error(`Territory ${id} has fewer than three polygon vertices.`);
  }
  return points;
}

function pointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const px = point.x - start.x;
  const py = point.y - start.y;
  const cross = px * dy - py * dx;
  const tolerance = EPSILON * Math.max(1, Math.abs(dx) + Math.abs(dy));
  if (Math.abs(cross) > tolerance) return false;

  const dot = px * dx + py * dy;
  const lengthSquared = dx * dx + dy * dy;
  return dot >= -EPSILON && dot <= lengthSquared + EPSILON;
}

function splitSegmentsAtRegionVertices(polygons) {
  const verticesByKey = new Map();
  for (const polygon of polygons) {
    for (const point of polygon) verticesByKey.set(pointKey(point), point);
  }
  const vertices = [...verticesByKey.values()];
  const atomicEdges = new Map();

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= EPSILON) continue;

      const points = [];
      for (const point of vertices) {
        if (!pointOnSegment(point, start, end)) continue;
        const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
        points.push({ point, t });
      }
      points.sort((left, right) => left.t - right.t);

      const ordered = [];
      let previousKey = null;
      for (const entry of points) {
        const key = pointKey(entry.point);
        if (key === previousKey) continue;
        ordered.push(entry.point);
        previousKey = key;
      }

      for (let part = 0; part < ordered.length - 1; part += 1) {
        const left = ordered[part];
        const right = ordered[part + 1];
        if (pointKey(left) === pointKey(right)) continue;
        const key = edgeKey(left, right);
        const existing = atomicEdges.get(key);
        if (existing) existing.count += 1;
        else atomicEdges.set(key, { a: left, b: right, count: 1 });
      }
    }
  }

  for (const [key, edge] of atomicEdges) {
    if (edge.count > 2) {
      throw new Error(`Non-manifold regional edge ${key} is shared ${edge.count} times.`);
    }
  }
  return [...atomicEdges.values()].filter((edge) => edge.count === 1);
}

function stitchBoundaryLoops(edges, region) {
  const points = new Map();
  const adjacency = new Map();
  const remaining = new Set();

  const connect = (left, right) => {
    const leftKey = pointKey(left);
    const rightKey = pointKey(right);
    points.set(leftKey, left);
    points.set(rightKey, right);
    if (!adjacency.has(leftKey)) adjacency.set(leftKey, new Set());
    if (!adjacency.has(rightKey)) adjacency.set(rightKey, new Set());
    adjacency.get(leftKey).add(rightKey);
    adjacency.get(rightKey).add(leftKey);
    remaining.add(edgeKey(left, right));
  };

  for (const edge of edges) connect(edge.a, edge.b);

  for (const [key, neighbors] of adjacency) {
    if (neighbors.size !== 2) {
      throw new Error(
        `Region ${region} boundary is not a closed manifold at ${key} (degree ${neighbors.size}).`,
      );
    }
  }

  const loops = [];
  while (remaining.size) {
    const firstEdgeKey = remaining.values().next().value;
    const [startKey, nextKey] = firstEdgeKey.split("|");
    const loop = [points.get(startKey), points.get(nextKey)];
    remaining.delete(firstEdgeKey);

    let previousKey = startKey;
    let currentKey = nextKey;
    let guard = 0;
    while (currentKey !== startKey) {
      guard += 1;
      if (guard > edges.length + 1) {
        throw new Error(`Region ${region} boundary loop did not close.`);
      }

      const candidates = [...adjacency.get(currentKey)].filter((candidate) => {
        if (candidate === previousKey) return false;
        return remaining.has(edgeKey(points.get(currentKey), points.get(candidate)));
      });

      if (!candidates.length) {
        const closing = edgeKey(points.get(currentKey), points.get(startKey));
        if (remaining.has(closing)) {
          remaining.delete(closing);
          currentKey = startKey;
          break;
        }
        throw new Error(`Region ${region} boundary stopped before closing.`);
      }

      const candidate = candidates[0];
      remaining.delete(edgeKey(points.get(currentKey), points.get(candidate)));
      previousKey = currentKey;
      currentKey = candidate;
      if (currentKey !== startKey) loop.push(points.get(currentKey));
    }

    loops.push(loop);
  }

  return loops;
}

function isCollinear(previous, current, next) {
  const cross =
    (current.x - previous.x) * (next.y - current.y) -
    (current.y - previous.y) * (next.x - current.x);
  return Math.abs(cross) <= EPSILON;
}

function simplifyLoop(loop) {
  if (loop.length <= 3) return loop;
  let current = loop;
  let changed = true;
  while (changed && current.length > 3) {
    changed = false;
    const next = [];
    for (let index = 0; index < current.length; index += 1) {
      const previous = current[(index - 1 + current.length) % current.length];
      const point = current[index];
      const following = current[(index + 1) % current.length];
      if (isCollinear(previous, point, following)) {
        changed = true;
        continue;
      }
      next.push(point);
    }
    if (next.length < 3) break;
    current = next;
  }
  return current;
}

function formatCoordinate(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function serializeLoops(loops) {
  return loops
    .map((rawLoop) => {
      const loop = simplifyLoop(rawLoop);
      const [first, ...rest] = loop;
      return `M ${formatCoordinate(first.x)} ${formatCoordinate(first.y)} ${rest
        .map((point) => `L ${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`)
        .join(" ")} Z`;
    })
    .join(" ");
}

function buildRegionOutlines(svg, config) {
  const territoryRegions = parseTerritoryRegions(config);
  const maskPaths = extractFaceMaskPaths(svg);
  const polygonsByRegion = new Map(REGION_ORDER.map((region) => [region, []]));

  for (let id = 1; id <= 42; id += 1) {
    const region = territoryRegions.get(id);
    const d = maskPaths.get(id);
    if (!region || !d) throw new Error(`Missing region geometry for territory ${id}.`);
    polygonsByRegion.get(region).push(parsePolygonPath(d, id));
  }

  const outlines = new Map();
  for (const region of REGION_ORDER) {
    const boundaryEdges = splitSegmentsAtRegionVertices(polygonsByRegion.get(region));
    if (!boundaryEdges.length) throw new Error(`Region ${region} has no external boundary.`);
    outlines.set(region, serializeLoops(stitchBoundaryLoops(boundaryEdges, region)));
  }
  return outlines;
}

function findGroupRange(svg, id) {
  const startPattern = new RegExp(`<g\\b(?=[^>]*\\bid="${id}")[^>]*>`);
  const match = startPattern.exec(svg);
  if (!match) return null;

  const tokenPattern = /<g\b[^>]*>|<\/g>/g;
  tokenPattern.lastIndex = match.index + match[0].length;
  let depth = 1;
  let token;
  while ((token = tokenPattern.exec(svg))) {
    if (token[0].startsWith("</g")) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: match.index, end: tokenPattern.lastIndex };
  }
  throw new Error(`SVG group #${id} is not closed.`);
}

function removeExistingOutlineGroup(svg) {
  const range = findGroupRange(svg, "region-outlines");
  if (!range) return svg;
  return `${svg.slice(0, range.start)}${svg.slice(range.end)}`;
}

function outlineMarkup(outlines) {
  const paths = REGION_ORDER.map(
    (region) =>
      `    <path class="region-outline" data-region="${region}" d="${outlines.get(region)}" fill="none" stroke="${REGION_COLORS[region]}" stroke-width="3" stroke-opacity="0.9" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`,
  ).join("\n");

  return `\n  <g id="region-outlines" aria-hidden="true" pointer-events="none">\n${paths}\n  </g>`;
}

function injectRegionOutlines(svg, outlines) {
  const cleanSvg = removeExistingOutlineGroup(svg);
  const territories = findGroupRange(cleanSvg, "territories");
  if (!territories) throw new Error("SVG group #territories is missing.");
  return `${cleanSvg.slice(0, territories.end)}${outlineMarkup(outlines)}${cleanSvg.slice(territories.end)}`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const svg = readFileSync(MAP_PATH, "utf8");
  const config = readFileSync(CONFIG_PATH, "utf8");
  const outlines = buildRegionOutlines(svg, config);
  const output = injectRegionOutlines(svg, outlines);

  for (const region of REGION_ORDER) {
    const d = outlines.get(region);
    if (!d || !d.includes("M ") || !d.includes(" Z")) {
      throw new Error(`Region ${region} did not produce a valid closed outline.`);
    }
  }

  if (!checkOnly && output !== svg) writeFileSync(MAP_PATH, output);

  console.log(
    `Region outlines ready: ${REGION_ORDER.map((region) => `${region}=${outlines.get(region).length}`).join(", ")}${checkOnly ? " (check only)" : ""}`,
  );
}

main();
