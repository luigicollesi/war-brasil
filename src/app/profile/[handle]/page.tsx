import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicCommanderProfileView } from "@/src/components/profile/public-commander-profile";
import { getPublicCommanderProfileSnapshot } from "@/src/lib/server/profile/public-profile-snapshot-service";

export const metadata: Metadata = {
  title: "Arquivo do Comandante",
  description: "Perfil público de comandante no WAR Brasil.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicCommanderProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const normalizedHandle = decodeURIComponent(handle).trim();
  if (!normalizedHandle || normalizedHandle.length > 32) notFound();

  const snapshot = await getPublicCommanderProfileSnapshot(normalizedHandle);
  if (!snapshot) notFound();
  if (snapshot.relationship === "self") redirect("/profile");

  return <PublicCommanderProfileView snapshot={snapshot} />;
}
