import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 store is a dedicated Intendência surface inside the shared shell", async () => {
  const page = await source("src/app/profile/store/page.tsx");

  assert.match(page, /activeSurface="store"/);
  assert.match(page, /<ProfileStore/);
  assert.doesNotMatch(page, /<EconomyStorefront/);
});

test("PROFILE V4 store consumes server-derived collections, territory skins, offers and packs", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.collections/);
  assert.match(store, /storefront\.territorySkins/);
  assert.match(store, /storefront\.offers/);
  assert.match(store, /storefront\.creditPacks/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.match(store, /pack\.priceBrlCents/);
  assert.doesNotMatch(store, /R\$\s*\d/);
  assert.doesNotMatch(store, /price:\s*\d/);
  assert.doesNotMatch(store, /creditAmount:\s*\d/);
  assert.doesNotMatch(store, /userId/);
});

test("PROFILE V4 store exposes Destaques, Dados, Territórios e Coleções as primary discovery surfaces", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  for (const label of ["DESTAQUES", "DADOS", "TERRITÓRIOS", "COLEÇÕES"]) {
    assert.match(store, new RegExp(label));
  }
  for (const anchor of ["store-highlights", "store-dice", "store-territories", "store-collections"]) {
    assert.match(store, new RegExp(`id=\\"${anchor}\\"|href=\\"#${anchor}\\"`));
  }
});

test("PROFILE V4 store uses the canonical campaign-credit coin beside monetary values", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /src="\/coin\.svg"/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.doesNotMatch(store, />\s*◈\s*</);
});

test("PROFILE V4 store exposes ownership-aware discovery without becoming purchase authority", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /offer\.fullyOwned/);
  assert.match(store, /offer\.partiallyOwned/);
  assert.match(store, /offer\.ownedCount/);
  assert.match(store, /offer\.totalCount/);
  assert.match(store, /offer\.purchasable/);
  assert.match(store, /POSSUÍDO/);
  assert.match(store, /INDISPONÍVEL/);
  assert.match(store, /INSPECIONAR/);
  assert.doesNotMatch(store, /\/api\/economy\/purchases/);
});

test("PROFILE V4 collection discovery uses only its banner and routes detail into the showcase", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /showcaseHref\("collection",\s*collection\.id/);
  assert.match(store, /showcaseHref\("collection",\s*featuredCollection\.id/);
  assert.match(
    store,
    /function collectionProgressLabel[\s\S]*collection\.ownedCount[\s\S]*collection\.totalCount/,
  );
  assert.doesNotMatch(store, /selectedCollection\.assets\.(?:background|logo)/);
  assert.doesNotMatch(store, /aria-modal="true"/);
});

test("PROFILE V4 collection banner is an accessible showcase link", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /href=\{showcaseHref\("collection", collection\.id\)\}/);
  assert.match(store, /aria-label=\{`Inspecionar coleção \$\{collection\.name\}`\}/);
  assert.doesNotMatch(store, /selectedCollectionId/);
  assert.doesNotMatch(store, /collectionModalOpen/);
});

test("PROFILE V4 territory surface routes purchasable skins and never invents a price", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.territorySkins\.map/);
  assert.match(store, /skin\.status/);
  assert.match(store, /showcaseHref\("offer",\s*offer\.id,\s*skin\.id\)/);
  assert.match(store, /EM BREVE|ANUNCIADO/);
  assert.doesNotMatch(store, /skin\.price/);
});

test("PROFILE V4 treasury renders DB credit packs but keeps BRL checkout disabled", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /id="reforcar-tesouraria"/);
  assert.match(store, /storefront\.creditPacks\.map/);
  assert.match(store, /EM BREVE/);
  assert.match(store, /disabled/);
  assert.doesNotMatch(store, /Stripe|MercadoPago|checkout/i);
});

test("PROFILE V4 store keeps implementation jargon out of player-facing copy", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.doesNotMatch(store, />[^<]*(?:Economy V2|backend|autoridade comercial)[^<]*</i);
});

test("PROFILE V4 store delegates inspection state to the dedicated showcase route", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /function showcaseHref/);
  assert.match(store, /\/profile\/store\/showcase\//);
  assert.doesNotMatch(store, /InspectionContent/);
  assert.doesNotMatch(store, /inspectionOpen/);
  assert.doesNotMatch(store, /profile-store-mobile-inspection\.module\.css/);
});


test("PROFILE V4 product cards open the showcase while purchasable offers can be bought directly", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /purchaseShowcaseOffer/);
  assert.match(store, /handlePurchase\(offer\)/);
  assert.match(store, /showcaseHref\("offer", offer\.id/);
  assert.match(store, /pendingOfferId/);
  assert.match(store, /PROCESSANDO\.\.\./);
  assert.match(store, /COMPRAR/);
});


