import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { EconomyStorefront } from "@/src/components/profile/store/economy-storefront";
import { auth } from "@/src/lib/server/auth/auth";
import { getEconomyStorefront } from "@/src/lib/server/economy/economy-service";

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

  const storefront = await getEconomyStorefront(session.user.id);
  return <EconomyStorefront initialStorefront={storefront} />;
}
