"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import type { GameCard } from "@/src/lib/game-contract";
import { TERRITORY_METADATA } from "@/src/lib/game-config";

const MOBILE_QUERY = "(max-width: 767px)";
const CLOSED_PEEK_PX = 16;
const DRAG_DISTANCE_THRESHOLD_PX = 36;
const DRAG_VELOCITY_THRESHOLD = 0.35;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cardLabel(card: GameCard) {
  if (card.symbol === "wild" || card.territoryId === null) return "Coringa";
  return TERRITORY_METADATA[card.territoryId]?.name ?? `Território ${card.territoryId}`;
}

type DragState = {
  pointerId: number;
  startY: number;
  startHeight: number;
  startedAt: number;
};

export function MobileCardHandDrawer({
  cards,
}: {
  cards: readonly GameCard[];
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const currentHeightRef = useRef(0);
  const openHeightRef = useRef(CLOSED_PEEK_PX);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hasCards = cards.length > 0;

  function screenElement() {
    return layerRef.current?.closest<HTMLElement>(".game-screen") ?? null;
  }

  const setVisibleHeight = useCallback((value: number) => {
    const screen = layerRef.current?.closest<HTMLElement>(".game-screen") ?? null;
    if (!screen) return;
    currentHeightRef.current = value;
    screen.style.setProperty("--game-hand-visible-height", `${value}px`);
  }, []);

  function settle(nextExpanded: boolean) {
    const nextHeight = nextExpanded ? openHeightRef.current : hasCards ? CLOSED_PEEK_PX : 0;
    setExpanded(nextExpanded && hasCards);
    setVisibleHeight(nextHeight);
  }

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const screen = layer.closest<HTMLElement>(".game-screen");
    if (!screen) return;
    const media = window.matchMedia(MOBILE_QUERY);

    function measure() {
      if (!media.matches) {
        screen.style.removeProperty("--game-hand-visible-height");
        screen.style.removeProperty("--game-command-closed-height");
        return;
      }

      const commandDeck = screen.querySelector<HTMLElement>(".game-map-canvas + section");
      const trackHeight = hasCards
        ? Math.ceil(trackRef.current?.getBoundingClientRect().height ?? CLOSED_PEEK_PX)
        : 0;
      openHeightRef.current = Math.max(CLOSED_PEEK_PX, trackHeight);

      const deckHeight = Math.ceil(commandDeck?.getBoundingClientRect().height ?? 0);
      screen.style.setProperty(
        "--game-command-closed-height",
        `${deckHeight + (hasCards ? CLOSED_PEEK_PX : 0)}px`,
      );

      const nextHeight = hasCards
        ? expanded
          ? openHeightRef.current
          : CLOSED_PEEK_PX
        : 0;
      setVisibleHeight(nextHeight);
    }

    const observer = new ResizeObserver(() => window.requestAnimationFrame(measure));
    const commandDeck = screen.querySelector<HTMLElement>(".game-map-canvas + section");
    if (commandDeck) observer.observe(commandDeck);
    if (trackRef.current) observer.observe(trackRef.current);
    media.addEventListener("change", measure);
    const frame = window.requestAnimationFrame(measure);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
      window.cancelAnimationFrame(frame);
      screen.style.removeProperty("--game-hand-visible-height");
      screen.style.removeProperty("--game-command-closed-height");
      delete screen.dataset.mobileHandDragging;
    };
  }, [expanded, hasCards, cards.length, setVisibleHeight]);

  useEffect(() => {
    if (hasCards) return;
    queueMicrotask(() => setExpanded(false));
  }, [hasCards]);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!hasCards || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: currentHeightRef.current,
      startedAt: performance.now(),
    };
    const screen = screenElement();
    if (screen) screen.dataset.mobileHandDragging = "true";
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaUp = drag.startY - event.clientY;
    const next = clamp(
      drag.startHeight + deltaUp,
      CLOSED_PEEK_PX,
      openHeightRef.current,
    );
    setVisibleHeight(next);
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    const screen = screenElement();
    if (screen) delete screen.dataset.mobileHandDragging;
    setDragging(false);

    if (cancelled) {
      settle(expanded);
      return;
    }

    const delta = currentHeightRef.current - drag.startHeight;
    const elapsed = Math.max(1, performance.now() - drag.startedAt);
    const velocity = delta / elapsed;
    const decisiveDistance = Math.abs(delta) >= DRAG_DISTANCE_THRESHOLD_PX;
    const decisiveVelocity = Math.abs(velocity) >= DRAG_VELOCITY_THRESHOLD;
    const nextExpanded =
      decisiveDistance || decisiveVelocity
        ? delta > 0
        : currentHeightRef.current > (CLOSED_PEEK_PX + openHeightRef.current) / 2;
    settle(nextExpanded);
  }

  function toggle() {
    if (!hasCards || dragging) return;
    settle(!expanded);
  }

  return (
    <div
      ref={layerRef}
      className="mobile-card-hand-layer"
      data-open={expanded ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      data-has-cards={hasCards ? "true" : "false"}
      aria-hidden={!hasCards}
    >
      {hasCards ? (
        <>
          <button
            type="button"
            className="mobile-card-hand-handle"
            aria-expanded={expanded}
            aria-controls="mobile-player-card-hand"
            aria-label={expanded ? "Recolher suas cartas" : "Mostrar suas cartas"}
            onClick={toggle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => finishDrag(event)}
            onPointerCancel={(event) => finishDrag(event, true)}
          >
            <span aria-hidden="true" />
          </button>

          <div className="mobile-card-hand-viewport" id="mobile-player-card-hand">
            <ul
              ref={trackRef}
              className="mobile-card-hand-track"
              aria-label={`Sua mão: ${cards.length} ${cards.length === 1 ? "carta" : "cartas"}`}
            >
              {cards.map((card) => (
                <li key={card.id} className="mobile-card-hand-card">
                  <TerritoryCardArtwork
                    territoryId={card.territoryId}
                    symbol={card.symbol}
                    loading="eager"
                    className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#f9f4df]"
                  />
                  <span className="sr-only">{cardLabel(card)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
