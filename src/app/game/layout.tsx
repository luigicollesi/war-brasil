import type { CSSProperties, ReactNode } from "react";

const legacyGameTypography = {
  "--font-wb-ui": "var(--font-wb-legacy-ui)",
  fontFamily: "var(--font-wb-legacy-ui), sans-serif",
} as CSSProperties;

export default function GameLayout({ children }: { children: ReactNode }) {
  return <div style={legacyGameTypography}>{children}</div>;
}
