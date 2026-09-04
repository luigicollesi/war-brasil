"use client";

import type { TradeCardDescriptor } from "../shared/game-trade-rules";

function responseError(data: unknown, fallback: string) {
  return typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback;
}

export async function sendTradeSignal(
  roomId: string,
  card: TradeCardDescriptor,
) {
  const response = await fetch(
    `/api/games/${encodeURIComponent(roomId)}/trade/signal`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card }),
    },
  );

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      responseError(data, "Não foi possível enviar a sinalização de carta."),
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("signalsUsed" in data) ||
    typeof data.signalsUsed !== "number"
  ) {
    throw new Error("A sinalização foi enviada, mas a resposta do servidor é inválida.");
  }

  return { signalsUsed: data.signalsUsed };
}
