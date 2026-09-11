"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchOperationsRequest,
  OperationsRequestError,
} from "@/src/lib/client/operations/request";
import { normalizeOperationsRoomCode } from "@/src/lib/client/operations/room-code";
import type {
  OperationInteractionChange,
  OperationStatus,
  OperationStatusChange,
} from "@/src/components/operations-types";

type JoinRoomFormProps = {
  onStatusChange?: OperationStatusChange;
  onInteractionChange?: OperationInteractionChange;
};

export function JoinRoomForm({
  onStatusChange,
  onInteractionChange,
}: JoinRoomFormProps) {
  const router = useRouter();
  const requestInFlightRef = useRef(false);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestInFlightRef.current) return;

    const normalizedCode = normalizeOperationsRoomCode(roomCode);

    if (!normalizedCode) {
      setError("Informe o código da sala.");
      onStatusChange?.("invalid-code");
      return;
    }

    requestInFlightRef.current = true;
    setError("");
    setIsJoining(true);
    onStatusChange?.("joining");

    let failureStatus: OperationStatus = "join-error";

    try {
      const response = await fetchOperationsRequest("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        if (response.status === 404 || response.status === 422) {
          failureStatus = "invalid-code";
        }

        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Não foi possível entrar na sala.";
        throw new Error(message);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("room" in data) ||
        typeof data.room !== "object" ||
        data.room === null ||
        !("code" in data.room) ||
        typeof data.room.code !== "string"
      ) {
        throw new Error("A resposta da sala é inválida.");
      }

      onStatusChange?.("success-transition");
      router.push(`/lobby/${encodeURIComponent(data.room.code)}`);
    } catch (requestError) {
      requestInFlightRef.current = false;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível entrar na sala.",
      );
      setIsJoining(false);

      if (requestError instanceof OperationsRequestError) {
        failureStatus = "network-error";
      }

      onStatusChange?.(failureStatus);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7" aria-busy={isJoining}>
      <label htmlFor="room-code" className="wb-label">
        Código da operação
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="room-code"
          name="roomCode"
          value={roomCode}
          onFocus={() => onInteractionChange?.("typing-code")}
          onBlur={() => {
            if (!requestInFlightRef.current) {
              onInteractionChange?.("join-focus");
            }
          }}
          onChange={(event) => {
            setRoomCode(event.target.value);
            setError("");
            onInteractionChange?.("typing-code");
            if (!requestInFlightRef.current) onStatusChange?.("idle");
          }}
          placeholder="A7C9K2"
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "room-code-error" : "room-code-hint"}
          className="wb-field wb-room-code-input min-w-0 flex-1"
        />
        <button
          type="submit"
          onFocus={() => onInteractionChange?.("join-focus")}
          disabled={isJoining}
          className="wb-button wb-button--secondary"
        >
          {isJoining ? "Localizando…" : "Localizar operação"}
        </button>
      </div>
      <p
        id="room-code-hint"
        className="mt-3 min-h-5 text-xs text-[var(--wb-text-muted)]"
      >
        {isJoining
          ? "Validando o código e preparando acesso ao lobby."
          : "Cole ou digite o código completo compartilhado pelo anfitrião."}
      </p>
      {error ? (
        <p id="room-code-error" className="wb-error" role="alert">
          {error} Corrija o código ou tente novamente.
        </p>
      ) : null}
    </form>
  );
}
