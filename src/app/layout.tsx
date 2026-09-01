import type { Metadata } from "next";
import { Barlow_Condensed, Geist_Mono, Inter } from "next/font/google";
import { getSiteUrl } from "@/src/lib/site-url";
import "./globals.css";
import "./war-identity.css";
import "./war-guide.css";
import "./war-guide-primitives.css";
import "./war-guide-sections.css";
import "./war-guide-barrier-refresh.css";
import "./war-guide-geographic.css";
import "./war-guide-regions.css";

const interfaceFont = Inter({
  variable: "--font-wb-ui",
  subsets: ["latin"],
});

const displayFont = Barlow_Condensed({
  variable: "--font-wb-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: "WAR Brasil",
  title: {
    default: "WAR Brasil",
    template: "%s | WAR Brasil",
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
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${interfaceFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-[var(--font-wb-ui)]">{children}</body>
    </html>
  );
}
