import { NextResponse } from "next/server";
import { getAuthenticatedSessionForRead } from "@/src/lib/server/auth/auth-guard";
import { getBattlePassMatchResult } from "@/src/lib/server/progression/battle-pass-match-result-service";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "AUTHENTICATION_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { roomId } = await params;
  if (!/^\d+$/.test(roomId)) {
    return NextResponse.json(
      { error: "INVALID_ROOM" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const result = await getBattlePassMatchResult(roomId, session.user.id);
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[battle-pass] match result failed", error);
    return NextResponse.json(
      { error: "BATTLE_PASS_RESULT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
