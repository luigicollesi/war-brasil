import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProfileArsenal } from "@/src/components/profile/v4/profile-arsenal";
import { ProfileShell } from "@/src/components/profile/v4/profile-shell";
import { auth } from "@/src/lib/server/auth/auth";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";
import { getOwnCommanderProfile } from "@/src/lib/server/profile/profile-service";

export const metadata: Metadata = {
  title: "Arsenal · Quartel do Comandante",
  description: "Inventário possuído e loadout cosmético do comandante no WAR Brasil.",
  robots: { index: false, follow: false },
};

export default async function ProfileArsenalPage() {
  await connection();
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session) redirect("/");

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) redirect("/profile");

  let storefront;
  try {
    storefront = await getEconomyStorefront(session.user.id);
  } catch (error) {
    if (
      error instanceof EconomyServiceError &&
      error.code === "ECONOMY_COMMANDER_MISSING"
    ) {
      redirect("/profile");
    }
    throw error;
  }

  return (
    <ProfileShell
      activeSurface="arsenal"
      displayName={profile.identity.displayName}
      handle={profile.identity.handle}
      wallet={{
        available: true,
        balance: storefront.wallet.balance,
        label: storefront.wallet.label,
      }}
    >
      <ProfileArsenal initialStorefront={storefront} />
    </ProfileShell>
  );
}
