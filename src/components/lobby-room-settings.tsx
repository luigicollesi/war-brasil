"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GameRuleset } from "@/src/lib/game-mode";
import styles from "./lobby-room-settings.module.css";

type LobbyRoomSettingsProps = {
  ruleset: GameRuleset;
  balancedDiceEnabled: boolean;
  canManageRoom: boolean;
  pending: boolean;
  error: string | null;
  onChange: (patch: {
    ruleset?: GameRuleset;
    balancedDiceEnabled?: boolean;
  }) => void;
};

function rulesetLabel(ruleset: GameRuleset) {
  return ruleset === "supremacy" ? "SUPREMACIA" : "OBJETIVO";
}

function SettingsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 8.35a3.65 3.65 0 1 0 0 7.3 3.65 3.65 0 0 0 0-7.3Zm8.15 4.78v-2.26l-2.18-.76a6.63 6.63 0 0 0-.53-1.28l1-2.08-1.6-1.6-2.08 1a6.7 6.7 0 0 0-1.28-.53L12.72 3h-2.26l-.76 2.18c-.45.14-.88.32-1.28.53l-2.08-1-1.6 1.6 1 2.08c-.22.4-.4.83-.53 1.28L3 10.43v2.26l2.18.76c.14.45.32.88.53 1.28l-1 2.08 1.6 1.6 2.08-1c.4.22.83.4 1.28.53l.76 2.18h2.26l.76-2.18c.45-.14.88-.32 1.28-.53l2.08 1 1.6-1.6-1-2.08c.22-.4.4-.83.53-1.28l2.21-.62Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LobbyRoomSettings({
  ruleset,
  balancedDiceEnabled,
  canManageRoom,
  pending,
  error,
  onChange,
}: LobbyRoomSettingsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.summary} aria-label="Regras ativas da sala">
        <span>{rulesetLabel(ruleset)}</span>
        <span aria-hidden="true">·</span>
        <span>{balancedDiceEnabled ? "BALANCEADO" : "ALEATÓRIO"}</span>
      </div>

      {canManageRoom ? (
        <button
          type="button"
          className={styles.trigger}
          aria-label="Configurações da sala"
          aria-expanded={open}
          aria-controls={panelId}
          title="Configurações da sala"
          onClick={() => setOpen((current) => !current)}
        >
          <SettingsGlyph />
        </button>
      ) : null}

      {canManageRoom && open ? (
        <div
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-label="Configurações da sala"
        >
          <div className={styles.panelHeading}>
            <h2>Configuração</h2>
          </div>

          <fieldset className={styles.fieldset} disabled={pending}>
            <legend>Modo</legend>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={ruleset === "objective"}
                data-active={ruleset === "objective"}
                onClick={() => onChange({ ruleset: "objective" })}
              >
                Objetivo
              </button>
              <button
                type="button"
                aria-pressed={ruleset === "supremacy"}
                data-active={ruleset === "supremacy"}
                onClick={() => onChange({ ruleset: "supremacy" })}
              >
                Supremacia
              </button>
            </div>
          </fieldset>

          <div className={styles.balanceRow}>
            <span className={styles.balanceTitle}>Sorte balanceada</span>
            <button
              type="button"
              className={styles.switch}
              role="switch"
              aria-label="Sorte balanceada"
              aria-checked={balancedDiceEnabled}
              disabled={pending}
              data-checked={balancedDiceEnabled}
              onClick={() =>
                onChange({ balancedDiceEnabled: !balancedDiceEnabled })
              }
            >
              <span aria-hidden="true" className={styles.switchTrack}>
                <span className={styles.switchThumb} />
              </span>
              <strong>{balancedDiceEnabled ? "ON" : "OFF"}</strong>
            </button>
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
