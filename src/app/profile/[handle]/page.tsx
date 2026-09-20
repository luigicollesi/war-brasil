import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCommanderProfileView } from "@/src/components/profile/public-commander-profile";
import { getCurrentProfileCommandSnapshot } from "@/src/lib/server/profile/profile-command-snapshot-service";
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
  const normalizedHandle = handle.trim();
  if (!normalizedHandle || normalizedHandle.length > 32) notFound();

  const snapshot = await getPublicCommanderProfileSnapshot(normalizedHandle);
  if (!snapshot) notFound();

  let incomingRequestId: string | null = null;
  if (snapshot.relationship === "incoming-request") {
    const ownSnapshot = await getCurrentProfileCommandSnapshot();
    incomingRequestId =
      ownSnapshot.social.data.incomingRequests.find(
        (request) => request.handle === snapshot.identity.handle,
      )?.requestId ?? null;
  }

  return (
    <PublicCommanderProfileView
      snapshot={snapshot}
      incomingRequestId={incomingRequestId}
    />
  );
}
