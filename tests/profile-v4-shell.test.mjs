import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 exposes three route-backed private surfaces", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");

  assert.match(shell, /id: "dossier", href: "\/profile"/);
  assert.match(shell, /id: "arsenal", href: "\/profile\/arsenal"/);
  assert.match(shell, /id: "store", href: "\/profile\/store"/);
  assert.match(shell, /href=\{item\.href\}/);
  assert.match(shell, /aria-current=/);
});

test("PROFILE V4 wallet uses the canonical local coin asset", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");

  assert.match(shell, /src="\/coin\.svg"/);
  assert.doesNotMatch(shell, /ASSET_STORAGE_URL/);
  assert.doesNotMatch(shell, />◈</);
});

test("PROFILE V4 no longer renders the V3 command table on the private dossier", async () => {
  const page = await source("src/app/profile/page.tsx");
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.doesNotMatch(page, /ProfileCommandHub/);
  assert.doesNotMatch(dossier, /Mesa de Comando Pessoal/);
  assert.doesNotMatch(dossier, /Identidade em foco/);
});

test("PROFILE V4 keeps dossier identity image-free", async () => {
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.doesNotMatch(dossier, /<Image\b/);
  assert.doesNotMatch(dossier, /<img\b/);
  assert.doesNotMatch(dossier, /session\.user\.image/);
  assert.match(dossier, /ProfileSettingsPanel/);
  assert.match(dossier, /APARÊNCIA PÚBLICA/i);
});

test("PROFILE V4 dossier monogram is an interface insignia, not a portrait slot", async () => {
  const styles = await source("src/components/profile/v4/profile-dossier.module.css");

  assert.doesNotMatch(styles, /\.identitySignal::before[\s\S]*aspect-ratio:\s*1/);
  assert.doesNotMatch(styles, /\.identitySignal::after[\s\S]*transform:\s*rotate\(45deg\)/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.identitySignal\s*{[\s\S]*display:\s*none/);
});

test("PROFILE V4 suppresses global command chrome across profile routes and keeps the private header responsive", async () => {
  const runtime = await source(
    "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  );
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const styles = await source("src/components/profile/v4/profile-shell.module.css");
  const categoryPage = await source(
    "src/app/profile/store/category/[category]/page.tsx",
  );
  const showcasePage = await source(
    "src/app/profile/store/showcase/[kind]/[id]/page.tsx",
  );
  const publicPage = await source("src/app/profile/[handle]/page.tsx");

  assert.match(runtime, /pathname === "\/profile"/);
  assert.match(runtime, /pathname\.startsWith\("\/profile\/"\)/);
  assert.match(runtime, /chrome=\{!profileOwnsChrome\}/);
  assert.match(categoryPage, /<ProfileShell/);
  assert.doesNotMatch(showcasePage, /<ProfileShell/);
  assert.doesNotMatch(publicPage, /ProfileShell/);
  assert.doesNotMatch(shell, /className=\{styles\.mobileNav\}/);
  assert.match(
    styles,
    /@media \(max-width: 980px\)[\s\S]*?\.commandBar\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*auto;[\s\S]*?bottom:\s*max\(/,
  );
  assert.match(
    styles,
    /@media \(max-width: 980px\)[\s\S]*?\.primaryNav\s*\{[\s\S]*?display:\s*grid;/,
  );
});


test("PROFILE V4 owns its background and keeps document scrolling as the only vertical scroll container", async () => {
  const styles = await source("src/components/profile/v4/profile-shell.module.css");

  assert.match(
    styles,
    /\.page\s*\{[^}]*overflow-x:\s*clip;[^}]*overflow-y:\s*visible;/,
  );
  assert.doesNotMatch(styles, /\.page\s*\{[^}]*overflow-x:\s*hidden;/);
});


test("PROFILE V4 logout uses Better Auth signOut before returning to animated home", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");

  assert.match(shell, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(shell, /import \{ authClient \} from "@\/client\/auth-client"/);
  assert.match(shell, /const PROFILE_LOGOUT_TRANSITION_MS = 280/);
  assert.match(shell, /await authClient\.signOut\(\)/);
  assert.match(
    shell,
    /try \{[\s\S]*authClient\.signOut\(\)[\s\S]*\} catch \{[\s\S]*setLogoutState\("error"\)/,
  );
  assert.match(shell, /router\.replace\("\/"\)/);
  assert.match(shell, /data-session-state=\{logoutState\}/);
  assert.doesNotMatch(shell, /document\.cookie/);
});

test("PROFILE V4 logout button exposes pending retry and keyboard-safe states", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const styles = await source("src/components/profile/v4/profile-shell.module.css");

  assert.match(shell, /className=\{styles\.logoutButton\}/);
  assert.match(shell, /aria-label="Encerrar sessão"/);
  assert.match(shell, /disabled=\{logoutState === "closing"\}/);
  assert.match(shell, /logoutState === "closing"\s*\?\s*"SAINDO\.\.\."/);
  assert.match(shell, /logoutState === "error"\s*\?\s*"TENTAR NOVAMENTE"/);

  assert.match(
    styles,
    /\.logoutButton\s*\{[^}]*min-height:\s*38px;[^}]*border:/,
  );
  assert.match(
    styles,
    /\.logoutButton:focus-visible\s*\{[^}]*outline:/,
  );
});

test("PROFILE V4 logout animates profile chrome out and respects reduced motion", async () => {
  const styles = await source("src/components/profile/v4/profile-shell.module.css");

  assert.match(
    styles,
    /\.page\[data-session-state="closing"\]\s+\.commandBar\s*\{[^}]*opacity:\s*0;[^}]*transform:/,
  );
  assert.match(
    styles,
    /\.page\[data-session-state="closing"\]\s+\.surface\s*\{[^}]*opacity:\s*0;[^}]*transform:/,
  );
  assert.match(
    styles,
    /\.page\[data-session-state="closing"\]\s+\.ambient\s*\{[^}]*opacity:\s*0;/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.commandBar,[\s\S]*\.surface,[\s\S]*\.ambient[\s\S]*\{[^}]*transition:\s*none;/,
  );
});


test("PROFILE V4 wallet balance stays aligned and responsive across header sizes", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const styles = await source("src/components/profile/v4/profile-shell.module.css");

  assert.match(shell, /className=\{styles\.walletCopy\}/);
  assert.match(shell, /className=\{styles\.walletBalance\}/);
  assert.match(styles, /\.walletBalance\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(styles, /\.walletBalance\s*\{[^}]*text-align:\s*right;/);
  assert.match(styles, /\.walletBalance\s*\{[^}]*min-width:\s*6ch;/);
  assert.match(styles, /font-size:\s*clamp\(/);
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*\.walletBalance/);
});


test("PROFILE V4 category surfaces can pin the private header to the viewport", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");
  const styles = await source("src/components/profile/v4/profile-shell.module.css");
  const categoryPage = await source(
    "src/app/profile/store/category/[category]/page.tsx",
  );

  assert.match(shell, /fixedHeader = false/);
  assert.match(shell, /data-fixed-header=\{fixedHeader \? "true" : "false"\}/);
  assert.match(categoryPage, /<ProfileShell[\s\S]*fixedHeader/);
  assert.match(
    styles,
    /@media \(min-width: 981px\)[\s\S]*\.page\[data-fixed-header="true"\] \.commandBar\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*0;[\s\S]*left:\s*0;[\s\S]*right:\s*0;/,
  );
  assert.match(
    styles,
    /\.page\[data-fixed-header="true"\] \.surface\s*\{[\s\S]*padding-top:\s*calc\(var\(--profile-commandbar-height\)/,
  );
});
