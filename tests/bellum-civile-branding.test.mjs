import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public branding exposes Bellum Civile instead of WAR Brasil", async () => {
  const [layout, home, homeIdentity, siteHeader, warShell, gamePage] =
    await Promise.all([
      readSource("src/app/layout.tsx"),
      readSource("src/app/page.tsx"),
      readSource("src/components/pre-game/home/command-home-content.tsx"),
      readSource("src/components/site-header.tsx"),
      readSource("src/components/war-shell.tsx"),
      readSource("src/app/game/[roomId]/page.tsx"),
    ]);

  const publicBranding = [
    layout,
    home,
    homeIdentity,
    siteHeader,
    warShell,
    gamePage,
  ].join("\n");

  assert.match(layout, /applicationName: "Bellum Civile"/);
  assert.match(home, /Bellum Civile/);
  assert.match(homeIdentity, />BELLUM</);
  assert.match(homeIdentity, />CIVILE</);
  assert.match(siteHeader, /Bellum Civile/);
  assert.match(warShell, /Bellum Civile/);
  assert.match(gamePage, /Bellum Civile/);
  assert.doesNotMatch(publicBranding, /WAR Brasil|War Brasil|WAR <|>WAR</);
});
