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
        <span>{balancedDiceEnabled ? "SORTE BALANCEADA" : "ALEATÓRIO"}</span>
      </div>

      {canManageRoom ? (
        <button
          type="button"
          className={styles.trigger}
          aria-label="Configurações da sala"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={styles.gear} aria-hidden="true">⌘</span>
          <span className={styles.triggerText}>Configurar</span>
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
            <div>
              <p className={styles.eyebrow}>PROTOCOLO DE OPERAÇÃO</p>
              <h2>Configurações da sala</h2>
            </div>
            <span className={styles.authority}>HOST</span>
          </div>

          <fieldset className={styles.fieldset} disabled={pending}>
            <legend>Modo de vitória</legend>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={ruleset === "objective"}
                data-active={ruleset === "objective"}
                onClick={() => onChange({ ruleset: "objective" })}
              >
                <strong>Objetivo</strong>
                <small>Missão estratégica individual</small>
              </button>
              <button
                type="button"
                aria-pressed={ruleset === "supremacy"}
                data-active={ruleset === "supremacy"}
                onClick={() => onChange({ ruleset: "supremacy" })}
              >
                <strong>Supremacia</strong>
                <small>Domínio total do território</small>
              </button>
            </div>
          </fieldset>

          <div className={styles.balanceRow}>
            <div>
              <span className={styles.balanceTitle}>Sorte balanceada</span>
              <small>
                {balancedDiceEnabled
                  ? "Correção adaptativa ativa"
                  : "Probabilidade uniforme por face"}
              </small>
            </div>
            <button
              type="button"
              className={styles.switch}
              role="switch"
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

          <p className={styles.notice}>
            Alterar uma regra revoga a prontidão dos jogadores humanos.
          </p>
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
