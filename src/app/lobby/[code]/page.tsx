import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LobbyClient } from "@/src/components/lobby-client";

type LobbyPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Sala de Comando",
};

const lobbyLayoutStyle = {
  paddingTop: "var(--command-content-top, 96px)",
  paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
  scrollPaddingTop: "var(--command-content-top, 96px)",
  scrollPaddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
} satisfies CSSProperties;

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;

  return (
    <main
      className="wb-shell-inner wb-lobby-shell"
      style={lobbyLayoutStyle}
    >
      <Link href="/matchmaking" className="wb-ghost-link">
        ← Operações
      </Link>
      <LobbyClient code={code} />
    </main>
  );
}
