import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ProfileStoreCategory,
  STORE_CATEGORY_IDS,
  type StoreCategoryId,
} from "@/src/components/profile/v4/profile-store-category";
import { ProfileShell } from "@/src/components/profile/v4/profile-shell";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import {
  EconomyServiceError,
  getEconomyStoreCategory,
  getEconomyWallet,
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

  try {
    if (category === "dice" || category === "territories") {
      const [profile, gameplay] = await Promise.all([
        getOwnCommanderProfile(session.user.id),
        getEconomyStoreCategory(session.user.id, category),
      ]);
      if (!profile) redirect("/profile");

      return (
        <ProfileShell
          activeSurface="store"
          displayName={profile.identity.displayName}
          handle={profile.identity.handle}
          wallet={{
            available: true,
            balance: gameplay.wallet.balance,
            label: gameplay.wallet.label,
          }}
        >
          <ProfileStoreCategory
            category={category}
            wallet={gameplay.wallet}
            gameplayOffers={gameplay.offers}
            territorySkins={gameplay.territorySkins}
            appearanceStorefront={{ offers: [] }}
          />
        </ProfileShell>
      );
    }

    const [profile, wallet, appearanceStorefront] = await Promise.all([
      getOwnCommanderProfile(session.user.id),
      getEconomyWallet(session.user.id),
      getProfileAppearanceStorefront(session.user.id),
    ]);
    if (!profile) redirect("/profile");

    return (
      <ProfileShell
        activeSurface="store"
        displayName={profile.identity.displayName}
        handle={profile.identity.handle}
        wallet={{
          available: true,
          balance: wallet.balance,
          label: wallet.label,
        }}
      >
        <ProfileStoreCategory
          category={category}
          wallet={wallet}
          gameplayOffers={[]}
          territorySkins={[]}
          appearanceStorefront={appearanceStorefront}
        />
      </ProfileShell>
    );
  } catch (error) {
    if (error instanceof EconomyServiceError && error.code === "ECONOMY_COMMANDER_MISSING") {
      redirect("/profile");
    }
    console.error("Falha ao carregar categoria da Intendência.", error);
    throw error;
  }

}