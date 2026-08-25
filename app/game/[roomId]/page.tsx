import type { Metadata } from "next";
import Link from "next/link";
import { GameClient } from "@/src/components/game-client";
import { SiteHeader } from "@/src/components/site-header";

type GamePageProps = {
  params: Promise<{ roomId: string }>;
};

export const metadata: Metadata = {
  title: "Partida",
};

export default async function GamePage({ params }: GamePageProps) {
  const { roomId } = await params;

  return (
    <div className="min-h-screen bg-[#eeebe2] text-[#14241f]">
      <SiteHeader roomCode={roomId} />
      <main className="mx-auto max-w-[94rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <Link
          href="/matchmaking"
          className="mb-5 inline-flex text-xs font-bold uppercase tracking-[0.12em] text-[#687871] transition hover:text-[#14241f]"
        >
          ← Voltar às salas
        </Link>
        <GameClient roomId={roomId} />
      </main>
    </div>
  );
}
