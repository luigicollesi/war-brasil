"use client";

import Image from "next/image";
import { KeyboardEvent, useRef, useState } from "react";
import { CreateRoomButton } from "@/src/components/create-room-button";
import { JoinRoomForm } from "@/src/components/join-room-form";
import styles from "@/src/app/matchmaking/operations.module.css";

type Mode = "create" | "join";
type OperationStatus = "idle" | "pending" | "error" | "success";

const MODES: Array<{ mode: Mode; index: string; label: string; summary: string }> = [
  {
    mode: "create",
    index: "01",
    label: "Nova operação",
    summary: "Autorizar sala",
  },
  {
    mode: "join",
    index: "02",
    label: "Localizar operação",
    summary: "Usar código",
  },
];

function statusLabel(status: OperationStatus) {
  if (status === "pending") return "Comando em processamento";
  if (status === "error") return "Ação interrompida — revisão necessária";
  if (status === "success") return "Operação autorizada";
  return "Estação disponível";
}

export function OperationsConsole() {
  const [mode, setMode] = useState<Mode>("create");
  const [createStatus, setCreateStatus] = useState<OperationStatus>("idle");
  const [joinStatus, setJoinStatus] = useState<OperationStatus>("idle");
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const activeStatus = mode === "create" ? createStatus : joinStatus;
  const commandLocked = createStatus === "pending" || joinStatus === "pending";

  function selectMode(nextMode: Mode, focus = false) {
    if (commandLocked && nextMode !== mode) return;

    setMode(nextMode);
    if (focus) {
      const index = MODES.findIndex((item) => item.mode === nextMode);
      tabsRef.current[index]?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % MODES.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + MODES.length) % MODES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = MODES.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectMode(MODES[nextIndex].mode, true);
  }

  return (
    <section
      className={styles.station}
      data-mode={mode}
      data-status={activeStatus}
      aria-labelledby="operations-station-title"
    >
      <div className={styles.stationTopline}>
        <div>
          <p className={styles.machineCode}>MESA-01 · SETOR OPERACIONAL</p>
          <h2 id="operations-station-title" className={styles.machineTitle}>
            Mesa de autorização
          </h2>
        </div>
        <div className={styles.systemState} aria-hidden="true">
          <span className={styles.systemLamp} />
          circuito pronto
        </div>
      </div>

      <div className={styles.machineBody}>
        <div className={styles.mapBay} aria-hidden="true">
          <div className={styles.crown}>
            <span className={`${styles.ring} ${styles.ringTerritory}`} />
            <span className={`${styles.ring} ${styles.ringCommand}`} />
            <span className={`${styles.ring} ${styles.ringConflict}`} />
          </div>
          <div className={styles.mapPlate}>
            <Image
              src="/war-brasil-42.production.svg"
              alt=""
              fill
              sizes="(max-width: 820px) 58vw, 36vw"
              priority={false}
            />
          </div>
          <div className={styles.axisVertical} />
          <div className={styles.axisHorizontal} />
          <div className={styles.mapReadout}>
            <span>42 placas</span>
            <span>geometria canônica</span>
          </div>
        </div>

        <div className={styles.commandBay}>
          <div className={styles.commandHeading}>
            <p className={styles.commandEyebrow}>Selecione o protocolo de entrada</p>
            <p className={styles.commandSequence}>AUTORIZAÇÃO // 01—02</p>
          </div>

          <div className={styles.modeRail} role="tablist" aria-label="Modo de operação">
            {MODES.map((item, index) => {
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
                  className={`${styles.modeTab} disabled:cursor-not-allowed disabled:opacity-40`}
                  onClick={() => selectMode(item.mode)}
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
              hidden={mode !== "create"}
              className={styles.modePanel}
            >
              <div className={styles.orderNumber}>PROTOCOLO 01</div>
              <h3>Autorizar nova operação</h3>
              <p>
                Abra uma sala, assuma o posto de anfitrião e reúna os demais
                comandantes antes da distribuição territorial.
              </p>
              <dl className={styles.telemetry}>
                <div>
                  <dt>Capacidade</dt>
                  <dd>2–6 jogadores</dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>Lobby de preparação</dd>
                </div>
              </dl>
              <CreateRoomButton onStatusChange={setCreateStatus} />
            </section>

            <section
              id="operations-join-panel"
              role="tabpanel"
              aria-labelledby="operations-join-tab"
              hidden={mode !== "join"}
              className={styles.modePanel}
            >
              <div className={styles.orderNumber}>PROTOCOLO 02</div>
              <h3>Localizar operação existente</h3>
              <p>
                Informe o identificador transmitido pelo anfitrião. A entrada
                usa o mesmo código da sala e mantém sua digitação em caso de erro.
              </p>
              <JoinRoomForm onStatusChange={setJoinStatus} />
            </section>
          </div>

          <div className={styles.stationStatus} role="status" aria-live="polite">
            <span className={styles.statusLamp} aria-hidden="true" />
            <span>{statusLabel(activeStatus)}</span>
            <span className={styles.statusMode}>
              {mode === "create" ? "PROTOCOLO 01" : "PROTOCOLO 02"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
