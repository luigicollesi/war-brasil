"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { HomeDestinationId } from "./command-home-scene-intent";
import styles from "./command-home-guide.module.css";

export type HomeGuideStep = Readonly<{
  id: HomeDestinationId;
  index: string;
  title: string;
  body: string;
}>;

export const HOME_GUIDE_STEPS = [
  {
    id: "operations",
    index: "01",
    title: "OPERAÇÕES",
    body: "É aqui que você encontra uma partida ou inicia uma nova operação.",
  },
  {
    id: "doctrine",
    index: "02",
    title: "DOUTRINA",
    body: "Aqui ficam as regras do jogo. Consulte a Doutrina sempre que quiser revisar como uma partida funciona.",
  },
  {
    id: "profile",
    index: "03",
    title: "COMANDO",
    body: "Aqui fica seu Dossiê e Arsenal. Veja seu perfil, equipe seus cosméticos e acesse a Intendência para adquirir novos itens.",
  },
  {
    id: "campaign",
    index: "04",
    title: "CAMPANHA",
    body: "Aqui você acompanha o Passe de Campanha da temporada, seu nível, XP e as recompensas disponíveis.",
  },
] as const satisfies readonly HomeGuideStep[];

type SpotlightGeometry = Readonly<{
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}>;

type CommandHomeGuideProps = {
  open: boolean;
  stepIndex: number;
  homeRootRef: RefObject<HTMLElement | null>;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  getTarget: (id: HomeDestinationId) => HTMLElement | null;
  onStepChange: (stepIndex: number) => void;
  onClose: () => void;
};

const SPOTLIGHT_PADDING = 10;
const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 22;
const PANEL_SPACE_THRESHOLD = 250;

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function CommandHomeGuide({
  open,
  stepIndex,
  homeRootRef,
  returnFocusRef,
  getTarget,
  onStepChange,
  onClose,
}: CommandHomeGuideProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightGeometry | null>(null);
  const step = HOME_GUIDE_STEPS[stepIndex] ?? HOME_GUIDE_STEPS[0];

  const measureTarget = useCallback(() => {
    const target = getTarget(step.id);
    if (!target) {
      onClose();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      onClose();
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(viewportWidth - VIEWPORT_MARGIN, rect.left - SPOTLIGHT_PADDING),
    );
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(viewportHeight - VIEWPORT_MARGIN, rect.top - SPOTLIGHT_PADDING),
    );
    const right = Math.max(
      left,
      Math.min(
        viewportWidth - VIEWPORT_MARGIN,
        rect.right + SPOTLIGHT_PADDING,
      ),
    );
    const bottom = Math.max(
      top,
      Math.min(
        viewportHeight - VIEWPORT_MARGIN,
        rect.bottom + SPOTLIGHT_PADDING,
      ),
    );

    if (right <= left || bottom <= top) {
      onClose();
      return;
    }

    setSpotlight({
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      viewportWidth,
      viewportHeight,
    });
  }, [getTarget, onClose, step.id]);

  useEffect(() => {
    if (!open) return;

    const homeRoot = homeRootRef.current;
    const hadInert = homeRoot?.hasAttribute("inert") ?? false;
    homeRoot?.setAttribute("inert", "");

    return () => {
      if (homeRoot && !hadInert) {
        homeRoot.removeAttribute("inert");
      }

      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus();
      });
    };
  }, [homeRootRef, open, returnFocusRef]);

  useEffect(() => {
    if (!open) {
      setSpotlight(null);
      return;
    }

    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureTarget);
    };

    scheduleMeasure();

    const target = getTarget(step.id);
    const observer =
      target && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    if (target) observer?.observe(target);

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
    };
  }, [getTarget, measureTarget, open, step.id]);

  useEffect(() => {
    if (!open || !spotlight) return;

    const frame = window.requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, spotlight, stepIndex]);

  const handleDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = focusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      titleRef.current?.focus();
      return;
    }

    const active = document.activeElement;
    const currentIndex = focusable.indexOf(active as HTMLElement);

    if (currentIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
      return;
    }

    if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
      return;
    }

    if (event.shiftKey && currentIndex === 0) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    }
  };

  if (!open || !spotlight || typeof document === "undefined") {
    return null;
  }

  const aboveSpace = spotlight.top;
  const belowSpace = spotlight.viewportHeight - spotlight.bottom;
  const placement =
    aboveSpace >= PANEL_SPACE_THRESHOLD || aboveSpace >= belowSpace
      ? "above"
      : "below";

  const dialogStyle: CSSProperties =
    placement === "above"
      ? {
          bottom: Math.max(
            16,
            spotlight.viewportHeight - spotlight.top + PANEL_GAP,
          ),
        }
      : {
          top: Math.max(16, spotlight.bottom + PANEL_GAP),
        };

  return createPortal(
    <div
      className={styles.portal}
      data-home-guide
      data-guide-step={step.id}
      data-guide-placement={placement}
    >
      <div
        className={styles.maskPanel}
        aria-hidden="true"
        style={{ top: 0, left: 0, right: 0, height: spotlight.top }}
      />
      <div
        className={styles.maskPanel}
        aria-hidden="true"
        style={{
          top: spotlight.bottom,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />
      <div
        className={styles.maskPanel}
        aria-hidden="true"
        style={{
          top: spotlight.top,
          left: 0,
          width: spotlight.left,
          height: spotlight.height,
        }}
      />
      <div
        className={styles.maskPanel}
        aria-hidden="true"
        style={{
          top: spotlight.top,
          right: 0,
          width: spotlight.viewportWidth - spotlight.right,
          height: spotlight.height,
        }}
      />

      <div
        className={styles.spotlightFrame}
        aria-hidden="true"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      <section
        ref={dialogRef}
        className={styles.dialog}
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-guide-title"
        aria-describedby="home-guide-description"
        onKeyDown={handleDialogKeyDown}
      >
        <header className={styles.header}>
          <span className={styles.stepIndex} aria-hidden="true">
            {step.index} / 04
          </span>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Fechar guia da tela inicial"
            onClick={onClose}
          >
            FECHAR
          </button>
        </header>

        <h2
          ref={titleRef}
          id="home-guide-title"
          className={styles.title}
          tabIndex={-1}
        >
          {step.title}
        </h2>
        <p id="home-guide-description" className={styles.body}>
          {step.body}
        </p>

        <div className={styles.actions}>
          {stepIndex > 0 ? (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => onStepChange(stepIndex - 1)}
            >
              ← ANTERIOR
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          {stepIndex < HOME_GUIDE_STEPS.length - 1 ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => onStepChange(stepIndex + 1)}
            >
              PRÓXIMO →
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onClose}
            >
              ENTENDI
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
