import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { searchCommanderDirectory } from "@/src/lib/server/profile/profile-service";

const MAX_QUERY_LENGTH = 64;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return noStoreJson({ results: [] });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return noStoreJson(
      { results: [], error: "QUERY_TOO_LONG" },
      { status: 400 },
    );
  }

  const commanders = await searchCommanderDirectory(session.user.id, query);
  const results = commanders.map((commander) => ({
    handle: commander.handle,
    displayName: commander.displayName,
    title: commander.title?.name ?? null,
    relationship: commander.relationship,
    mutualContacts: commander.mutualContacts,
  }));
  return noStoreJson({ results });
}
