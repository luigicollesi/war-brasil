import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  BetaTesterWelcomeRewardError,
  claimBetaTesterWelcomeReward,
} from "@/src/lib/server/profile/beta-tester-welcome-reward-service";

export async function POST(request: Request) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  try {
    return Response.json(
      await claimBetaTesterWelcomeReward(session.user.id),
    );
  } catch (error) {
    if (error instanceof BetaTesterWelcomeRewardError) {
      return Response.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        code: "BETA_REWARD_UNAVAILABLE",
        message: "Não foi possível entregar a recompensa Beta Tester agora.",
      },
      { status: 503 },
    );
  }
}
