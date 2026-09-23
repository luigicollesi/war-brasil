import "server-only";

import type { NextResponse } from "next/server";
import {
  ACTIVE_PARTICIPATION_COOKIE,
  serializeActiveParticipationHint,
  type ActiveParticipationHint,
} from "@/src/lib/shared/active-participation";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function persistActiveParticipationCookie(
  response: NextResponse,
  participation: ActiveParticipationHint,
) {
  response.cookies.set({
    name: ACTIVE_PARTICIPATION_COOKIE,
    value: serializeActiveParticipationHint(participation),
    httpOnly: true,
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function clearActiveParticipationCookie(response: NextResponse) {
  response.cookies.set({
    name: ACTIVE_PARTICIPATION_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
