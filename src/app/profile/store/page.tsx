import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProfileEconomyUnavailable } from "@/src/components/profile/v4/profile-economy-unavailable";
import { ProfileShell } from "@/src/components/profile/v4/profile-shell";
import { ProfileStore } from "@/src/components/profile/v4/profile-store";
import type { EconomyStorefrontSnapshot } from "@/src/lib/economy/economy-contract";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";
import { getOwnCommanderProfile } from "@/src/lib/server/profile/profile-service";

export const metadata: Metadata = {
  title: "Intendência · Quartel do Comandante",
  description: "Catálogo cosmético e futuras aquisições do comandante no WAR Brasil.",
  robots: { index: false, follow: false },
};

const economyUnavailableReason =
  "Economia temporariamente indisponível. O Dossiê continua operacional.";

export default async function ProfileStorePage() {
  await connection();
  const session = await getAuthenticatedSessionForReadHeaders(await headers());

  if (!session) redirect("/");

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) redirect("/profile");

  let storefront: EconomyStorefrontSnapshot | null = null;
  try {
    storefront = await getEconomyStorefront(session.user.id);
  } catch (error) {
    if (
      error instanceof EconomyServiceError &&
      error.code === "ECONOMY_COMMANDER_MISSING"
    ) {
      redirect("/profile");
    }
    console.error("Falha ao carregar Economy na Intendência V4.", error);
  }

  return (
    <ProfileShell
      activeSurface="store"
      displayName={profile.identity.displayName}
      handle={profile.identity.handle}
      wallet={
        storefront
          ? {
              available: true,
              balance: storefront.wallet.balance,
              label: storefront.wallet.label,
            }
          : {
              available: false,
              reason: economyUnavailableReason,
            }
      }
    >
      {storefront ? (
        <ProfileStore storefront={storefront} />
      ) : (
        <ProfileEconomyUnavailable surface="store" />
      )}
    </ProfileShell>
  );
}
