import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";

function economyErrorResponse(error: unknown) {
  if (error instanceof EconomyServiceError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Falha ao consultar storefront econômico.", error);
  return Response.json(
    {
      error: "ECONOMY_UNAVAILABLE",
      message: "A Intendência está temporariamente indisponível.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const storefront = await getEconomyStorefront(session.user.id);
    return Response.json(storefront, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return economyErrorResponse(error);
  }
}
