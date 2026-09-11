"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchOperationsRequest } from "@/src/components/operations-request";

type OperationStatus = "idle" | "pending" | "error" | "success";

type CreateRoomButtonProps = {
  onStatusChange?: (status: OperationStatus) => void;
};

export function CreateRoomButton({ onStatusChange }: CreateRoomButtonProps) {
  const router = useRouter();
  const requestInFlightRef = useRef(false);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createRoom() {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setError("");
    setIsCreating(true);
    onStatusChange?.("pending");

    try {
      const response = await fetchOperationsRequest("/api/rooms", {
        method: "POST",
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Não foi possível criar a sala.";
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
        throw new Error("A sala foi criada, mas a resposta é inválida.");
      }

      onStatusChange?.("success");
      router.push(`/lobby/${encodeURIComponent(data.room.code)}`);
    } catch (requestError) {
      requestInFlightRef.current = false;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar a sala.",
      );
      setIsCreating(false);
      onStatusChange?.("error");
    }
  }

  return (
    <div className="mt-7" aria-busy={isCreating}>
      <button
        type="button"
        onClick={createRoom}
        disabled={isCreating}
        className="wb-button wb-button--primary w-full sm:w-auto"
      >
        {isCreating ? "Autorizando operação…" : "Autorizar nova operação"}
      </button>
      <p
        className="mt-3 min-h-5 text-xs text-[var(--wb-text-muted)]"
        role="status"
        aria-live="polite"
      >
        {isCreating ? "Criando sala e preparando acesso ao lobby." : ""}
      </p>
      {error ? (
        <p className="wb-error" role="alert">
          {error} Tente novamente.
        </p>
      ) : null}
    </div>
  );
}
