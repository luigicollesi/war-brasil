"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createRoom() {
    setError("");
    setIsCreating(true);

    try {
      const response = await fetch("/api/rooms", { method: "POST" });
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

      router.push(`/lobby/${encodeURIComponent(data.room.code)}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar a sala.",
      );
      setIsCreating(false);
    }
  }

  return (
    <div className="mt-9">
      <button
        type="button"
        onClick={createRoom}
        disabled={isCreating}
        className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-white px-6 text-xs font-bold uppercase tracking-[0.13em] text-[#12392f] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
      >
        {isCreating ? "Criando…" : "Criar sala"} <span aria-hidden="true">→</span>
      </button>
      {error ? <p className="mt-3 text-sm text-[#f3c6bf]">{error}</p> : null}
    </div>
  );
}
