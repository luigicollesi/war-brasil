import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  battlePassErrorCode,
  logBattlePassClaimOutcomes,
  logBattlePassEvent,
} from "@/src/lib/server/observability/battle-pass-events";
import {
  BoundedJsonBodyError,
  readBoundedJsonBody,
} from "@/src/lib/server/http/read-bounded-json";
import {
  BattlePassServiceError,
  claimAllBattlePassRewards,
  parseBattlePassClaimAllInput,
} from "@/src/lib/server/progression/battle-pass-reward-service";

function errorResponse(error: unknown) {
  if (error instanceof BattlePassServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[battle-pass] claim-all failed", error);
  return NextResponse.json(
    {
      error: "BATTLE_PASS_UNAVAILABLE",
      message: "As recompensas não puderam ser coletadas agora.",
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
    const input = parseBattlePassClaimAllInput(payload);
    const result = await claimAllBattlePassRewards(
      session.user.id,
      input.seasonId,
    );
    logBattlePassClaimOutcomes(session.user.id, result.rewards);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logBattlePassEvent("battle_pass_claim_failed", {
      userId: session.user.id,
      errorCode: battlePassErrorCode(error),
    });
    return errorResponse(error);
  }
}
