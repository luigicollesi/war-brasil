import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BattlePassPage } from "@/src/components/progression/battle-pass/battle-pass-page";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import { getBattlePassSnapshot } from "@/src/lib/server/progression/battle-pass-snapshot-service";

export const metadata: Metadata = {
  title: "Campanha · Bellum Civile",
  description: "Progresso e recompensas do Passe de Campanha.",
  robots: { index: false, follow: false },
};

export default async function CampaignPage() {
  await connection();
  const session = await getAuthenticatedSessionForReadHeaders(await headers());
  if (!session?.user?.id) redirect("/");

  let snapshot = null;
  let unavailable = false;
  try {
    snapshot = await getBattlePassSnapshot(session.user.id);
  } catch (error) {
    unavailable = true;
    console.error("[battle-pass] campaign page unavailable", error);
  }

  return <BattlePassPage snapshot={snapshot} unavailable={unavailable} />;
}
