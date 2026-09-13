"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { CreateRoomButton } from "@/src/components/create-room-button";
import { JoinRoomForm } from "@/src/components/join-room-form";
import {
  useCommandSceneDirective,
  type CommandSceneDirective,
} from "@/src/components/pre-game/foundation";
import type {
  OperationInteraction,
  OperationStatus,
} from "@/src/components/operations-types";
import styles from "@/src/app/matchmaking/operations.module.css";
import stateStyles from "@/src/app/matchmaking/operations-states.module.css";

type EntryMode = "create" | "join";
type VisualStatus = "idle" | "pending" | "error" | "success";

const ENTRY_MODES: Array<{
  mode: EntryMode;
  index: string;
  label: string;
  summary: string;
}> = [
  {
    mode: "create",
    index: "01",
    label: "Criar sala",
    summary: "Abrir operação",
  },
  {
    mode: "join",
    index: "02",
    label: "Entrar em sala",
    summary: "Usar código",
  },
];

function statusLabel(status: OperationStatus, interaction: OperationInteraction) {
  if (status === "creating") return "Criando sala personalizada";
  if (status === "joining") return "Localizando sala existente";
  if (status === "invalid-code") return "Código da sala inválido";
  if (status === "network-error") return "Falha de comunicação — tente novamente";
  if (status === "create-error") return "Sala não criada — retry disponível";
  if (status === "join-error") return "Sala não localizada — retry disponível";
  if (status === "success-transition") return "Acesso autorizado — abrindo lobby";
  if (interaction === "typing-code") return "Código em edição";
  if (interaction === "create-focus") return "Criar sala selecionado";
  if (interaction === "join-focus") return "Entrar em sala selecionado";
  return "Sala personalizada disponível";
}

function visualStatus(status: OperationStatus): VisualStatus {
  if (status === "creating" || status === "joining") return "pending";
  if (
    status === "invalid-code" ||
    status === "network-error" ||
    status === "create-error" ||
    status === "join-error"
  ) {
    return "error";
  }
  if (status === "success-transition") return "success";
  return "idle";
}

function sceneDirective(
  mode: EntryMode,
  status: OperationStatus,
): CommandSceneDirective {
  const visual = visualStatus(status);

  return {
    focus: "brazil",
    conflictLevel:
      visual === "error" || visual === "success"
        ? 2
        : visual === "pending"
          ? 1
          : 0,
    territoryExplode: mode === "join" ? 0.1 : 0.08,
    orbitalAlignment: visual === "success" ? 1 : 0,
  };
}

