import type { Metadata } from "next";
import Link from "next/link";
import { LobbyClient } from "@/src/components/lobby-client";
import { SiteHeader } from "@/src/components/site-header";

type LobbyPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Lobby",
};

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#14241f]">
      <SiteHeader roomCode={code.toUpperCase()} />
      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <Link
          href="/matchmaking"
          className="mb-6 inline-flex text-xs font-bold uppercase tracking-[0.12em] text-[#687871] transition hover:text-[#14241f]"
        >
          ← Voltar às salas
        </Link>
        <LobbyClient code={code} />
      </main>
    </div>
  );
}
