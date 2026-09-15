import type { Metadata } from "next";
import { connection } from "next/server";
import { ProfileDossier } from "@/src/components/profile/v4/profile-dossier";
import { ProfileShell, type ProfileShellWallet } from "@/src/components/profile/v4/profile-shell";
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
      evaluationFixture={snapshot.isEvaluationFixture}
    >
      <ProfileDossier snapshot={snapshot} />
    </ProfileShell>
  );
}
