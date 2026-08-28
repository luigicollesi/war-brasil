"use client";

import { useEffect } from "react";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_MAX_SCALE,
  MAP_MIN_SCALE,
  MAP_PAN_THRESHOLD,
  MAP_VIEWPORT_EVENT,
  clampMapViewport,
  mapViewportToViewBox,
  type MapViewportPoint,
  type MapViewportTransform,
  zoomMapViewportAtPoint,
} from "@/src/lib/game-map-viewport";

type PointerSample = {
  x: number;
  y: number;
};

type SingleGesture = PointerSample & {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type PinchGesture = {
  distance: number;
  focus: MapViewportPoint;
  viewport: MapViewportTransform;
};

const CLICK_SUPPRESSION_MS = 450;

function midpoint(a: PointerSample, b: PointerSample) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function distance(a: PointerSample, b: PointerSample) {
  return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
}

export function MapZoomController() {
  useEffect(() => {
    let currentSurface: HTMLElement | null = null;
    let detachSurface = () => {};

    const attachSurface = (surface: HTMLElement) => {
      detachSurface();
      currentSurface = surface;

      const board = surface.querySelector<HTMLObjectElement>(".game-map-object");
      if (!board) return;

      let viewport: MapViewportTransform = { ...DEFAULT_MAP_VIEWPORT };
      let detachSvg = () => {};

      const dimensions = () => ({
        width: surface.clientWidth || surface.getBoundingClientRect().width,
        height: surface.clientHeight || surface.getBoundingClientRect().height,
      });

      const applyViewport = (candidate: MapViewportTransform) => {
        const { width, height } = dimensions();
        viewport = clampMapViewport(candidate, width, height);

        board.style.transformOrigin = "0 0";
        board.style.transform = `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.scale})`;

        surface.dataset.mapZoomed =
          viewport.scale > MAP_MIN_SCALE + 0.001 ? "true" : "false";
        surface.style.setProperty("--game-map-scale", String(viewport.scale));

        const viewBox = mapViewportToViewBox(viewport, width, height).value;
        for (const overlay of surface.querySelectorAll<SVGSVGElement>("svg[viewBox]")) {
          overlay.setAttribute("viewBox", viewBox);
        }

        surface.dispatchEvent(
          new CustomEvent<MapViewportTransform>(MAP_VIEWPORT_EVENT, {
            detail: { ...viewport },
          }),
        );
      };

      const suppressSelection = () => {
        surface.dataset.mapGestureSuppressUntil = String(
          performance.now() + CLICK_SUPPRESSION_MS,
        );
      };

      const bindSvg = () => {
        detachSvg();

        const svg = board.contentDocument?.documentElement as SVGSVGElement | null;
        if (!svg || svg.tagName.toLowerCase() !== "svg") return;

        svg.style.touchAction = "none";
        svg.style.userSelect = "none";
        svg.style.webkitUserSelect = "none";

        const pointers = new Map<number, PointerSample>();
        let single: SingleGesture | null = null;
        let pinch: PinchGesture | null = null;

        const relativePoint = (point: PointerSample) => {
          const rect = surface.getBoundingClientRect();
          return {
            x: point.x - rect.left,
            y: point.y - rect.top,
          };
        };

        const startPinch = () => {
          const samples = Array.from(pointers.values()).slice(0, 2);
          if (samples.length < 2) {
            pinch = null;
            return;
          }

          pinch = {
            distance: distance(samples[0], samples[1]),
            focus: relativePoint(midpoint(samples[0], samples[1])),
            viewport: { ...viewport },
          };
          single = null;
          suppressSelection();
        };

        const onPointerDown = (event: PointerEvent) => {
          if (event.pointerType !== "touch") return;

          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const captureTarget = event.target as Element & {
            setPointerCapture?: (pointerId: number) => void;
          };
          try {
            captureTarget.setPointerCapture?.(event.pointerId);
          } catch {
            // Pointer capture is an optimization; the gesture still works without it.
          }

          if (pointers.size >= 2) {
            startPinch();
            return;
          }

          single = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
          };
        };

        const onPointerMove = (event: PointerEvent) => {
          if (event.pointerType !== "touch" || !pointers.has(event.pointerId)) {
            return;
          }

          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

          if (pointers.size >= 2 && pinch) {
            const samples = Array.from(pointers.values()).slice(0, 2);
            const currentDistance = distance(samples[0], samples[1]);
            const currentFocus = relativePoint(midpoint(samples[0], samples[1]));
            const nextScale = Math.min(
              MAP_MAX_SCALE,
              Math.max(
                MAP_MIN_SCALE,
                pinch.viewport.scale * (currentDistance / pinch.distance),
              ),
            );
            const { width, height } = dimensions();

            applyViewport(
              zoomMapViewportAtPoint({
                viewport: pinch.viewport,
                startFocus: pinch.focus,
                currentFocus,
                nextScale,
                width,
                height,
              }),
            );
            suppressSelection();
            event.preventDefault();
            return;
          }

          if (!single || single.pointerId !== event.pointerId) return;

          const totalDistance = Math.hypot(
            event.clientX - single.x,
            event.clientY - single.y,
          );
          if (totalDistance <= MAP_PAN_THRESHOLD) return;

          suppressSelection();
          event.preventDefault();

          if (viewport.scale <= MAP_MIN_SCALE + 0.001) return;

          const dx = event.clientX - single.lastX;
          const dy = event.clientY - single.lastY;
          single.lastX = event.clientX;
          single.lastY = event.clientY;

          applyViewport({
            ...viewport,
            panX: viewport.panX + dx,
            panY: viewport.panY + dy,
          });
        };

        const finishPointer = (event: PointerEvent) => {
          if (event.pointerType !== "touch") return;
          pointers.delete(event.pointerId);

          if (pointers.size >= 2) {
            startPinch();
            return;
          }

          pinch = null;
          const remaining = Array.from(pointers.entries())[0];
          if (remaining) {
            const [pointerId, point] = remaining;
            single = {
              pointerId,
              x: point.x,
              y: point.y,
              lastX: point.x,
              lastY: point.y,
            };
            return;
          }

          single = null;
          if (viewport.scale <= MAP_MIN_SCALE + 0.01) {
            applyViewport({ ...DEFAULT_MAP_VIEWPORT });
          }
        };

        const onClickCapture = (event: MouseEvent) => {
          const suppressUntil = Number(
            surface.dataset.mapGestureSuppressUntil ?? "0",
          );
          if (performance.now() >= suppressUntil) return;

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        };

        svg.addEventListener("pointerdown", onPointerDown);
        svg.addEventListener("pointermove", onPointerMove);
        svg.addEventListener("pointerup", finishPointer);
        svg.addEventListener("pointercancel", finishPointer);
        svg.addEventListener("click", onClickCapture, true);

        detachSvg = () => {
          svg.removeEventListener("pointerdown", onPointerDown);
          svg.removeEventListener("pointermove", onPointerMove);
          svg.removeEventListener("pointerup", finishPointer);
          svg.removeEventListener("pointercancel", finishPointer);
          svg.removeEventListener("click", onClickCapture, true);
        };
      };

      const onBoardLoad = () => {
        bindSvg();
        applyViewport(viewport);
      };

      board.addEventListener("load", onBoardLoad);
      bindSvg();

      const resizeObserver = new ResizeObserver(() => {
        applyViewport(viewport);
      });
      resizeObserver.observe(surface);

      const overlayObserver = new MutationObserver(() => {
        applyViewport(viewport);
      });
      overlayObserver.observe(surface, { childList: true, subtree: true });

      applyViewport(viewport);

      detachSurface = () => {
        board.removeEventListener("load", onBoardLoad);
        detachSvg();
        resizeObserver.disconnect();
        overlayObserver.disconnect();
      };
    };

    const locateSurface = () => {
      const nextSurface = document.querySelector<HTMLElement>(".game-map-surface");
      if (nextSurface === currentSurface) return;
      if (!nextSurface) {
        detachSurface();
        currentSurface = null;
        return;
      }
      attachSurface(nextSurface);
    };

    locateSurface();
    const rootObserver = new MutationObserver(locateSurface);
    rootObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      rootObserver.disconnect();
      detachSurface();
    };
  }, []);

  return null;
}
