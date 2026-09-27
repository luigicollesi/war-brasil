import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { getBattlePassSnapshot } from "@/src/lib/server/progression/battle-pass-snapshot-service";

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session?.user?.id) return authenticationRequiredResponse();

  try {
    const snapshot = await getBattlePassSnapshot(session.user.id);
    return NextResponse.json(
      { snapshot },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[battle-pass] snapshot failed", error);
    return NextResponse.json(
      {
        error: "BATTLE_PASS_UNAVAILABLE",
        message: "A Campanha está temporariamente indisponível.",
      },
      { status: 503 },
    );
  }
}
