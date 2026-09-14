import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EconomyStorefront } from "@/src/components/profile/store/economy-storefront";
import type { EconomyStorefrontSnapshot } from "@/src/lib/economy/economy-contract";
import { auth } from "@/src/lib/server/auth/auth";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";

export const metadata: Metadata = {
  title: "Intendência",
  description: "Loja e loadout cosmético do comandante no WAR Brasil.",
  robots: { index: false, follow: false },
};

export default async function ProfileStorePage() {
  await connection();
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session) redirect("/");

  let storefront: EconomyStorefrontSnapshot;
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

  return <EconomyStorefront initialStorefront={storefront} />;
}
