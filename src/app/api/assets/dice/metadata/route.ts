import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { assertDiceAssetKey } from "@/src/lib/server/assets/asset-storage-config";
import { findDiceBodyColor } from "@/src/lib/server/assets/dice-asset-metadata-repository";

const DICE_SLOTS = new Set([
  "dice_attack",
  "dice_defense",
  "dice_neutral",
] as const);

type DiceSlot = "dice_attack" | "dice_defense" | "dice_neutral";

function unavailableMetadataResponse(status = 404) {
  return Response.json(
    { bodyColor: null },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const url = new URL(request.url);
  const requestedKey = url.searchParams.get("key")?.trim();
  const requestedSlot = url.searchParams.get("slot")?.trim();

  if (
    !requestedKey ||
    !requestedSlot ||
    !DICE_SLOTS.has(requestedSlot as DiceSlot)
  ) {
    return unavailableMetadataResponse(400);
  }

  try {
    const objectKey = assertDiceAssetKey(requestedKey);
    const bodyColor = await findDiceBodyColor(
      objectKey,
      requestedSlot as DiceSlot,
    );

    return Response.json(
      { bodyColor },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return unavailableMetadataResponse(503);
  }
}
