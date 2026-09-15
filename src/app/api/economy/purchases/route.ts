import { NextResponse } from "next/server";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/http/request-origin";
import {
  EconomyServiceError,
  parsePurchaseOfferInput,
  purchaseOffer,
} from "@/src/lib/server/economy/economy-service";

function economyErrorResponse(error: unknown) {
  if (error instanceof EconomyServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[economy] purchase failed", error);
  return NextResponse.json(
    {
      error: "ECONOMY_UNAVAILABLE",
      message: "A compra não pôde ser processada agora.",
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
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Corpo JSON inválido." },
      { status: 400 },
    );
  }

  try {
    const input = parsePurchaseOfferInput(payload);
    const purchase = await purchaseOffer(
      session.user.id,
      input.offerId,
      input.idempotencyKey,
    );

    return NextResponse.json(
      { ok: true, ...purchase },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return economyErrorResponse(error);
  }
}
