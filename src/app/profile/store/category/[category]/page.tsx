import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ProfileEconomyUnavailable } from "@/src/components/profile/v4/profile-economy-unavailable";
import {
  ProfileStoreCategory,
  STORE_CATEGORY_IDS,
  type StoreCategoryId,
} from "@/src/components/profile/v4/profile-store-category";
import { ProfileShell } from "@/src/components/profile/v4/profile-shell";
import type { EconomyStorefrontSnapshot } from "@/src/lib/economy/economy-contract";
import type { ProfileAppearanceStorefront } from "@/src/lib/economy/profile-appearance-store-contract";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";
import { getProfileAppearanceStorefront } from "@/src/lib/server/economy/profile-appearance-store-service";
import { getOwnCommanderProfile } from "@/src/lib/server/profile/profile-service";

const LABELS: Readonly<Record<StoreCategoryId, string>> = {
  dice: "Dados",
  territories: "Territórios",
  backgrounds: "Fundos",
  titles: "Títulos",
};

function isStoreCategoryId(value: string): value is StoreCategoryId {
  return (STORE_CATEGORY_IDS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = isStoreCategoryId(category) ? LABELS[category] : "Catálogo";
  return {
    title: `${label} · Intendência`,
    robots: { index: false, follow: false },
  };
}

export default async function StoreCategoryRoute({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  await connection();
  const { category } = await params;
  if (!isStoreCategoryId(category)) notFound();

  const session = await getAuthenticatedSessionForReadHeaders(await headers());
  if (!session) redirect("/");

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) redirect("/profile");

  let storefront: EconomyStorefrontSnapshot | null = null;
  let appearanceStorefront: ProfileAppearanceStorefront = { offers: [] };

  try {
    [storefront, appearanceStorefront] = await Promise.all([
      getEconomyStorefront(session.user.id),
      getProfileAppearanceStorefront(session.user.id),
    ]);
  } catch (error) {
    if (error instanceof EconomyServiceError && error.code === "ECONOMY_COMMANDER_MISSING") {
      redirect("/profile");
    }
    console.error("Falha ao carregar categoria da Intendência.", error);
  }

  return (
    <ProfileShell
      activeSurface="store"
      displayName={profile.identity.displayName}
      handle={profile.identity.handle}
      wallet={
        storefront
          ? { available: true, balance: storefront.wallet.balance, label: storefront.wallet.label }
          : { available: false, reason: "Economia temporariamente indisponível." }
      }
    >
      {storefront ? (
        <ProfileStoreCategory
          category={category}
          storefront={storefront}
          appearanceStorefront={appearanceStorefront}
        />
      ) : (
        <ProfileEconomyUnavailable surface="store" />
      )}
    </ProfileShell>
  );
}
