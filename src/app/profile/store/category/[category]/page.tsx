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

  let profile;
  let gameplay: Awaited<ReturnType<typeof getEconomyStoreCategory>> | null = null;
  let wallet: Awaited<ReturnType<typeof getEconomyWallet>> | null = null;
  let appearanceStorefront: Awaited<ReturnType<typeof getProfileAppearanceStorefront>> = {
    offers: [],
  };

  try {
    if (category === "dice" || category === "territories") {
      [profile, gameplay] = await Promise.all([
        getOwnCommanderProfile(session.user.id),
        getEconomyStoreCategory(session.user.id, category),
      ]);
    } else {
      [profile, wallet, appearanceStorefront] = await Promise.all([
        getOwnCommanderProfile(session.user.id),
        getEconomyWallet(session.user.id),
        getProfileAppearanceStorefront(session.user.id),
      ]);
    }
  } catch (error) {
    if (
      error instanceof EconomyServiceError &&
      error.code === "ECONOMY_COMMANDER_MISSING"
    ) {
      redirect("/profile");
    }
    console.error("Falha ao carregar categoria da Intendência.", error);
    throw error;
  }

  if (!profile) redirect("/profile");

  if (category === "dice" || category === "territories") {
    if (!gameplay) {
      throw new Error("STORE_CATEGORY_GAMEPLAY_UNAVAILABLE");
    }

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
          gameplayOffers={gameplay.offers}
          territorySkins={gameplay.territorySkins}
          appearanceStorefront={{ offers: [] }}
        />
      </ProfileShell>
    );
  }

  if (!wallet) {
    throw new Error("STORE_CATEGORY_WALLET_UNAVAILABLE");
  }

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
        gameplayOffers={[]}
        territorySkins={[]}
        appearanceStorefront={appearanceStorefront}
      />
    </ProfileShell>
  );
}
