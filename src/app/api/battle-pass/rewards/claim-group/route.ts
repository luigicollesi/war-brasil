import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  BoundedJsonBodyError,
  readBoundedJsonBody,
} from "@/src/lib/server/http/read-bounded-json";
import {
  BattlePassServiceError,
  claimBattlePassRewardGroup,
  parseBattlePassClaimInput,
} from "@/src/lib/server/progression/battle-pass-reward-service";

function errorResponse(error: unknown) {
  if (error instanceof BattlePassServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[battle-pass] grouped reward claim failed", error);
  return NextResponse.json(
    {
      error: "BATTLE_PASS_UNAVAILABLE",
      message: "O conjunto de recompensas não pôde ser coletado agora.",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session?.user?.id) return authenticationRequiredResponse();

  let payload: unknown;
  try {
    payload = await readBoundedJsonBody(request);
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  try {
    const input = parseBattlePassClaimInput(payload);
    const result = await claimBattlePassRewardGroup(
      session.user.id,
      input.rewardId,
    );
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
