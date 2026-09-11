import type { Metadata } from "next";
import Link from "next/link";
import { LobbyClient } from "@/src/components/lobby-client";

type LobbyPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Sala de Comando",
};

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;

  return (
    <main className="wb-shell-inner wb-lobby-shell">
      <Link href="/matchmaking" className="wb-ghost-link">
        ← Operações
      </Link>
      <LobbyClient code={code} />
    </main>
  );
}
