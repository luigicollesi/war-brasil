"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LobbyCommandWorkspace } from "@/src/components/lobby-command-workspace";
import { PreGameBackButton } from "@/src/components/pre-game-back-button";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import { useLobbySync } from "@/src/hooks/use-lobby-sync";
import type { GameRuleset } from "@/src/lib/game-mode";
import styles from "./lobby-client-state.module.css";

type LobbyClientProps = {
  code: string;
};

type RoomUpdateResponse = {
  room?: {
    id?: string;
    status?: "waiting" | "order_roll" | "playing";
  };
  error?: string;
};

type BotActionResponse = {
  error?: string;
};

type LobbyPendingAction =
  | "profile"
  | "ready"
  | "settings"
  | "add-bot"
  | `remove-bot:${string}`
  | null;

type LobbyActionError = {
  scope: "profile" | "ready" | "settings" | "bot" | "copy";
  message: string;
} | null;

export function LobbyClient({ code }: LobbyClientProps) {
  const router = useRouter();
  const { snapshot, error: syncError, isLoading, refresh } = useLobbySync(code);
  const [actionError, setActionError] = useState<LobbyActionError>(null);
  const [pendingAction, setPendingAction] = useState<LobbyPendingAction>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const sceneReadyPlayers = snapshot?.players.filter((player) => player.isReady).length ?? 0;
  const sceneAllReady = Boolean(
    snapshot && snapshot.players.length >= 2 && sceneReadyPlayers === snapshot.players.length,
  );
  const sceneStartAuthorized = Boolean(snapshot && snapshot.room.status !== "waiting");

  useCommandSceneDirective(
    {
      focus: "table",
      conflictLevel: sceneStartAuthorized ? 3 : sceneAllReady ? 1 : 0,
      orbitalAlignment: sceneStartAuthorized ? 1 : 0,
    },
    Boolean(snapshot),
  );

  useEffect(() => {
    if (snapshot && snapshot.room.status !== "waiting") {
      router.replace(`/game/${snapshot.room.id}`);
    }
  }, [router, snapshot]);
  useEffect(() => {
    if (!snapshot || snapshot.room.status !== "waiting") return;

    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      await fetch(
        `/api/rooms/${encodeURIComponent(code)}/heartbeat`,
        { method: "POST", cache: "no-store" },
      ).catch(() => undefined);
    };

    void heartbeat();
    const intervalId = window.setInterval(() => {
      void heartbeat();
    }, 20_000);

    const onFocus = () => void heartbeat();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, snapshot?.room.status]);


  async function updateMe(
    patch: Record<string, unknown>,
    action: "profile" | "ready" = "profile",
  ) {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction(action);

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/me`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as RoomUpdateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar suas escolhas.");
      }

      if (data.room?.status !== "waiting" && data.room?.id) {
        router.replace(`/game/${data.room.id}`);
        return;
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: action,
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível salvar suas escolhas.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function updateSettings(patch: {
    ruleset?: GameRuleset;
    balancedDiceEnabled?: boolean;
  }) {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction("settings");

    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/settings`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const data = (await response.json()) as RoomUpdateResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Não foi possível atualizar as configurações da sala.",
        );
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "settings",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível atualizar as configurações da sala.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function addBot() {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction("add-bot");

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/bots`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as BotActionResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível adicionar o bot.");
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "bot",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível adicionar o bot.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function removeBot(botId: string) {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction(`remove-bot:${botId}`);

    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/bots/${encodeURIComponent(botId)}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as BotActionResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível remover o bot.");
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "bot",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível remover o bot.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function leaveRoom() {
    if (leaving || pendingAction !== null) return;
    setLeaving(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/me`,
        { method: "DELETE", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Não foi possível sair da sala.");
      }
      router.replace("/matchmaking");
    } catch (error) {
      setActionError({
        scope: "profile",
        message:
          error instanceof Error ? error.message : "Não foi possível sair da sala.",
      });
      setLeaving(false);
    }
  }

  async function copyRoomCode() {
    setActionError(null);

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API indisponível");
      }

      await navigator.clipboard.writeText(code.toUpperCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setActionError({
        scope: "copy",
        message: "Cópia automática indisponível. Selecione o código acima e copie manualmente.",
      });
    }
  }

  function saveFaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void updateMe({ factionName: formData.get("factionName") });
  }

  if (isLoading && !snapshot) {
    return (
      <div className={styles.statePage}>
        <div className={styles.stateNavigation}>
          <PreGameBackButton href="/matchmaking" />
        </div>
        <div className={styles.loadingState} aria-live="polite" aria-busy="true">
          <div className={styles.stateMachine}>
            <div className={styles.stateGlyph} aria-hidden="true" />
            <p className="wb-kicker">Canal de comando</p>
            <h1 className={styles.stateTitle}>Estabelecendo briefing</h1>
            <p className={styles.stateText}>
              Sincronizando a sala, os postos de comando e o estado de preparação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className={styles.statePage}>
        <div className={styles.stateNavigation}>
          <PreGameBackButton href="/matchmaking" />
        </div>
        <div className={styles.fatalState}>
          <div className={styles.stateMachine}>
            <div className={styles.stateGlyph} aria-hidden="true" />
            <p className="wb-kicker">Canal indisponível</p>
            <h1 className={styles.stateTitle}>Briefing interrompido</h1>
            <p className={styles.stateText} role="alert">
              {syncError || "Não foi possível encontrar esta sala."}
            </p>
            <button
              type="button"
              className={`wb-button wb-button--secondary ${styles.retryButton}`}
              onClick={() => void refresh()}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { me, players, room, canManageBots, canManageRoom } = snapshot;
  const readyPlayers = sceneReadyPlayers;
  const allReady = sceneAllReady;
  const actionPending = pendingAction !== null;
  const readyPending = pendingAction === "ready";
  const settingsPending = pendingAction === "settings";
  const roomCode = room.code.toUpperCase();
  const startAuthorized = sceneStartAuthorized;
  const copyError = actionError?.scope === "copy" ? actionError.message : null;
  const readyError = actionError?.scope === "ready" ? actionError.message : null;
  const settingsError =
    actionError?.scope === "settings" ? actionError.message : null;
  const consoleError =
    actionError?.scope === "profile" || actionError?.scope === "bot"
      ? actionError.message
      : null;
  const tableStatus = startAuthorized
    ? "CONFLITO AUTORIZADO"
    : allReady
      ? "Validação final de comando"
      : "Briefing em formação";

  return (
    <LobbyCommandWorkspace
      roomCode={roomCode}
      ruleset={room.ruleset}
      balancedDiceEnabled={room.balancedDiceEnabled}
      players={players}
      me={me}
      canManageBots={canManageBots}
      canManageRoom={canManageRoom}
      readyPlayers={readyPlayers}
      allReady={allReady}
      startAuthorized={startAuthorized}
      reconnecting={Boolean(syncError)}
      actionPending={actionPending}
      readyPending={readyPending}
      settingsPending={settingsPending}
      pendingAction={pendingAction}
      copied={copied}
      copyError={copyError}
      consoleError={consoleError}
      readyError={readyError}
      settingsError={settingsError}
      tableStatus={tableStatus}
      onCopyRoomCode={() => void copyRoomCode()}
      onRefresh={() => void refresh()}
      onSaveFaction={saveFaction}
      onColorChange={(color) => void updateMe({ color })}
      onUpdateSettings={(patch) => void updateSettings(patch)}
      onAddBot={() => void addBot()}
      onRemoveBot={removeBot}
      onToggleReady={() => void updateMe({ isReady: !me.isReady }, "ready")}
      onLeaveRoom={() => void leaveRoom()}
      leaving={leaving}
    />
  );
}
