import type { Metadata } from "next";
import { GameClient } from "@/src/components/game-client-v2";
import { ServerConnectionIndicator } from "@/src/components/server-connection-indicator";
import "./game-polish.css";
import "./game-quantity.css";

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
      <style>{`.game-runtime > div > section:first-of-type span[class*="rounded-full"] { visibility: hidden; }`}</style>
      <div className="game-runtime">
        <GameClient roomId={roomId} />
      </div>
      <ServerConnectionIndicator />
    </main>
  );
}
