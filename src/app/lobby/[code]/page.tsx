import type { Metadata } from "next";
import { LobbyClient } from "@/src/components/lobby-client";
import { WarShell } from "@/src/components/war-shell";

type LobbyPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Sala de Comando",
};

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;

  return (
    <WarShell
      backHref="/matchmaking"
      backLabel="Operações"
      title="Sala de Comando"
    >
      <main className="wb-shell-inner wb-lobby-shell">
        <LobbyClient code={code} />
      </main>
    </WarShell>
  );
}
