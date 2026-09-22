import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import {
  decodeMatchHistoryCursor,
  getPlayerMatchHistory,
} from "@/src/lib/server/profile/history-service";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  if (cursor && !decodeMatchHistoryCursor(cursor)) {
    return noStoreJson({ error: "INVALID_CURSOR" }, { status: 400 });
  }

  const requestedLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
    : DEFAULT_LIMIT;

  const history = await getPlayerMatchHistory(session.user.id, {
    cursor,
    limit,
  });
  return noStoreJson(history);
}
