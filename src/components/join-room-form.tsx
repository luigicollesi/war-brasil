"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinRoomForm() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = roomCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");

    if (!normalizedCode) {
      setError("Informe o código da sala.");
      return;
    }

    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
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

      router.push(`/lobby/${encodeURIComponent(data.room.code)}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível entrar na sala.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8">
      <label htmlFor="room-code" className="wb-label">
        Código da sala
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="room-code"
          name="roomCode"
          value={roomCode}
          onChange={(event) => {
            setRoomCode(event.target.value);
            setError("");
          }}
          placeholder="BRASIL-42"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={error ? "room-code-error" : undefined}
          className="wb-field wb-room-code-input min-w-0 flex-1"
        />
        <button type="submit" className="wb-button wb-button--secondary">
          Entrar
        </button>
      </div>
      {error ? (
        <p id="room-code-error" className="wb-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
