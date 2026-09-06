import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const INTERACTIVE_TERRITORY_SELECTOR =
  '[data-territory-interactive="true"][data-territory-id]';

type ClosestCapable = {
  closest?: (selector: string) => Element | null;
  parentElement?: Element | null;
};

function closestCapableElement(node: EventTarget | Node | null): Element | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as ClosestCapable;
  if (typeof candidate.closest === "function") {
    return candidate as Element;
  }

  return candidate.parentElement ?? null;
}

export function territoryIdFromNode(
  node: EventTarget | Node | null,
  root: Element,
): number | null {
  const element = closestCapableElement(node);
  const target = element?.closest(INTERACTIVE_TERRITORY_SELECTOR);
  if (!target || !root.contains(target)) return null;

  const id = Number((target as SVGElement).dataset.territoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function territoryIdFromEvent(
  event: Event,
  root: Element,
): number | null {
  return territoryIdFromNode(event.target, root);
}

export function prepareTerritoryInteractiveSurfaces(
  territories: ReadonlyMap<number, TerritoryVisualNodes>,
) {
  for (const [id, nodes] of territories) {
    for (const surface of nodes.interactiveSurfaces) {
      surface.dataset.territoryId = String(id);
      surface.dataset.territoryInteractive = "true";
      surface.style.pointerEvents = "visiblePainted";
      surface.style.cursor = "pointer";
    }
  }
}
