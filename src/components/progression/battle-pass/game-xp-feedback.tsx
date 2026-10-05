"use client";

import { createPortal } from "react-dom";
import type { BattlePassGameXpEvent } from "@/src/lib/shared/progression/battle-pass-game-xp-event";
import styles from "./game-xp-feedback.module.css";

export function GameXpFeedback({
  event,
  announcement,
}: {
  event: BattlePassGameXpEvent | null;
  announcement: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.root}>
      {event ? (
        <div className={styles.positioner} aria-hidden="true">
          <div
            key={event.id}
            className={styles.notice}
            data-intensity={event.intensity}
          >
            <span className={styles.eyebrow}>{event.label}</span>
            <strong className={styles.amount}>
              {event.kind === "match_settled" ? "" : "+"}
              {event.xp} XP
            </strong>
            {event.detail ? (
              <span className={styles.detail}>{event.detail}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={styles.liveRegion}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>,
    document.body,
  );
}
