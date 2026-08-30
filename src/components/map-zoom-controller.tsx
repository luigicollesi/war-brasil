"use client";

import { useEffect } from "react";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_AUTO_FOCUS_DURATION_MS,
  MAP_MAX_SCALE,
  MAP_MIN_SCALE,
  MAP_PAN_THRESHOLD,
  MAP_VIEWPORT_EVENT,
  clampMapViewport,
  easeOutCubic,
  fitMapViewportToBounds,
  interpolateMapViewport,
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
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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
      let autoFocusFrame: number | null = null;
      const territoryBoundsById = new Map<number, MapWorldBounds>();

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

      const cancelAutoFocusAnimation = () => {
        if (autoFocusFrame === null) return;
        window.cancelAnimationFrame(autoFocusFrame);
        autoFocusFrame = null;
      };

      const animateViewportTo = (
        target: MapViewportTransform,
        { animated = true }: { animated?: boolean } = {},
      ) => {
        cancelAutoFocusAnimation();

        if (
          !animated ||
          window.matchMedia(REDUCED_MOTION_QUERY).matches ||
          MAP_AUTO_FOCUS_DURATION_MS <= 0
        ) {
          applyViewport(target);
          return;
        }

        const startViewport = { ...viewport };
        const startedAt = performance.now();

        const step = (now: number) => {
          const progress = Math.min(
            1,
            Math.max(0, (now - startedAt) / MAP_AUTO_FOCUS_DURATION_MS),
          );
          applyViewport(
            interpolateMapViewport(
              startViewport,
              target,
              easeOutCubic(progress),
            ),
          );

          if (progress >= 1) {
            autoFocusFrame = null;
            return;
          }

          autoFocusFrame = window.requestAnimationFrame(step);
        };

        autoFocusFrame = window.requestAnimationFrame(step);
      };

      const cacheTerritoryBounds = (territoryRoot: Element | null) => {
        territoryBoundsById.clear();
        if (!territoryRoot) return;

        for (const path of territoryRoot.querySelectorAll<SVGPathElement>(
          "path.territory",
        )) {
          const territoryId = Number(path.dataset.id);
          if (!Number.isInteger(territoryId) || territoryId <= 0) continue;

          try {
            const box = path.getBBox();
            if (box.width <= 0 || box.height <= 0) continue;
            territoryBoundsById.set(territoryId, {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            });
          } catch {
            // Ignore a path whose geometry is not ready yet; a later SVG load can retry.
          }
        }
      };

      const focusBoundsForTerritories = (
        territoryIds: readonly number[],
      ): MapWorldBounds | null => {
        if (!territoryIds.length) return null;

        const boxes: MapWorldBounds[] = [];
        for (const territoryId of territoryIds) {
          const box = territoryBoundsById.get(territoryId);
          if (!box) return null;
          boxes.push(box);
        }

        return unionMapBounds(boxes);
      };

      const applyFocusFromSurface = (
        {
          force = false,
          animated = true,
        }: { force?: boolean; animated?: boolean } = {},
      ) => {
        const territoryIds = readFocusTerritoryIds(surface);
        const focusKey = territoryIds.join(",");
        const mobile = window.matchMedia(MOBILE_MAP_QUERY).matches;

        if (!mobile) {
          const shouldReset = autoFocusActive;
          lastFocusKey = focusKey;
          autoFocusActive = false;
          if (shouldReset) {
            animateViewportTo({ ...DEFAULT_MAP_VIEWPORT }, { animated: false });
          }
          return shouldReset;
        }

        if (!force && focusKey === lastFocusKey) return false;

        if (!territoryIds.length) {
          const shouldReset = autoFocusActive;
          lastFocusKey = focusKey;
          autoFocusActive = false;
          if (shouldReset) {
            animateViewportTo({ ...DEFAULT_MAP_VIEWPORT }, { animated });
          }
          return shouldReset;
        }

        const bounds = focusBoundsForTerritories(territoryIds);
        if (!bounds) return false;

        const { width, height } = dimensions();
        if (width <= 0 || height <= 0) return false;

        lastFocusKey = focusKey;
        autoFocusActive = true;
        animateViewportTo(
          fitMapViewportToBounds({
            bounds,
            width,
            height,
          }),
          { animated },
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
        territoryBoundsById.clear();

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
        cacheTerritoryBounds(territoryRoot);

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
          cancelAutoFocusAnimation();

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
          territoryBoundsById.clear();
          svg.removeEventListener("pointerdown", onPointerDown);
          svg.removeEventListener("pointermove", onPointerMove);
          svg.removeEventListener("pointerup", finishPointer);
          svg.removeEventListener("pointercancel", finishPointer);
          svg.removeEventListener("click", onClickCapture, true);
        };
      };

      const onBoardLoad = () => {
        cancelAutoFocusAnimation();
        bindSvg();
        if (!applyFocusFromSurface({ force: true, animated: false })) {
          applyViewport(viewport);
        }
      };

      board.addEventListener("load", onBoardLoad);
      bindSvg();

      const focusObserver = new MutationObserver(() => {
        applyFocusFromSurface({ animated: true });
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
          cancelAutoFocusAnimation();
          if (applyFocusFromSurface({ force: true, animated: false })) return;
        }

        applyViewport(viewport);
      });
      resizeObserver.observe(surface);

      const overlayObserver = new MutationObserver(() => {
        applyViewport(viewport);
      });
      overlayObserver.observe(surface, { childList: true, subtree: true });

      if (!applyFocusFromSurface({ force: true, animated: false })) {
        applyViewport(viewport);
      }

      detachSurface = () => {
        cancelAutoFocusAnimation();
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
