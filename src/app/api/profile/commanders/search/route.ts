import { NextResponse } from "next/server";
import { searchProfileCommanders } from "@/src/lib/profile/profile-command-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchProfileCommanders(query);
  return NextResponse.json({ results });
}
