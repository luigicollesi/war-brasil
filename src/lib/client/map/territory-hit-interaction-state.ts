const HIT_TARGET_SELECTOR =
  '[data-map-hit-layer="true"] [data-territory-hit="true"]';

export function setTerritoryHitInteractionEnabled(
  boardRoot: Element,
  enabled: boolean,
) {
  for (const path of boardRoot.querySelectorAll<SVGPathElement>(
    HIT_TARGET_SELECTOR,
  )) {
    const keyboardTarget = path.dataset.territorySurface === "face";

    if (!enabled && path.ownerDocument.activeElement === path) {
      const focusablePath = path as SVGPathElement & { blur?: () => void };
      focusablePath.blur?.();
    }

    path.style.pointerEvents = enabled ? "fill" : "none";
    path.style.cursor = enabled ? "pointer" : "default";

    if (!keyboardTarget) {
      path.setAttribute("tabindex", "-1");
      path.setAttribute("aria-hidden", "true");
      continue;
    }

    path.setAttribute("tabindex", enabled ? "0" : "-1");
    if (enabled) {
      path.removeAttribute("aria-disabled");
    } else {
      path.setAttribute("aria-disabled", "true");
    }
  }
}
