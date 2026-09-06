const INTERACTIVE_TERRITORY_SELECTOR =
  '[data-territory-hit="true"][data-territory-id]';

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

function interactiveTargetFromNode(
  node: EventTarget | Node | null,
  root: Element,
): SVGElement | null {
  const element = closestCapableElement(node);
  const target = element?.closest(INTERACTIVE_TERRITORY_SELECTOR);
  if (!target || !root.contains(target)) return null;
  return target as SVGElement;
}

export function territoryIdFromNode(
  node: EventTarget | Node | null,
  root: Element,
): number | null {
  const target = interactiveTargetFromNode(node, root);
  if (!target) return null;

  const id = Number(target.dataset.territoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function territoryIdFromEvent(
  event: Event,
  root: Element,
): number | null {
  return territoryIdFromNode(event.target, root);
}
