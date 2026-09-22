import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { decodeMatchHistoryCursor } from "@/src/lib/server/profile/history-service";
import { getPublicCommanderHistory } from "@/src/lib/server/profile/profile-service";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type RouteContext = {
  params: Promise<{ handle: string }>;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  const { handle } = await params;
  const normalizedHandle = handle.trim();
  if (!normalizedHandle || normalizedHandle.length > 64) {
    return noStoreJson({ error: "COMMANDER_NOT_FOUND" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  if (cursor && !decodeMatchHistoryCursor(cursor)) {
    return noStoreJson({ error: "INVALID_CURSOR" }, { status: 400 });
  }

  const requestedLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
    : DEFAULT_LIMIT;

  const result = await getPublicCommanderHistory(
    session.user.id,
    normalizedHandle,
    { cursor, limit },
  );
  if (!result) {
    return noStoreJson({ error: "COMMANDER_NOT_FOUND" }, { status: 404 });
  }
  if (!result.visible || !result.data) {
    return noStoreJson({ error: "HISTORY_RESTRICTED" }, { status: 403 });
  }

  return noStoreJson(result.data);
}
