"use client";

import { useEffect } from "react";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_MAX_SCALE,
  MAP_MIN_SCALE,
  MAP_PAN_THRESHOLD,
  MAP_VIEWPORT_EVENT,
  clampMapViewport,
  fitMapViewportToBounds,
  mapStrokeWidthForScale,
  mapViewportToViewBox,
  type MapViewportPoint,
  type MapViewportTransform,
  type MapWorldBounds,
  unionMapBounds,
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
const STROKE_EPSILON = 0.001;
const MOBILE_MAP_QUERY = "(max-width: 767px)";

function midpoint(a: PointerSample, b: PointerSample) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function distance(a: PointerSample, b: PointerSample) {
  return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
}

function readFocusTerritoryIds(surface: HTMLElement) {
  const ids = (surface.dataset.mapFocusIds ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(ids)].sort((a, b) => a - b);
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
      let applyTerritoryStrokeScale = () => {};
      let lastFocusKey: string | null = null;
      let autoFocusActive = false;
      let lastMobile = window.matchMedia(MOBILE_MAP_QUERY).matches;

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
        applyTerritoryStrokeScale();

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

      const focusBoundsForTerritories = (
        territoryIds: readonly number[],
      ): MapWorldBounds | null => {
        const territoryRoot = board.contentDocument?.querySelector("#territories");
        if (!territoryRoot || !territoryIds.length) return null;

        const boxes: MapWorldBounds[] = [];
        for (const territoryId of territoryIds) {
          const path = territoryRoot.querySelector<SVGPathElement>(
            `path.territory[data-id="${territoryId}"]`,
          );
          if (!path) return null;

          try {
            const box = path.getBBox();
            if (box.width <= 0 || box.height <= 0) return null;
            boxes.push({
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            });
          } catch {
            return null;
          }
        }

        return unionMapBounds(boxes);
      };

      const applyFocusFromSurface = ({ force = false } = {}) => {
        const territoryIds = readFocusTerritoryIds(surface);
        const focusKey = territoryIds.join(",");
        const mobile = window.matchMedia(MOBILE_MAP_QUERY).matches;

        if (!mobile) {
          const shouldReset = autoFocusActive;
          lastFocusKey = focusKey;
          autoFocusActive = false;
          if (shouldReset) applyViewport({ ...DEFAULT_MAP_VIEWPORT });
          return shouldReset;
        }

        if (!force && focusKey === lastFocusKey) return false;

        if (!territoryIds.length) {
          const shouldReset = autoFocusActive;
          lastFocusKey = focusKey;
          autoFocusActive = false;
          if (shouldReset) applyViewport({ ...DEFAULT_MAP_VIEWPORT });
          return shouldReset;
        }

        const bounds = focusBoundsForTerritories(territoryIds);
        if (!bounds) return false;

        const { width, height } = dimensions();
        if (width <= 0 || height <= 0) return false;

        lastFocusKey = focusKey;
        autoFocusActive = true;
        applyViewport(
          fitMapViewportToBounds({
            bounds,
            width,
            height,
          }),
        );
        return true;
      };

      const suppressSelection = () => {
        surface.dataset.mapGestureSuppressUntil = String(
          performance.now() + CLICK_SUPPRESSION_MS,
        );
      };

      const bindSvg = () => {
        detachSvg();

        const root = board.contentDocument?.documentElement;
        if (
          !root ||
          root.tagName.toLowerCase() !== "svg" ||
          root.namespaceURI !== "http://www.w3.org/2000/svg"
        ) {
          return;
        }
        const svg = root as unknown as SVGSVGElement;
        const territoryRoot = svg.querySelector("#territories");

        svg.style.touchAction = "none";
        svg.style.userSelect = "none";
        svg.style.webkitUserSelect = "none";

        const baseStrokeByPath = new WeakMap<SVGPathElement, number>();
        const lastAppliedStrokeByPath = new WeakMap<SVGPathElement, number>();

        applyTerritoryStrokeScale = () => {
          if (!territoryRoot) return;
          const mobile = window.matchMedia(MOBILE_MAP_QUERY).matches;

          for (const path of territoryRoot.querySelectorAll<SVGPathElement>(
            "path.territory",
          )) {
            const currentStroke = Number.parseFloat(path.style.strokeWidth);
            const lastApplied = lastAppliedStrokeByPath.get(path);

            if (
              Number.isFinite(currentStroke) &&
              (lastApplied === undefined ||
                Math.abs(currentStroke - lastApplied) > STROKE_EPSILON)
            ) {
              baseStrokeByPath.set(path, currentStroke);
            }

            const baseStroke = baseStrokeByPath.get(path);
            if (baseStroke === undefined) continue;

            const nextStroke = mobile
              ? mapStrokeWidthForScale(baseStroke, viewport.scale)
              : baseStroke;

            lastAppliedStrokeByPath.set(path, nextStroke);
            if (
              !Number.isFinite(currentStroke) ||
              Math.abs(currentStroke - nextStroke) > STROKE_EPSILON
            ) {
              path.style.strokeWidth = String(nextStroke);
            }
          }
        };

        const strokeObserver = territoryRoot
          ? new MutationObserver(() => applyTerritoryStrokeScale())
          : null;
        strokeObserver?.observe(territoryRoot as Element, {
          attributes: true,
          subtree: true,
          attributeFilter: ["style"],
        });
        applyTerritoryStrokeScale();

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
          strokeObserver?.disconnect();
          applyTerritoryStrokeScale = () => {};
          svg.removeEventListener("pointerdown", onPointerDown);
          svg.removeEventListener("pointermove", onPointerMove);
          svg.removeEventListener("pointerup", finishPointer);
          svg.removeEventListener("pointercancel", finishPointer);
          svg.removeEventListener("click", onClickCapture, true);
        };
      };

      const onBoardLoad = () => {
        bindSvg();
        if (!applyFocusFromSurface({ force: true })) {
          applyViewport(viewport);
        }
      };

      board.addEventListener("load", onBoardLoad);
      bindSvg();

      const focusObserver = new MutationObserver(() => {
        applyFocusFromSurface();
      });
      focusObserver.observe(surface, {
        attributes: true,
        attributeFilter: ["data-map-focus-ids"],
      });

      const resizeObserver = new ResizeObserver(() => {
        const mobile = window.matchMedia(MOBILE_MAP_QUERY).matches;
        const breakpointChanged = mobile !== lastMobile;
        lastMobile = mobile;

        if (breakpointChanged || (mobile && autoFocusActive)) {
          if (applyFocusFromSurface({ force: true })) return;
        }

        applyViewport(viewport);
      });
      resizeObserver.observe(surface);

      const overlayObserver = new MutationObserver(() => {
        applyViewport(viewport);
      });
      overlayObserver.observe(surface, { childList: true, subtree: true });

      if (!applyFocusFromSurface({ force: true })) {
        applyViewport(viewport);
      }

      detachSurface = () => {
        board.removeEventListener("load", onBoardLoad);
        detachSvg();
        focusObserver.disconnect();
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
