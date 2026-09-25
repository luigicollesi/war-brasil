import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { StoreShowcase } from "@/src/components/profile/v4/store-showcase/store-showcase";
import {
  resolveStoreShowcaseView,
  type StoreShowcaseKind,
} from "@/src/lib/economy/store-showcase";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";
import { getOwnCommanderProfile } from "@/src/lib/server/profile/profile-service";

type StoreShowcasePageProps = Readonly<{
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}>;

export const metadata: Metadata = {
  title: "Expositor · Intendência",
  description: "Inspeção tática de cosméticos da Intendência.",
  robots: { index: false, follow: false },
};

function isShowcaseKind(value: string): value is StoreShowcaseKind {
  return value === "offer" || value === "collection";
}

export default async function StoreShowcasePage({
  params,
  searchParams,
}: StoreShowcasePageProps) {
  await connection();
  const session = await getAuthenticatedSessionForReadHeaders(await headers());

  if (!session) redirect("/");

  const { kind, id } = await params;
  if (!isShowcaseKind(kind)) notFound();

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

  const query = await searchParams;
  const requestedItem = Array.isArray(query.item) ? query.item[0] : query.item;
  const showcase = resolveStoreShowcaseView(storefront, kind, id, requestedItem ?? null);
  if (!showcase) notFound();

  return <StoreShowcase showcase={showcase} />;
}
