import type { Metadata } from "next";
import { connection } from "next/server";
import { ProfileCommandHub } from "@/src/components/profile/command-quarters/profile-command-hub";
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

  return <ProfileCommandHub snapshot={snapshot} />;
}