test("PROFILE V4 collection banners keep the full artwork and use wider cards", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.collectionGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(520px,\s*100%\),\s*1fr\)\)/,
  );
  assert.match(
    styles,
    /\.collectionBannerButton\s*\{[\s\S]*grid-template-rows:\s*auto\s+auto/,
  );
  assert.match(
    styles,
    /\.collectionBannerButton\s*>\s*img\s*\{[\s\S]*height:\s*auto;[\s\S]*object-fit:\s*contain;/,
  );
});


test("PROFILE V4 store V1 presents sections and products as one borderless continuous surface", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const commerce = await source("src/components/profile/v4/profile-store-commerce.module.css");

  assert.match(
    styles,
    /\.hero,\s*[\s\S]*?\.catalog,\s*[\s\S]*?\.treasury\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
  );
  assert.match(
    styles,
    /\.productCard\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    styles,
    /\.collectionBannerCard\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/,
  );
  assert.match(styles, /\.productCopy\s*\{[\s\S]*?border-top:\s*0;/);
  assert.match(styles, /\.collectionBannerMeta\s*\{[\s\S]*?border-top:\s*0;/);
  assert.match(styles, /\.storeNav\s*\{[\s\S]*?border:\s*0;/);
  assert.match(
    commerce,
    /\.productCommerce\s*\{[\s\S]*?border-top:\s*0;[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    commerce,
    /\.creditPack\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/,
  );
});

test("PROFILE V4 store V1 uses spacing and image lift instead of card outlines for hierarchy", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(styles, /\.store\s*\{[\s\S]*?gap:\s*clamp\(/);
  assert.match(
    styles,
    /\.productVisual img\s*\{[\s\S]*?transition:[^;}]*transform[^;}]*filter/,
  );
  assert.match(
    styles,
    /\.productCard:hover\s+\.productVisual img\s*\{[\s\S]*?transform:\s*translateY\(-3px\)\s+scale\(1\.015\)/,
  );
  assert.doesNotMatch(
    styles,
    /\.collectionBannerCard\[data-featured="true"\]\s*\{[\s\S]*?border-color:/,
  );
});


test("PROFILE V4 store V2 builds a static tactical optical atmosphere from layered HTML and CSS", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  for (const layer of [
    "storeAtmosphere",
    "atmosphereBase",
    "atmosphereOptical",
    "atmospherePlatePrimary",
    "atmospherePlateSecondary",
    "atmosphereGhostType",
    "atmosphereLight",
    "atmosphereVignette",
  ]) {
    assert.match(store, new RegExp(`styles\\.${layer}`));
  }

  assert.match(store, /className=\{styles\.storeAtmosphere\}[\s\S]*aria-hidden="true"/);
  assert.match(styles, /\.store\s*\{[\s\S]*position:\s*relative;[\s\S]*isolation:\s*isolate;/);
  assert.match(styles, /\.storeAtmosphere\s*\{[\s\S]*position:\s*absolute;[\s\S]*pointer-events:\s*none;/);
  assert.match(styles, /\.atmosphereOptical\s*\{[\s\S]*repeating-(?:linear|radial)-gradient/);
  assert.match(styles, /\.atmospherePlatePrimary\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(styles, /\.atmospherePlateSecondary\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(styles, /\.atmosphereLight\s*\{[\s\S]*radial-gradient/);
  assert.match(styles, /\.atmosphereVignette\s*\{[\s\S]*radial-gradient/);
  assert.doesNotMatch(
    styles,
    /\.atmosphere(?:Base|Optical|PlatePrimary|PlateSecondary|GhostType|Light|Vignette)\s*\{[^}]*animation:/s,
  );
  assert.doesNotMatch(store, /@react-three|three\/|<Canvas\b/);
});

test("PROFILE V4 store V2 gives hero and catalog sections static 2.5D depth cues without restoring cards", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /data-store-zone="dice"/);
  assert.match(store, /data-store-zone="territories"/);
  assert.match(store, /data-store-zone="collections"/);
  assert.match(store, /data-store-layer="01"/);
  assert.match(store, /data-store-layer="02"/);
  assert.match(store, /data-store-layer="03"/);
  assert.match(styles, /\.catalog::before\s*\{[\s\S]*content:\s*attr\(data-store-layer\)/);
  assert.match(styles, /\[data-store-zone="dice"\]::after\s*\{[\s\S]*radial-gradient/);
  assert.match(styles, /\[data-store-zone="territories"\]::after\s*\{[\s\S]*radial-gradient/);
  assert.match(styles, /\[data-store-zone="collections"\]::after\s*\{[\s\S]*(?:linear|radial)-gradient/);
  assert.match(styles, /\.heroVisual::before[\s\S]*clip-path:\s*polygon\(/);
  assert.doesNotMatch(
    styles,
    /\.heroVisual::before,\s*\.heroVisual::after\s*\{[^}]*border:/,
  );
  assert.match(styles, /@media\s*\(max-width:\s*520px\)[\s\S]*\.atmospherePlateSecondary\s*\{[\s\S]*display:\s*none/);
});


test("PROFILE V4 V2 atmosphere stays behind the sticky store navigation without flattening sibling z-indexes", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.storeAtmosphere\s*\{[^}]*z-index:\s*-1;/,
  );
  assert.doesNotMatch(
    styles,
    /\.store\s*>\s*:not\(\.storeAtmosphere\)\s*\{[^}]*z-index:/,
  );
  assert.match(styles, /\.storeNav\s*\{[\s\S]*?z-index:\s*8;/);
});


test("PROFILE V4 store V2.1 distributes military visual language across fixed and scrolling layers", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  for (const layer of [
    "storeFixedAtmosphere",
    "fixedCommandStripe",
    "fixedArmorPlate",
    "fixedLightSweep",
    "atmosphereLeftMass",
    "atmosphereLowerMass",
    "signalClusterLeft",
    "signalClusterRight",
    "operationAxis",
    "supplyNetwork",
    "frontLine",
    "repairPlate",
    "lowerArmor",
  ]) {
    assert.match(store, new RegExp(`styles\\.${layer}`));
  }

  assert.match(
    styles,
    /\.storeFixedAtmosphere\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;/,
  );
  assert.match(styles, /\.fixedCommandStripe\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(styles, /\.fixedArmorPlate\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(styles, /\.operationAxis\s*\{[\s\S]*(?:linear|repeating-linear)-gradient/);
  assert.match(styles, /\.supplyNetwork\s*\{[\s\S]*radial-gradient/);
  assert.match(styles, /\.frontLine\s*\{[\s\S]*repeating-linear-gradient/);
  assert.match(styles, /\.repairPlate\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(styles, /\.lowerArmor\s*\{[\s\S]*clip-path:\s*polygon\(/);
});

test("PROFILE V4 store V2.1 moves only selected fixed atmosphere layers and respects reduced motion", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(styles, /@keyframes\s+storeCommandDrift/);
  assert.match(styles, /@keyframes\s+storeArmorDrift/);
  assert.match(styles, /@keyframes\s+storeLightDrift/);
  assert.match(styles, /\.fixedCommandStripe\s*\{[\s\S]*animation:\s*storeCommandDrift/);
  assert.match(styles, /\.fixedArmorPlate\s*\{[\s\S]*animation:\s*storeArmorDrift/);
  assert.match(styles, /\.fixedLightSweep\s*\{[\s\S]*animation:\s*storeLightDrift/);
  assert.doesNotMatch(styles, /\.operationAxis\s*\{[^}]*animation:/s);
  assert.doesNotMatch(styles, /\.supplyNetwork\s*\{[^}]*animation:/s);
  assert.doesNotMatch(styles, /\.frontLine\s*\{[^}]*animation:/s);
  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.fixedCommandStripe,[\s\S]*\.fixedArmorPlate,[\s\S]*\.fixedLightSweep\s*\{[\s\S]*animation:\s*none/,
  );
});

test("PROFILE V4 store V2.1 recomposes the war atmosphere for mobile instead of shrinking desktop", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 520px)"));

  assert.match(mobile, /\.fixedArmorPlate\s*\{[\s\S]*display:\s*none;/);
  assert.match(mobile, /\.signalClusterRight\s*\{[\s\S]*display:\s*none;/);
  assert.match(mobile, /\.fixedCommandStripe\s*\{[\s\S]*width:\s*clamp\(/);
  assert.match(mobile, /\.operationAxis\s*\{[\s\S]*width:\s*clamp\(/);
  assert.match(mobile, /\.supplyNetwork\s*\{[\s\S]*opacity:/);
  assert.match(mobile, /\.frontLine\s*\{[\s\S]*width:\s*clamp\(/);
  assert.match(mobile, /\.repairPlate\s*\{[\s\S]*left:/);
  assert.match(mobile, /\.lowerArmor\s*\{[\s\S]*inset-inline:/);
});


test("PROFILE V4 store atmosphere is viewport-clipped and cannot expand page scroll bounds", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.storeFixedAtmosphere\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*overflow:\s*clip;[^}]*contain:\s*paint;/,
  );
  assert.match(
    styles,
    /\.storeAtmosphere\s*\{[^}]*inset:\s*0;[^}]*overflow:\s*clip;/,
  );
  assert.doesNotMatch(
    styles,
    /\.storeAtmosphere\s*\{[^}]*inset:\s*-\d/,
  );
  assert.doesNotMatch(
    styles.slice(styles.indexOf("@media (max-width: 520px)")),
    /\.storeAtmosphere\s*\{[^}]*inset:\s*-/,
  );
});
