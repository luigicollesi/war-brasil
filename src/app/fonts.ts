import {
  Barlow,
  Barlow_Condensed,
  Bebas_Neue,
  Black_Ops_One,
  Cinzel,
  Cormorant_SC,
  Geist_Mono,
  Inter,
  Oxanium,
} from "next/font/google";

export const interfaceFont = Barlow({
  variable: "--font-wb-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const brandFont = Cinzel({
  variable: "--font-wb-brand",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const legacyStoreInterfaceFont = Inter({
  variable: "--font-wb-store-ui",
  subsets: ["latin"],
});

export const displayFont = Barlow_Condensed({
  variable: "--font-wb-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const militaryStencilTitleFont = Black_Ops_One({
  variable: "--font-wb-title-military-stencil",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

const imperialTitleFont = Cinzel({
  variable: "--font-wb-title-imperial",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  preload: false,
});

const tacticalTechTitleFont = Oxanium({
  variable: "--font-wb-title-tactical-tech",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  preload: false,
});

const propagandaTitleFont = Bebas_Neue({
  variable: "--font-wb-title-propaganda",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

const ceremonialTitleFont = Cormorant_SC({
  variable: "--font-wb-title-ceremonial",
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  preload: false,
});

export const profileTitleFontVariables = [
  militaryStencilTitleFont.variable,
  imperialTitleFont.variable,
  tacticalTechTitleFont.variable,
  propagandaTitleFont.variable,
  ceremonialTitleFont.variable,
].join(" ");
