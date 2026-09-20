import "server-only";

import { headers } from "next/headers";
import type {
  PublicCommanderProfileSnapshot,
  PublicPlayerMatchHistory,
  PublicProfileEquippedCosmetic,
} from "@/src/lib/profile/profile-command-contract";
import { auth } from "../auth/auth";
import {
  diceAssetDeliveryPath,
  territorySkinAssetDeliveryPath,
} from "../assets/asset-storage-service";
import {
  listEquippedProfileCosmetics,
  type CosmeticRow,
} from "../economy/economy-repository";
import { getPublicProfileAppearance } from "./profile-appearance-service";
import { getPublicCommanderProfile } from "./profile-service";

function emptyHistory(): PublicPlayerMatchHistory {
  return { matches: [], hasMore: false, nextCursor: null };
}

function publicCosmetic(row: CosmeticRow): PublicProfileEquippedCosmetic {
  const assetRef =
    row.asset_ref === null
      ? null
      : row.slot === "territory_skin"
        ? territorySkinAssetDeliveryPath(row.asset_ref)
        : row.asset_ref.startsWith("cosmetics/dice/")
          ? diceAssetDeliveryPath(row.asset_ref)
          : row.asset_ref;

  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    assetRef,
    effectKey: row.effect_key,
    bodyColor: row.body_color,
    bodyHighlightColor: row.body_highlight_color,
  };
}

function requireCosmetic(
  rows: CosmeticRow[],
  slot: PublicProfileEquippedCosmetic["slot"],
) {
  const row = rows.find((item) => item.slot === slot);
  if (!row) {
    throw new Error(`PUBLIC_PROFILE_LOADOUT_MISSING:${slot}`);
  }
  return publicCosmetic(row);
}

export async function getPublicCommanderProfileSnapshot(
  handle: string,
): Promise<PublicCommanderProfileSnapshot | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  const profile = await getPublicCommanderProfile(session.user.id, handle);
  if (!profile) return null;

  const [appearance, equippedCosmetics] = await Promise.all([
    getPublicProfileAppearance(profile.ownerUserId),
    listEquippedProfileCosmetics(profile.ownerUserId),
  ]);
  const history = profile.history.data ?? emptyHistory();

  return {
    identity: {
      displayName: profile.identity.displayName,
      handle: profile.identity.handle,
      bio: profile.identity.bio,
      title: profile.identity.title?.name ?? null,
      presence: profile.identity.presence,
      activity: profile.identity.activity,
    },
    relationship: profile.relationship,
    appearance: {
      title: appearance.title,
      background: appearance.background,
      arsenal: {
        diceAttack: requireCosmetic(equippedCosmetics, "dice_attack"),
        diceDefense: requireCosmetic(equippedCosmetics, "dice_defense"),
        diceNeutral: requireCosmetic(equippedCosmetics, "dice_neutral"),
        territorySkin: requireCosmetic(equippedCosmetics, "territory_skin"),
      },
    },
    history: profile.history.visible
      ? {
          availability: history.matches.length > 0 ? "available" : "empty",
          source: "match-history",
          data: history,
        }
      : {
          availability: "unavailable",
          source: null,
          unavailableReason: "Este comandante restringiu o acesso ao Livro de Campanha.",
          data: emptyHistory(),
        },
  };
}
