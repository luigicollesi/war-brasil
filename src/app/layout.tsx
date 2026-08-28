import type { Metadata } from "next";
import { Barlow_Condensed, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./war-identity.css";
import "./war-guide.css";
import "./war-guide-barrier-refresh.css";

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
  title: {
    default: "WAR Brasil",
    template: "%s | WAR Brasil",
  },
  description: "Uma base para partidas de estratégia no mapa do Brasil.",
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
