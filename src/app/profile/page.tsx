import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ProfileDossier } from "@/src/components/profile/v4/profile-dossier";
import { ProfileShell, type ProfileShellWallet } from "@/src/components/profile/v4/profile-shell";
import { auth } from "@/src/lib/server/auth/auth";
import { getOwnProfileAppearance } from "@/src/lib/server/profile/profile-appearance-service";
import { getCurrentProfileCommandSnapshot } from "@/src/lib/server/profile/profile-command-snapshot-service";

export const metadata: Metadata = {
  title: "Dossiê · Quartel do Comandante",
  description: "Identidade, rede e histórico operacional do comandante no WAR Brasil.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  await connection();
  const snapshot = await getCurrentProfileCommandSnapshot();
  const identity = snapshot.identity.data;
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  const appearance = session
    ? await getOwnProfileAppearance(session.user.id).catch(() => null)
    : null;
  const equippedBackground =
    appearance?.backgrounds.find((item) => item.equipped)?.assetRef ?? null;
  const equippedTitle =
    appearance?.titles.find((item) => item.equipped) ?? null;
  const walletData = snapshot.wallet.data?.campaignCredit ?? null;
  const wallet: ProfileShellWallet =
    snapshot.wallet.availability === "available" && walletData
      ? {
          available: true,
          balance: walletData.balance,
          label: walletData.label,
        }
      : {
          available: false,
          reason: snapshot.wallet.unavailableReason,
        };

  return (
    <ProfileShell
      activeSurface="dossier"
      displayName={identity?.displayName ?? "Comandante"}
      handle={identity?.handle ?? null}
      wallet={wallet}
      backgroundAssetRef={equippedBackground}
      evaluationFixture={snapshot.isEvaluationFixture}
    >
      <ProfileDossier snapshot={snapshot} appearanceTitle={equippedTitle} />
    </ProfileShell>
  );
}
