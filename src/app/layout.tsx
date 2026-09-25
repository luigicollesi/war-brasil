import type { Metadata } from "next";
import { ActiveParticipationRuntime } from "@/src/components/active-participation-runtime";
import { PreGameCommandRuntime } from "@/src/components/pre-game/foundation";
import { ProfilePresenceHeartbeat } from "@/src/components/profile/profile-presence-heartbeat";
import { UserNotificationRuntime } from "@/src/components/notifications/user-notification-runtime";
import { getSiteUrl } from "@/src/lib/site-url";
import {
  brandFont,
  displayFont,
  geistMono,
  interfaceFont,
  legacyInterfaceFont,
  profileTitleFontVariables,
} from "./fonts";
import "./globals.css";
import "./title-effects.css";
import "./war-identity.css";
import "./lobby-ready-rail.css";
import "./war-guide.css";
import "./war-guide-primitives.css";
import "./war-guide-geographic.css";
import "./war-guide-regions.css";
import "./war-guide-sections.css";
import "./war-guide-final-sections.css";
import "./war-guide-scenes.css";
import "./war-guide-responsive.css";
import "./war-guide-mobile-map.css";

function assetPublicOrigin() {
  const configured = process.env.ASSET_PUBLIC_BASE_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: "Bellum Civile",
  title: {
    default: "Bellum Civile",
    template: "%s | Bellum Civile",
  },
  description:
    "Jogo de estratégia online no mapa do Brasil, com 42 territórios, barreiras e disputas entre facções.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icone.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const assetOrigin = assetPublicOrigin();

  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${interfaceFont.variable} ${displayFont.variable} ${brandFont.variable} ${legacyInterfaceFont.variable} ${geistMono.variable} ${profileTitleFontVariables} h-full antialiased`}
    >
      {assetOrigin ? (
        <head>
          <link rel="preconnect" href={assetOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={assetOrigin} />
        </head>
      ) : null}
      <body className="min-h-full font-[var(--font-wb-ui)]">
        <ProfilePresenceHeartbeat />
        <UserNotificationRuntime />
        <PreGameCommandRuntime>
          <ActiveParticipationRuntime>{children}</ActiveParticipationRuntime>
        </PreGameCommandRuntime>
      </body>
    </html>
  );
}
