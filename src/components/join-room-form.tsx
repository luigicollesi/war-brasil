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
      <label
        htmlFor="room-code"
        className="text-xs font-bold uppercase tracking-[0.14em] text-[#64756f]"
      >
        Código da sala
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="room-code"
          name="roomCode"
          value={roomCode}
          onChange={(event) => {
            setRoomCode(event.target.value);
            setError("");
          }}
          placeholder="ex: brasil-42"
          autoComplete="off"
          aria-describedby={error ? "room-code-error" : undefined}
          className="h-13 min-w-0 flex-1 rounded-xl border border-[#17372d]/15 bg-white px-4 font-mono text-sm text-[#14241f] outline-none transition placeholder:text-[#9aa7a2] focus:border-[#b98c1e] focus:ring-3 focus:ring-[#d5a937]/15"
        />
        <button
          type="submit"
          className="h-13 rounded-xl bg-[#173f34] px-6 text-xs font-bold uppercase tracking-[0.13em] text-white transition hover:bg-[#0f3027] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f34]"
        >
          Entrar
        </button>
      </div>
      {error ? (
        <p id="room-code-error" className="mt-2 text-sm text-[#a33c33]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
