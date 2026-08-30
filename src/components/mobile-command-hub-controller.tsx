"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const COLLAPSED_HEIGHT_PX = 72;
const MAX_EXPANDED_VIEWPORT_RATIO = 0.42;
const DRAG_DISTANCE_THRESHOLD_PX = 36;
const DRAG_VELOCITY_THRESHOLD = 0.35;
const CLICK_SUPPRESSION_MS = 300;

type DragState = {
  pointerId: number;
  startY: number;
  startHeight: number;
  startedAt: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function MobileCommandHubController() {
  useEffect(() => {
    let currentHub: HTMLElement | null = null;
    let detachHub = () => {};

    const attachHub = (hub: HTMLElement) => {
      detachHub();
      currentHub = hub;

      const screen = hub.closest<HTMLElement>(".game-screen");
      if (!screen) return;

      const media = window.matchMedia(MOBILE_QUERY);
      let expanded = true;
      let dragging = false;
      let currentHeight = COLLAPSED_HEIGHT_PX;
      let expandedHeight = COLLAPSED_HEIGHT_PX;
      let drag: DragState | null = null;
      let measureFrame: number | null = null;
      let suppressClickUntil = 0;

      hub.classList.add("game-command-hub");
      hub.dataset.open = "true";
      hub.dataset.dragging = "false";

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "mobile-command-hub-handle";
      handle.setAttribute("aria-label", "Recolher painel de ações");
      handle.setAttribute("aria-expanded", "true");
      handle.innerHTML = '<span aria-hidden="true"></span>';
      screen.append(handle);

      const setVisibleHeight = (value: number) => {
        currentHeight = clamp(value, COLLAPSED_HEIGHT_PX, expandedHeight);
        screen.style.setProperty(
          "--game-command-visible-height",
          `${currentHeight}px`,
        );
      };

      const settle = (nextExpanded: boolean) => {
        expanded = nextExpanded;
        hub.dataset.open = expanded ? "true" : "false";
        handle.setAttribute("aria-expanded", expanded ? "true" : "false");
        handle.setAttribute(
          "aria-label",
          expanded ? "Recolher painel de ações" : "Mostrar painel de ações",
        );
        setVisibleHeight(expanded ? expandedHeight : COLLAPSED_HEIGHT_PX);
      };

      const measure = () => {
        measureFrame = null;
        if (!media.matches) {
          screen.style.removeProperty("--game-command-visible-height");
          return;
        }

        const maximumHeight = Math.max(
          COLLAPSED_HEIGHT_PX,
          Math.floor(window.innerHeight * MAX_EXPANDED_VIEWPORT_RATIO),
        );
        expandedHeight = clamp(
          Math.ceil(hub.scrollHeight),
          COLLAPSED_HEIGHT_PX,
          maximumHeight,
        );

        if (!dragging) {
          setVisibleHeight(expanded ? expandedHeight : COLLAPSED_HEIGHT_PX);
        }
      };

      const scheduleMeasure = () => {
        if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
        measureFrame = window.requestAnimationFrame(measure);
      };

      const startDrag = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (!media.matches) return;

        handle.setPointerCapture(event.pointerId);
        drag = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startHeight: currentHeight,
          startedAt: performance.now(),
        };
        dragging = true;
        hub.dataset.dragging = "true";
        screen.dataset.mobileCommandDragging = "true";
      };

      const moveDrag = (event: PointerEvent) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();

        const deltaUp = drag.startY - event.clientY;
        setVisibleHeight(drag.startHeight + deltaUp);
      };

      const finishDrag = (event: PointerEvent, cancelled = false) => {
        if (!drag || drag.pointerId !== event.pointerId) return;

        if (handle.hasPointerCapture(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }

        const finishedDrag = drag;
        drag = null;
        dragging = false;
        hub.dataset.dragging = "false";
        delete screen.dataset.mobileCommandDragging;

        if (cancelled) {
          settle(expanded);
          return;
        }

        const delta = currentHeight - finishedDrag.startHeight;
        const elapsed = Math.max(1, performance.now() - finishedDrag.startedAt);
        const velocity = delta / elapsed;
        const decisiveDistance = Math.abs(delta) >= DRAG_DISTANCE_THRESHOLD_PX;
        const decisiveVelocity = Math.abs(velocity) >= DRAG_VELOCITY_THRESHOLD;
        const nextExpanded =
          decisiveDistance || decisiveVelocity
            ? delta > 0
            : currentHeight > (COLLAPSED_HEIGHT_PX + expandedHeight) / 2;

        if (Math.abs(delta) > 4) {
          suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
        }
        settle(nextExpanded);
      };

      const onClick = (event: MouseEvent) => {
        if (!media.matches) return;
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          return;
        }
        settle(!expanded);
      };

      const onMediaChange = () => {
        if (!media.matches) {
          screen.style.removeProperty("--game-command-visible-height");
          delete screen.dataset.mobileCommandDragging;
          return;
        }
        scheduleMeasure();
      };

      const mutationObserver = new MutationObserver(scheduleMeasure);
      mutationObserver.observe(hub, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      handle.addEventListener("pointerdown", startDrag);
      handle.addEventListener("pointermove", moveDrag);
      handle.addEventListener("pointerup", finishDrag);
      handle.addEventListener("pointercancel", (event) => finishDrag(event, true));
      handle.addEventListener("click", onClick);
      media.addEventListener("change", onMediaChange);
      window.addEventListener("resize", scheduleMeasure);
      scheduleMeasure();

      detachHub = () => {
        if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
        mutationObserver.disconnect();
        handle.removeEventListener("pointerdown", startDrag);
        handle.removeEventListener("pointermove", moveDrag);
        handle.removeEventListener("pointerup", finishDrag);
        handle.removeEventListener("click", onClick);
        media.removeEventListener("change", onMediaChange);
        window.removeEventListener("resize", scheduleMeasure);
        handle.remove();
        hub.classList.remove("game-command-hub");
        delete hub.dataset.open;
        delete hub.dataset.dragging;
        delete screen.dataset.mobileCommandDragging;
        screen.style.removeProperty("--game-command-visible-height");
      };
    };

    const locateHub = () => {
      const nextHub = document.querySelector<HTMLElement>(
        ".game-map-canvas + section",
      );
      if (nextHub === currentHub) return;

      if (!nextHub) {
        detachHub();
        currentHub = null;
        return;
      }

      attachHub(nextHub);
    };

    locateHub();
    const rootObserver = new MutationObserver(locateHub);
    rootObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      rootObserver.disconnect();
      detachHub();
    };
  }, []);

  return null;
}
