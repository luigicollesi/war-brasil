import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CommandHomeClient } from "@/src/components/pre-game/home/command-home-client";
import { CommandHomeContent } from "@/src/components/pre-game/home/command-home-content";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import { getCommandAccessState } from "@/src/lib/server/auth/command-access";
import { findActiveParticipationForUser } from "@/src/lib/server/game-participation-service";
import { getBetaTesterWelcomeRewardState } from "@/src/lib/server/profile/beta-tester-welcome-reward-service";
import { getBattlePassHomeSummary } from "@/src/lib/server/progression/battle-pass-snapshot-service";

export const metadata: Metadata = {
  title: "Comando",
  description: "Central de comando autenticada do Bellum Civile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CommandHomePage() {
  await connection();
  const session = await getAuthenticatedSessionForReadHeaders(await headers());

  if (!session) {
    redirect("/");
  }

  const participation = await findActiveParticipationForUser(session.user.id);
  if (participation) {
    redirect(participation.target);
  }

  const [access, campaign, betaTesterReward] = await Promise.all([
    getCommandAccessState(session),
    getBattlePassHomeSummary(session.user.id).catch(() => ({ active: false as const })),
    getBetaTesterWelcomeRewardState(session.user.id).catch(() => ({
      eligible: false,
      claimed: false,
      pending: false,
    })),
  ]);

  return (
    <CommandHomeClient
      mode="command"
      initialAccess={access}
      initialCampaign={campaign}
      initialBetaTesterReward={betaTesterReward}
    >
      <CommandHomeContent />
    </CommandHomeClient>
  );
}
