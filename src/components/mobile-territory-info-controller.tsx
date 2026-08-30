"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const ORDER_LABEL = "Ordem de jogo";

function findTurnOrderStrip(mapCanvas: HTMLElement) {
  const parent = mapCanvas.parentElement;
  if (!parent) return null;

  const siblings = Array.from(parent.children);
  const mapIndex = siblings.indexOf(mapCanvas);
  if (mapIndex < 0) return null;

  for (const sibling of siblings.slice(0, mapIndex)) {
    if (!(sibling instanceof HTMLElement) || sibling.tagName !== "SECTION") continue;
    const label = sibling.querySelector("p")?.textContent?.trim();
    if (label === ORDER_LABEL) return sibling;
  }

  return null;
}

export function MobileTerritoryInfoController() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const runtime = document.querySelector<HTMLElement>(".game-runtime");
    const overlay = document.createElement("div");
    overlay.className = "mobile-territory-info-layer";
    overlay.dataset.visible = "false";
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-atomic", "true");
    document.body.append(overlay);

    let currentSurface: HTMLElement | null = null;
    let currentOrderStrip: HTMLElement | null = null;
    let surfaceObserver: MutationObserver | null = null;
    let orderObserver: ResizeObserver | null = null;
    let layoutFrame: number | null = null;
    let hasMobileInfo = false;

    const positionOverlay = () => {
      layoutFrame = null;
      if (!media.matches || !currentOrderStrip) return;

      const rect = currentOrderStrip.getBoundingClientRect();
      overlay.style.top = `${Math.round(rect.bottom)}px`;
      overlay.style.left = `${Math.round(rect.left)}px`;
      overlay.style.width = `${Math.round(rect.width)}px`;
    };

    const schedulePosition = () => {
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
      layoutFrame = window.requestAnimationFrame(positionOverlay);
    };

    const syncTerritoryInfo = () => {
      if (!media.matches || !currentSurface || !currentOrderStrip) return;

      const source = currentSurface.querySelector<HTMLElement>(
        ".game-territory-tooltip",
      );
      if (!source) {
        overlay.dataset.visible = hasMobileInfo ? "true" : "false";
        return;
      }

      overlay.innerHTML = source.innerHTML;
      hasMobileInfo = true;
      overlay.dataset.visible = "true";
      schedulePosition();
    };

    const attachSurface = (surface: HTMLElement | null) => {
      if (surface === currentSurface) return;
      surfaceObserver?.disconnect();
      surfaceObserver = null;
      currentSurface = surface;

      if (!surface) return;
      surfaceObserver = new MutationObserver(syncTerritoryInfo);
      surfaceObserver.observe(surface, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      syncTerritoryInfo();
    };

    const attachOrderStrip = (strip: HTMLElement | null) => {
      if (strip === currentOrderStrip) return;

      orderObserver?.disconnect();
      orderObserver = null;
      currentOrderStrip?.classList.remove("game-turn-order-strip-anchor");
      currentOrderStrip = strip;

      if (!strip) {
        overlay.dataset.visible = "false";
        return;
      }

      strip.classList.add("game-turn-order-strip-anchor");
      orderObserver = new ResizeObserver(schedulePosition);
      orderObserver.observe(strip);
      schedulePosition();
    };

    const locate = () => {
      const mapCanvas = document.querySelector<HTMLElement>(".game-map-canvas");
      attachSurface(
        mapCanvas?.querySelector<HTMLElement>(".game-map-surface") ?? null,
      );
      attachOrderStrip(mapCanvas ? findTurnOrderStrip(mapCanvas) : null);
      syncTerritoryInfo();
    };

    const onMediaChange = () => {
      if (!media.matches) {
        hasMobileInfo = false;
        overlay.dataset.visible = "false";
        overlay.replaceChildren();
        return;
      }
      locate();
      schedulePosition();
    };

    locate();
    const rootObserver = new MutationObserver(locate);
    if (runtime) {
      rootObserver.observe(runtime, { childList: true, subtree: true });
    }

    media.addEventListener("change", onMediaChange);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);

    return () => {
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
      rootObserver.disconnect();
      surfaceObserver?.disconnect();
      orderObserver?.disconnect();
      currentOrderStrip?.classList.remove("game-turn-order-strip-anchor");
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
      overlay.remove();
    };
  }, []);

  return null;
}
