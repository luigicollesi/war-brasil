import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = resolve(ROOT, "public/mapa-war-brasil-25d.svg");
const CONFIG_PATH = resolve(ROOT, "src/lib/shared/game-config.ts");
const BOARD_SIZE = 1254;
const REGION_ORDER = ["norte", "nordeste", "centro-oeste", "sudeste", "sul"];
const REGION_COLORS = {
  norte: "#67f58b",
  nordeste: "#63b4ff",
  "centro-oeste": "#ffd84d",
  sudeste: "#ff6262",
  sul: "#ff9a3d",
};

// Territory faces are intentionally inset from one another. The erase stroke
// bridges those seams inside a region; the wider colored stroke leaves only a
// thin band around the outside of the regional silhouette.
const INTERNAL_ERASE_STROKE = 12;
const OUTLINE_STROKE = 18;

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

function buildRegionShapes(svg, config) {
  const territoryRegions = parseTerritoryRegions(config);
  const maskPaths = extractFaceMaskPaths(svg);
  const pathsByRegion = new Map(REGION_ORDER.map((region) => [region, []]));

  for (let id = 1; id <= 42; id += 1) {
    const region = territoryRegions.get(id);
    const d = maskPaths.get(id);
    if (!region || !d) {
      throw new Error(`Missing region geometry for territory ${id}.`);
    }
    pathsByRegion.get(region).push(d);
  }

  const shapes = new Map();
  for (const region of REGION_ORDER) {
    const paths = pathsByRegion.get(region);
    if (!paths?.length) throw new Error(`Region ${region} has no territories.`);

    const d = paths.join(" ");
    if (!/[Mm]/.test(d) || !/[Zz]/.test(d)) {
      throw new Error(`Region ${region} did not produce a closed composite shape.`);
    }
    shapes.set(region, { d, territoryCount: paths.length });
  }
  return shapes;
}

function findElementRange(svg, tagName, id) {
  const startPattern = new RegExp(`<${tagName}\\b(?=[^>]*\\bid="${id}")[^>]*>`);
  const match = startPattern.exec(svg);
  if (!match) return null;

  const tokenPattern = new RegExp(`<${tagName}\\b[^>]*>|<\\/${tagName}>`, "g");
  tokenPattern.lastIndex = match.index + match[0].length;
  let depth = 1;
  let token;
  while ((token = tokenPattern.exec(svg))) {
    if (token[0].startsWith(`</${tagName}`)) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: match.index, end: tokenPattern.lastIndex };
  }

  throw new Error(`SVG ${tagName} #${id} is not closed.`);
}

function removeElement(svg, tagName, id) {
  const range = findElementRange(svg, tagName, id);
  if (!range) return svg;
  return `${svg.slice(0, range.start)}${svg.slice(range.end)}`;
}

function removeGeneratedArtifacts(svg) {
  return removeElement(
    removeElement(svg, "g", "region-outlines"),
    "defs",
    "region-outline-defs",
  );
}

function regionOutlineMarkup(shapes) {
  const shapeDefinitions = REGION_ORDER.map((region) => {
    const shape = shapes.get(region);
    return `    <path id="region-shape-${region}" d="${shape.d}"/>`;
  }).join("\n");

  const masks = REGION_ORDER.map(
    (region) => `    <mask id="region-outline-mask-${region}" maskUnits="userSpaceOnUse" x="0" y="0" width="${BOARD_SIZE}" height="${BOARD_SIZE}" style="mask-type:luminance">
      <rect x="0" y="0" width="${BOARD_SIZE}" height="${BOARD_SIZE}" fill="#fff"/>
      <use href="#region-shape-${region}" fill="#000" stroke="#000" stroke-width="${INTERNAL_ERASE_STROKE}" stroke-linejoin="round" stroke-linecap="round"/>
    </mask>`,
  ).join("\n");

  const outlines = REGION_ORDER.map(
    (region) =>
      `    <use class="region-outline" data-region="${region}" href="#region-shape-${region}" fill="none" stroke="${REGION_COLORS[region]}" stroke-width="${OUTLINE_STROKE}" stroke-opacity="0.92" stroke-linejoin="round" stroke-linecap="round" mask="url(#region-outline-mask-${region})" pointer-events="none"/>`,
  ).join("\n");

  return `\n  <defs id="region-outline-defs">\n${shapeDefinitions}\n${masks}\n  </defs>\n  <g id="region-outlines" aria-hidden="true" pointer-events="none">\n${outlines}\n  </g>`;
}

function injectRegionOutlines(svg, shapes) {
  const cleanSvg = removeGeneratedArtifacts(svg);
  const territories = findElementRange(cleanSvg, "g", "territories");
  if (!territories) throw new Error("SVG group #territories is missing.");

  return `${cleanSvg.slice(0, territories.end)}${regionOutlineMarkup(shapes)}${cleanSvg.slice(territories.end)}`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const svg = readFileSync(MAP_PATH, "utf8");
  const config = readFileSync(CONFIG_PATH, "utf8");
  const shapes = buildRegionShapes(svg, config);
  const output = injectRegionOutlines(svg, shapes);

  if (!checkOnly && output !== svg) writeFileSync(MAP_PATH, output);

  console.log(
    `Region silhouettes ready: ${REGION_ORDER.map((region) => {
      const shape = shapes.get(region);
      return `${region}=${shape.territoryCount}`;
    }).join(", ")}${checkOnly ? " (check only)" : ""}`,
  );
}

main();