export function OperationsConsole() {
  const [mode, setMode] = useState<EntryMode>("create");
  const [interaction, setInteraction] = useState<OperationInteraction>("idle");
  const [createStatus, setCreateStatus] = useState<OperationStatus>("idle");
  const [joinStatus, setJoinStatus] = useState<OperationStatus>("idle");
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const activeStatus = mode === "create" ? createStatus : joinStatus;
  const commandLocked =
    createStatus === "creating" ||
    createStatus === "success-transition" ||
    joinStatus === "joining" ||
    joinStatus === "success-transition";

  useCommandSceneDirective(sceneDirective(mode, activeStatus));

  function selectMode(nextMode: EntryMode, focus = false) {
    if (commandLocked && nextMode !== mode) return;

    setMode(nextMode);
    setInteraction(nextMode === "create" ? "create-focus" : "join-focus");

    if (focus) {
      const index = ENTRY_MODES.findIndex((item) => item.mode === nextMode);
      tabsRef.current[index]?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % ENTRY_MODES.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + ENTRY_MODES.length) % ENTRY_MODES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = ENTRY_MODES.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectMode(ENTRY_MODES[nextIndex].mode, true);
  }

  return (
    <section
      className={`${styles.station} ${stateStyles.stationState}`}
      data-mode={mode}
      data-status={visualStatus(activeStatus)}
      data-state={activeStatus}
      data-interaction={interaction}
      aria-busy={activeStatus === "creating" || activeStatus === "joining"}
      aria-labelledby="operations-station-title"
    >
      <div className={styles.stationTopline}>
        <div>
          <p className={styles.machineCode}>MESA-01 · SELEÇÃO DE PARTIDA</p>
          <h2 id="operations-station-title" className={styles.machineTitle}>
            Protocolos de entrada
          </h2>
        </div>
        <div className={styles.systemState} aria-hidden="true">
          <span className={styles.systemLamp} />
          sistema operacional
        </div>
      </div>

      <div className={styles.machineBody}>
        <section
          className={styles.classicMode}
          data-game-mode="classic"
          aria-labelledby="classic-mode-title"
        >
          <div className={styles.modeHeader}>
            <span className={styles.gameModeIndex}>01</span>
            <span className={styles.lockedBadge}>Em breve</span>
          </div>

          <div className={styles.gameModeCopy}>
            <p className={styles.gameModeEyebrow}>Pareamento automático</p>
            <h3 id="classic-mode-title">Jogo clássico</h3>
            <p className={styles.classicDescription}>
              Entre em uma fila pública e encontre automaticamente outros
              comandantes para uma partida com regras clássicas.
            </p>
          </div>

          <button
            type="button"
            disabled
            className={styles.classicButton}
            aria-describedby="classic-mode-status"
          >
            <span>Encontrar partida</span>
            <small id="classic-mode-status">Indisponível</small>
          </button>
        </section>

        <section
          className={styles.customMode}
          data-game-mode="custom"
          aria-labelledby="custom-mode-title"
        >
          <header className={styles.customHeader}>
            <div>
              <div className={styles.customHeadingLine}>
                <span className={styles.gameModeIndex}>02</span>
                <span className={styles.activeBadge}>Disponível</span>
              </div>
              <p className={styles.gameModeEyebrow}>Controle da operação</p>
              <h3 id="custom-mode-title">Sala personalizada</h3>
            </div>
            <p className={styles.customDescription}>
              Crie sua própria sala ou use o código enviado por outro comandante.
            </p>
          </header>

          <div
            className={styles.modeRail}
            role="tablist"
            aria-label="Ação da sala personalizada"
            aria-orientation="horizontal"
          >
            {ENTRY_MODES.map((item, index) => {
              const selected = mode === item.mode;
              const tabId = `operations-${item.mode}-tab`;
              const panelId = `operations-${item.mode}-panel`;
              const disabled = commandLocked && !selected;

              return (
                <button
                  key={item.mode}
                  ref={(element) => {
                    tabsRef.current[index] = element;
                  }}
                  id={tabId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  disabled={disabled}
                  className={styles.modeTab}
                  onClick={() => selectMode(item.mode)}
                  onFocus={() => {
                    if (!commandLocked || selected) {
                      setInteraction(
                        item.mode === "create" ? "create-focus" : "join-focus",
                      );
                    }
                  }}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  <span className={styles.modeIndex}>{item.index}</span>
                  <span className={styles.modeCopy}>
                    <strong>{item.label}</strong>
                    <small>{item.summary}</small>
                  </span>
                  <span className={styles.modeLatch} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className={styles.panelStack}>
            <section
              id="operations-create-panel"
              role="tabpanel"
              aria-labelledby="operations-create-tab"
              tabIndex={0}
              hidden={mode !== "create"}
              className={styles.modePanel}
            >
              <div className={styles.orderNumber}>PROTOCOLO PERSONALIZADO // 01</div>
              <h4>Criar nova sala</h4>
              <p>
                Abra uma operação para 2–6 jogadores e siga direto para o lobby
                de preparação.
              </p>
              <CreateRoomButton
                onStatusChange={setCreateStatus}
                onInteractionChange={setInteraction}
              />
            </section>

            <section
              id="operations-join-panel"
              role="tabpanel"
              aria-labelledby="operations-join-tab"
              tabIndex={0}
              hidden={mode !== "join"}
              className={styles.modePanel}
            >
              <div className={styles.orderNumber}>PROTOCOLO PERSONALIZADO // 02</div>
              <h4>Entrar com código</h4>
              <p>
                Cole ou digite o identificador compartilhado pelo anfitrião.
              </p>
              <JoinRoomForm
                onStatusChange={setJoinStatus}
                onInteractionChange={setInteraction}
              />
            </section>
          </div>

          <div
            className={styles.stationStatus}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.statusLamp} aria-hidden="true" />
            <span>{statusLabel(activeStatus, interaction)}</span>
            <span className={styles.statusMode}>
              {mode === "create" ? "CRIAR SALA" : "ENTRAR EM SALA"}
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}
