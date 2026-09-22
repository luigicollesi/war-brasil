import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CommandHomeClient } from "@/src/components/pre-game/home/command-home-client";
import { CommandHomeContent } from "@/src/components/pre-game/home/command-home-content";
import { getAuthenticatedSessionForReadHeaders } from "@/src/lib/server/auth/auth-guard";
import { getCommandAccessState } from "@/src/lib/server/auth/command-access";

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

  const access = await getCommandAccessState(session);

  return (
    <CommandHomeClient mode="command" initialAccess={access}>
      <CommandHomeContent />
    </CommandHomeClient>
  );
}
