import type { Metadata } from "next";
import { CommandHomeClient } from "@/src/components/pre-game/home/command-home-client";
import { getSiteUrl } from "@/src/lib/site-url";

const HOME_TITLE = "WAR Brasil — Jogo de estratégia no mapa do Brasil";
const HOME_DESCRIPTION =
  "Jogue WAR Brasil online: dispute 42 territórios, atravesse barreiras e conduza sua facção em partidas estratégicas para 2 a 6 jogadores.";

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  keywords: [
    "WAR Brasil",
    "jogo de estratégia",
    "jogo online Brasil",
    "jogo de território",
    "jogo de tabuleiro online",
    "estratégia Brasil",
    "jogo multiplayer",
  ],
  category: "games",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "WAR Brasil",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [
      {
        url: "/icone.png",
        alt: "WAR Brasil",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/icone.png"],
  },
};

export default function Home() {
  const siteUrl = getSiteUrl();
  const homeUrl = new URL("/", siteUrl).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${homeUrl}#website`,
        url: homeUrl,
        name: "WAR Brasil",
        description: HOME_DESCRIPTION,
        inLanguage: "pt-BR",
      },
      {
        "@type": "WebApplication",
        "@id": `${homeUrl}#game`,
        url: homeUrl,
        name: "WAR Brasil",
        description: HOME_DESCRIPTION,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript",
        inLanguage: "pt-BR",
        isAccessibleForFree: true,
        image: new URL("/icone.png", siteUrl).toString(),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <CommandHomeClient />
    </>
  );
}
