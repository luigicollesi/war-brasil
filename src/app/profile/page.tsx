import type { Metadata } from "next";
import { connection } from "next/server";
import { ProfileSceneBridge } from "@/src/components/profile/profile-command-shell";
import { ProfileHall } from "@/src/components/profile/profile-hall";
import { getCurrentProfileSnapshot } from "@/src/lib/profile/profile-data";

export const metadata: Metadata = {
  title: "Perfil — Salão de Comando",
  description: "Identidade e registros do comandante no WAR Brasil.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  // The profile is identity-bound and must be resolved at request time. This also
  // keeps the opt-in visual-evaluation harness deterministic without exposing a
  // URL-controlled mock state.
  await connection();
  const snapshot = await getCurrentProfileSnapshot();

  return (
    <ProfileSceneBridge>
      <ProfileHall snapshot={snapshot} />
    </ProfileSceneBridge>
  );
}
