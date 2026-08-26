import type { Metadata } from "next";
import { GameClient } from "@/src/components/game-client";

type GamePageProps = {
  params: Promise<{ roomId: string }>;
};

export const metadata: Metadata = {
  title: "Partida",
};

export default async function GamePage({ params }: GamePageProps) {
  const { roomId } = await params;

  return (
    <main className="game-screen" aria-label="Partida War Brasil">
      <div className="game-runtime">
        <GameClient roomId={roomId} />
      </div>
    </main>
  );
}
