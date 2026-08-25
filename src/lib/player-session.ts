import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const PLAYER_SESSION_COOKIE = "war_brasil_player";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type PlayerSession = {
  value: string;
  isNew: boolean;
};

function isValidSession(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

export function getOrCreatePlayerSession(request: NextRequest): PlayerSession {
  const existingSession = request.cookies.get(PLAYER_SESSION_COOKIE)?.value;

  if (isValidSession(existingSession)) {
    return { value: existingSession, isNew: false };
  }

  return { value: randomUUID(), isNew: true };
}

export function getPlayerSession(request: NextRequest) {
  const session = request.cookies.get(PLAYER_SESSION_COOKIE)?.value;

  return isValidSession(session) ? session : null;
}

export function persistPlayerSession(
  response: NextResponse,
  session: PlayerSession,
) {
  if (!session.isNew) return response;

  response.cookies.set({
    name: PLAYER_SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
