import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  EconomyServiceError,
  equipCosmetic,
  getEconomyLoadout,
  parseEquipCosmeticInput,
} from "@/src/lib/server/economy/economy-service";

function economyErrorResponse(error: unknown) {
  if (error instanceof EconomyServiceError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Falha ao alterar loadout cosmético.", error);
  return Response.json(
    {
      error: "ECONOMY_LOADOUT_UNAVAILABLE",
      message: "O loadout cosmético está temporariamente indisponível.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const loadout = await getEconomyLoadout(session.user.id);
    return Response.json(
      { loadout },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return economyErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Corpo JSON inválido." },
      { status: 400 },
    );
  }

  try {
    const input = parseEquipCosmeticInput(payload);
    await equipCosmetic(session.user.id, input.slot, input.cosmeticId);
    const loadout = await getEconomyLoadout(session.user.id);
    return Response.json({ ok: true, loadout });
  } catch (error) {
    return economyErrorResponse(error);
  }
}
