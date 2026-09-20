import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rotas internas herdam noindex enquanto Home e documentos legais são indexáveis", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const home = readFileSync("src/app/page.tsx", "utf8");
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");

  assert.match(layout, /robots:\s*\{[\s\S]*?index: false,[\s\S]*?follow: false/);
  assert.match(home, /robots:\s*\{[\s\S]*?index: true,[\s\S]*?follow: true/);
  assert.match(terms, /robots:\s*\{\s*index: true, follow: true\s*\}/);
  assert.match(privacy, /robots:\s*\{\s*index: true, follow: true\s*\}/);
  assert.match(home, /canonical: "\/"/);
});

test("sitemap publica Home, Termos e Privacidade", () => {
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");

  assert.match(sitemap, /new URL\("\/", siteUrl\)/);
  assert.match(sitemap, /new URL\("\/terms", siteUrl\)/);
  assert.match(sitemap, /new URL\("\/privacy", siteUrl\)/);
  assert.doesNotMatch(sitemap, /matchmaking|lobby|game\//);
});

test("robots permite descobrir páginas para que noindex seja observado e bloqueia API", () => {
  const robots = readFileSync("src/app/robots.ts", "utf8");

  assert.match(robots, /allow: "\/"/);
  assert.match(robots, /disallow: \["\/api\/"\]/);
  assert.match(robots, /sitemap\.xml/);
});

test("Home expõe metadados sociais e dados estruturados", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.match(home, /openGraph:/);
  assert.match(home, /twitter:/);
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /"@type": "WebSite"/);
  assert.match(home, /"@type": "WebApplication"/);
});
