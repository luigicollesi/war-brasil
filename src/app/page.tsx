import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GameQuickGuide } from "@/src/components/game-guide/game-quick-guide";
import { HomeTerritoryMap } from "@/src/components/home-territory-map";
import { WarShell } from "@/src/components/war-shell";
import { getSiteUrl } from "@/src/lib/site-url";
import "./home-territory-map.css";

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
    <WarShell immersive>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="wb-shell-inner">
        <section className="wb-home">
          <div className="wb-home-grid">
            <div className="wb-home-copy">
              <div className="mb-5 flex items-center gap-4">
                <Image
                  src="/icone.png"
                  alt=""
                  width={128}
                  height={128}
                  loading="eager"
                  sizes="(max-width: 767px) 96px, 128px"
                  className="h-24 w-24 rounded-[22%] object-cover shadow-[0_18px_40px_rgba(0,0,0,.24)] sm:h-28 sm:w-28"
                />
                <p className="wb-kicker">Estratégia em território nacional</p>
              </div>

              <h1 className="wb-home-title">
                War
                <strong>Brasil</strong>
              </h1>
              <p className="wb-page-lead">
                Conquiste territórios, atravesse barreiras e conduza sua facção por
                um Brasil transformado em campo de estratégia.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/matchmaking" className="wb-button wb-button--primary">
                  <span className="wb-diamond" aria-hidden="true" />
                  Jogar
                </Link>
                <a href="#manual" className="wb-button wb-button--ghost">
                  Como jogar
                </a>
              </div>

              <div className="wb-facts" aria-label="Informações da partida">
                <div className="wb-fact">
                  <strong>42</strong>
                  <span>Territórios</span>
                </div>
                <span className="wb-diamond" aria-hidden="true" />
                <div className="wb-fact">
                  <strong>5</strong>
                  <span>Regiões</span>
                </div>
                <span className="wb-diamond" aria-hidden="true" />
                <div className="wb-fact">
                  <strong>2–6</strong>
                  <span>Jogadores</span>
                </div>
              </div>
            </div>

            <HomeTerritoryMap />
          </div>
        </section>

        <GameQuickGuide />
      </main>
    </WarShell>
  );
}
