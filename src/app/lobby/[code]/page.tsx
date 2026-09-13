import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { LobbyClient } from "@/src/components/lobby-client";

type LobbyPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Sala de Comando",
};

const lobbyLayoutStyle = {
  height: "100dvh",
  minHeight: 0,
  boxSizing: "border-box",
  overflow: "hidden",
  paddingTop: "var(--command-content-top, 96px)",
  paddingBottom: "max(10px, env(safe-area-inset-bottom))",
} satisfies CSSProperties;

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;

  return (
    <main className="wb-shell-inner" style={lobbyLayoutStyle}>
      <LobbyClient code={code} />
    </main>
  );
}
