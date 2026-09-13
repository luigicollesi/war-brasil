import { NextResponse } from "next/server";
import { searchProfileCommanders } from "@/src/lib/profile/profile-command-data";

const MAX_QUERY_LENGTH = 64;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
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

  const results = await searchProfileCommanders(query);
  return noStoreJson({ results });
}
