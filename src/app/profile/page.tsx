import type { Metadata } from "next";
import { connection } from "next/server";
import { ProfileCommandHub } from "@/src/components/profile/command-quarters/profile-command-hub";
import { ProfileSettingsPanel } from "@/src/components/profile/command-quarters/profile-settings-panel";
import { getCurrentProfileCommandSnapshot } from "@/src/lib/server/profile/profile-command-snapshot-service";

export const metadata: Metadata = {
  title: "Quartel do Comandante",
  description: "Identidade, rede, campanhas e Intendência do comandante no WAR Brasil.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  await connection();
  const snapshot = await getCurrentProfileCommandSnapshot();
  const identity = snapshot.identity.data;
  const privacy = snapshot.privacy.data;

  return (
    <>
      <ProfileCommandHub snapshot={snapshot} />
      {!snapshot.isEvaluationFixture &&
      snapshot.identity.availability === "available" &&
      snapshot.privacy.availability === "available" &&
      identity &&
      privacy ? (
        <ProfileSettingsPanel identity={identity} privacy={privacy} />
      ) : null}
    </>
  );
}
