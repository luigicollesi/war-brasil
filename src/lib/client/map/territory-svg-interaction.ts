import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const INTERACTIVE_TERRITORY_SELECTOR =
  '[data-territory-interactive="true"][data-territory-id]';
const MASK_REFERENCE = /^url\(#([^)]+)\)$/;

const maskGeometryBySurface = new WeakMap<SVGElement, SVGGeometryElement | null>();

type ClosestCapable = {
  closest?: (selector: string) => Element | null;
  parentElement?: Element | null;
};

type ClientPointEvent = Event & {
  clientX: number;
  clientY: number;
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

function territoryIdFromTarget(target: SVGElement | null): number | null {
  if (!target) return null;
  const id = Number(target.dataset.territoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function embeddedMapSurface(root: Element): HTMLElement | null {
  const frameElement = root.ownerDocument.defaultView?.frameElement;
  return frameElement?.closest?.(".game-map-surface") as HTMLElement | null;
}

function mapGestureIsActive(root: Element) {
  return embeddedMapSurface(root)?.dataset.mapGestureActive === "true";
}

function maskGeometryForSurface(surface: SVGElement): SVGGeometryElement | null {
  if (maskGeometryBySurface.has(surface)) {
    return maskGeometryBySurface.get(surface) ?? null;
  }

  const maskReference = surface.getAttribute("mask")?.trim();
  const maskId = maskReference ? MASK_REFERENCE.exec(maskReference)?.[1] : undefined;
  if (!maskId) {
    maskGeometryBySurface.set(surface, null);
    return null;
  }

  const mask = surface.ownerDocument.getElementById(maskId);
  const geometry = mask?.querySelector<SVGGeometryElement>("path") ?? null;
  maskGeometryBySurface.set(surface, geometry);
  return geometry;
}

function pointIsInsideVisibleMask(
  surface: SVGElement,
  clientX: number,
  clientY: number,
): boolean {
  const geometry = maskGeometryForSurface(surface);
  if (!geometry) return true;

  const svg = geometry.ownerSVGElement;
  const matrix = geometry.getScreenCTM?.();
  if (!svg || !matrix) return true;

  try {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const localPoint = point.matrixTransform(matrix.inverse());

    const insideFill =
      typeof geometry.isPointInFill === "function"
        ? geometry.isPointInFill(localPoint)
        : true;
    const insideMaskStroke =
      typeof geometry.isPointInStroke === "function"
        ? geometry.isPointInStroke(localPoint)
        : false;

    // The 2.5D masks are a white fill eroded by a black outline. SVG masks do
    // not constrain pointer hit-testing by themselves, so mirror that mask
    // geometry explicitly and reject the black erosion stroke.
    return insideFill && !insideMaskStroke;
  } catch {
    // Geometry APIs are broadly supported in target browsers; keep the visual
    // surface usable as a graceful fallback if a browser cannot probe it.
    return true;
  }
}

function isClientPointEvent(event: Event): event is ClientPointEvent {
  const candidate = event as Partial<ClientPointEvent>;
  return (
    typeof candidate.clientX === "number" &&
    Number.isFinite(candidate.clientX) &&
    typeof candidate.clientY === "number" &&
    Number.isFinite(candidate.clientY)
  );
}

function territoryIdAtClientPoint(
  event: ClientPointEvent,
  root: Element,
): number | null {
  const document = root.ownerDocument;
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  const seen = new Set<SVGElement>();

  for (const element of elements) {
    const target = interactiveTargetFromNode(element, root);
    if (!target || seen.has(target)) continue;
    seen.add(target);

    if (!pointIsInsideVisibleMask(target, event.clientX, event.clientY)) {
      continue;
    }

    const id = territoryIdFromTarget(target);
    if (id !== null) return id;
  }

  const fallback = interactiveTargetFromNode(event.target, root);
  if (
    fallback &&
    pointIsInsideVisibleMask(fallback, event.clientX, event.clientY)
  ) {
    return territoryIdFromTarget(fallback);
  }

  return null;
}

export function territoryIdFromNode(
  node: EventTarget | Node | null,
  root: Element,
): number | null {
  return territoryIdFromTarget(interactiveTargetFromNode(node, root));
}

export function territoryIdFromEvent(
  event: Event,
  root: Element,
): number | null {
  // pointerout describes the element being left; resolving the new client point
  // here would return the destination instead of the source territory.
  if (event.type === "pointerout" || !isClientPointEvent(event)) {
    return territoryIdFromNode(event.target, root);
  }

  if (event.type.startsWith("pointer") && mapGestureIsActive(root)) {
    return null;
  }

  return territoryIdAtClientPoint(event, root);
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

      if (surface !== nodes.face) {
        surface.setAttribute("aria-hidden", "true");
        surface.removeAttribute("tabindex");
        surface.removeAttribute("role");
      }
    }
  }
}
