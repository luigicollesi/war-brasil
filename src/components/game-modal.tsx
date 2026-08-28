"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

type GameModalTone = "default" | "barrier" | "event";

type GameModalProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  tone?: GameModalTone;
  className?: string;
  onClose?: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function GameModal({
  eyebrow,
  title,
  children,
  tone = "default",
  className = "",
  onClose,
}: GameModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    (focusable[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="game-modal-backdrop fixed inset-0 grid place-items-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`game-modal-surface game-modal--${tone} ${className}`}
      >
        {eyebrow ? <p className="game-modal-eyebrow">{eyebrow}</p> : null}
        <h3 id={titleId} className="text-xl font-semibold">
          {title}
        </h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}
