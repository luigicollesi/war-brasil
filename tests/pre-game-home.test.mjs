import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/page.tsx", "utf8");
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const fallback = readFileSync(
  "src/components/pre-game/home/command-home-fallback.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/components/pre-game/home/command-home.module.css",
  "utf8",
);
const svg = readFileSync("public/war-brasil-42.production.svg", "utf8");

test("HOME preserva metadata, canonical e structured data existentes", () => {
  assert.match(page, /export const metadata: Metadata/);
  assert.match(page, /canonical: "\/"/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /"@type": "WebApplication"/);
  assert.match(page, /<CommandHomeClient>/);
  assert.match(page, /<CommandHomeFallback \/>/);
});

test("HOME substitui o hero legado pela entrada de comando", () => {
  assert.doesNotMatch(page, /GameQuickGuide/);
  assert.doesNotMatch(page, /HomeTerritoryMap/);
  assert.doesNotMatch(page, /WarShell/);
  assert.match(home, /ENTRAR NO COMANDO/);
  assert.match(home, /data-home-state=\{homeState\}/);
  assert.match(home, /data-scene="fallback"/);
});

test("fallback visual permanece server-rendered e fora da fronteira interativa", () => {
  assert.doesNotMatch(fallback, /"use client"/);
  assert.doesNotMatch(home, /next\/image/);
  assert.match(page, /CommandHomeFallback/);
  assert.match(home, /children: ReactNode/);
  assert.match(home, /\{children\}/);
});

test("HOME expõe os três destinos como links DOM com as rotas do spec", () => {
  assert.match(home, /href: "\/matchmaking"/);
  assert.match(home, /label: "OPERAÇÕES"/);
  assert.match(home, /href: "\/rules"/);
  assert.match(home, /label: "DOUTRINA"/);
  assert.match(home, /href: "\/profile"/);
  assert.match(home, /label: "COMANDO"/);
  assert.match(home, /<Link/);
  assert.match(home, /aria-label="Destinos do comando"/);
});

test("ritual é pulável, repetição de sessão e reduced-motion chegam ao estado estável", () => {
  assert.match(home, /Pular ritual/);
  assert.match(home, /sessionStorage\.getItem\(HOME_RITUAL_SESSION_KEY\)/);
  assert.match(home, /sessionStorage\.setItem\(HOME_RITUAL_SESSION_KEY, "1"\)/);
  assert.match(home, /\(prefers-reduced-motion: reduce\)/);
  assert.match(home, /setVisitMode\("reduced"\)/);
  assert.match(home, /setVisitMode\("repeat"\)/);
  assert.match(home, /setCeremonyPhase\("stable"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("cerimônia Terra -> Brasil -> Mesa não é dependência da ação principal", () => {
  assert.match(home, /type CeremonyPhase = "earth" \| "brazil" \| "table" \| "stable"/);
  assert.match(home, /if \(current === "earth"\) return "brazil"/);
  assert.match(home, /if \(current === "brazil"\) return "table"/);
  assert.match(home, /if \(current === "table"\) return "stable"/);
  assert.match(home, /const enterCommand = \(\) =>/);
  assert.doesNotMatch(home, /@react-three\/fiber/);
  assert.doesNotMatch(fallback, /@react-three\/fiber/);
  assert.doesNotMatch(home, /<Canvas/);
  assert.doesNotMatch(fallback, /<Canvas/);
});

test("fallback visual reutiliza exatamente o SVG territorial canônico de 42 territórios", () => {
  assert.match(fallback, /src="\/war-brasil-42\.production\.svg"/);
  assert.match(fallback, /preload/);
  assert.match(fallback, /unoptimized/);

  const territories = svg.match(
    /<path\b(?=[^>]*\bclass="[^"]*\bterritory\b[^"]*")(?=[^>]*\bdata-name="[^"]+")[^>]*>/g,
  );

  assert.equal(territories?.length, 42);
});

test("mobile possui composição própria sem overflow horizontal nem ação dependente de hover", () => {
  assert.match(styles, /overflow-x: clip/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.destinationRail \{\s*grid-template-columns: 1fr;/);
  assert.match(styles, /\.destination \{\s*min-height: 64px;/);
  assert.match(home, /onFocus=\{\(\) => setDestinationFocus\(destination\.id\)\}/);
  assert.match(home, /onClick=\{\(\) => setTransitioningTo\(destination\.id\)\}/);
});

test("vermelho de conflito é introduzido apenas no foco de Operações", () => {
  assert.match(styles, /data-destination-focus="operations"/);
  assert.match(styles, /rgba\(127, 25, 30, \.12\)/);
  assert.match(styles, /orbitConflict/);
});
