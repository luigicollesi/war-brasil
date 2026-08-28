"use client";

import { useEffect, useRef, useState } from "react";

type TerritoryLabel = {
  name: string;
  mode: "hover" | "touch";
  x: number;
  y: number;
};

const TOUCH_LABEL_DURATION_MS = 5_000;
const DESKTOP_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function findTerritory(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<SVGPathElement>(".territory[data-name]");
}

export function HomeTerritoryMap() {
  const objectRef = useRef<HTMLObjectElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [label, setLabel] = useState<TerritoryLabel | null>(null);

  useEffect(() => {
    const object = objectRef.current;
    if (!object) return;

    let detachSvg = () => {};

    const clearDismissTimer = () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };

    const bindSvg = () => {
      detachSvg();

      const root = object.contentDocument?.documentElement;
      if (!(root instanceof SVGSVGElement)) return;

      const isDesktopPointer = () => window.matchMedia(DESKTOP_POINTER_QUERY).matches;

      const showHoverLabel = (event: PointerEvent) => {
        if (!isDesktopPointer()) return;

        const territory = findTerritory(event.target);
        const name = territory?.dataset.name;
        if (!name) {
          setLabel(null);
          return;
        }

        clearDismissTimer();
        setLabel({
          name,
          mode: "hover",
          x: event.clientX,
          y: event.clientY,
        });
      };

      const hideHoverLabel = () => {
        if (!isDesktopPointer()) return;
        setLabel(null);
      };

      const showTouchLabel = (event: MouseEvent) => {
        if (isDesktopPointer()) return;

        const territory = findTerritory(event.target);
        const name = territory?.dataset.name;
        if (!name) return;

        clearDismissTimer();
        setLabel({ name, mode: "touch", x: 0, y: 0 });
        dismissTimerRef.current = setTimeout(() => {
          setLabel(null);
          dismissTimerRef.current = null;
        }, TOUCH_LABEL_DURATION_MS);
      };

      root.addEventListener("pointermove", showHoverLabel);
      root.addEventListener("pointerleave", hideHoverLabel);
      root.addEventListener("click", showTouchLabel);

      detachSvg = () => {
        root.removeEventListener("pointermove", showHoverLabel);
        root.removeEventListener("pointerleave", hideHoverLabel);
        root.removeEventListener("click", showTouchLabel);
      };
    };

    object.addEventListener("load", bindSvg);
    bindSvg();

    return () => {
      object.removeEventListener("load", bindSvg);
      detachSvg();
      clearDismissTimer();
    };
  }, []);

  return (
    <div id="mapa" className="wb-home-map" aria-label="Prévia interativa do mapa do jogo">
      <object
        ref={objectRef}
        className="wb-home-map-object"
        data="/war-brasil-42.production.svg"
        type="image/svg+xml"
        aria-label="Mapa do Brasil dividido em 42 territórios"
      >
        Mapa do Brasil dividido em 42 territórios
      </object>

      {label ? (
        <div
          className="wb-home-territory-label"
          data-mode={label.mode}
          role="status"
          aria-live="polite"
          style={
            label.mode === "hover"
              ? { left: `${label.x}px`, top: `${label.y}px` }
              : undefined
          }
        >
          {label.name}
        </div>
      ) : null}
    </div>
  );
}
