import type { Metadata } from "next";
import { GameClient } from "@/src/components/game-client-v2";
import { RoadVisibilityProvider } from "@/src/components/road-visibility-provider";
import { ServerConnectionIndicator } from "@/src/components/server-connection-indicator";
import "./game-polish.css";
import "./game-quantity.css";
import "./game-interaction-fix.css";
import "./game-safe-layout.css";
import "./game-roads.css";
import "./game-performance.css";

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
        <RoadVisibilityProvider>
          <GameClient roomId={roomId} />
        </RoadVisibilityProvider>
      </div>
      <ServerConnectionIndicator />
    </main>
  );
}
