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

test("PROFILE V4 store exposes Destaques, Coleções, Categorias e Créditos as primary discovery surfaces", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  for (const label of ["DESTAQUES", "COLEÇÕES", "CATEGORIAS", "CRÉDITOS"]) {
    assert.match(store, new RegExp(label));
  }
  for (const anchor of ["store-highlights", "store-collections", "store-categories", "store-credits"]) {
    assert.match(store, new RegExp(`id=\\"${anchor}\\"|href=\\"#${anchor}\\"`));
  }
  for (const category of ["dice", "territories", "backgrounds", "titles"]) {
    assert.match(store, new RegExp(`/profile/store/category/${category}`));
  }
});

test("PROFILE V4 store uses the canonical campaign-credit coin beside monetary values", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /src="\/coin\.svg"/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.doesNotMatch(store, />\s*◈\s*</);
});

test("PROFILE V4 store keeps ownership-aware purchase state inside catalog surfaces", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const category = await source("src/components/profile/v4/profile-store-category.tsx");

  assert.match(store, /featuredCollectionBundleOffer\.fullyOwned/);
  assert.match(store, /featuredCollectionBundleOffer\.purchasable/);
  assert.match(category, /offer\.fullyOwned/);
  assert.match(category, /offer\.purchasable/);
  assert.match(category, /POSSUÍDO/);
  assert.match(category, /INDISPONÍVEL|ANUNCIADO/);
  assert.doesNotMatch(store, /\/api\/economy\/purchases/);
  assert.doesNotMatch(category, /fetch\(["']\/api\/economy\/purchases/);
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

test("PROFILE V4 territory category routes purchasable skins and never invents a cosmetic price", async () => {
  const category = await source("src/components/profile/v4/profile-store-category.tsx");

  assert.match(category, /storefront\.territorySkins\.map/);
  assert.match(category, /territoryEntries/);
  assert.match(category, /showcase\/offer/);
  assert.match(category, /ANUNCIADO/);
  assert.doesNotMatch(category, /item\.price/);
});

test("PROFILE V4 treasury renders DB credit packs but keeps BRL checkout disabled", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /id="store-credits"/);
  assert.match(store, /storefront\.creditPacks\.map/);
  assert.match(store, /EM BREVE/);
  assert.match(store, /disabled/);
  assert.doesNotMatch(
    store,
    /from\s+["']stripe|Stripe\s*\(|MercadoPago|checkoutUrl|paymentIntent|\/api\/payments/i,
  );
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


test("PROFILE V4 category product cards preserve showcase and direct purchase flows", async () => {
  const category = await source("src/components/profile/v4/profile-store-category.tsx");

  assert.match(category, /purchaseShowcaseOffer/);
  assert.match(category, /handlePurchase\(offer\)/);
  assert.match(category, /showcase\/offer/);
  assert.match(category, /pendingOfferId/);
  assert.match(category, /PROCESSANDO\.\.\./);
  assert.match(category, /COMPRAR/);
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
    /\.productVisual img\s*\{[\s\S]*?transition:[^;}]*transform/,
  );
  assert.doesNotMatch(
    styles,
    /\.productVisual img\s*\{[^}]*transition:[^;}]*filter/,
  );
  assert.match(
    styles,
    /\.productCard:hover\s+\.productVisual img\s*\{[\s\S]*?transform:\s*translateY\(-3px\)\s+scale\(1\.015\)/,
  );
  assert.doesNotMatch(
    styles,
    /\.collectionBannerCard\[data-featured="true"\]\s*\{[^}]*border-color:/,
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
  assert.doesNotMatch(store, /@react-three|three\/|<Canvas\b/);
});

test("PROFILE V4 store V2 gives hero and catalog sections static 2.5D depth cues without restoring cards", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /data-store-zone="collections"/);
  assert.match(store, /data-store-zone="categories"/);
  assert.match(store, /data-store-zone="treasury"/);
  assert.match(store, /data-store-layer="02"/);
  assert.match(store, /data-store-layer="03"/);
  assert.match(store, /data-store-layer="04"/);
  assert.match(styles, /\.catalog::before\s*\{[\s\S]*content:\s*attr\(data-store-layer\)/);
  assert.match(styles, /\[data-store-zone="categories"\]::after\s*\{[\s\S]*(?:linear|radial)-gradient/);
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
    /\.storeAtmosphere\s*\{[^}]*z-index:\s*-2;/,
  );
  assert.doesNotMatch(
    styles,
    /\.store\s*>\s*:not\(\.storeAtmosphere\)\s*\{[^}]*z-index:/,
  );
  assert.match(styles, /\.storeNav\s*\{[\s\S]*?z-index:\s*29;/);
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


test("PROFILE V4 store V2.1 keeps war-machine fixed layers above the dark base veil but below content", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.storeAtmosphere\s*\{[^}]*z-index:\s*-2;/,
  );
  assert.match(
    styles,
    /\.storeFixedAtmosphere\s*\{[^}]*z-index:\s*-1;/,
  );
  assert.match(
    styles,
    /\.atmosphereBase\s*\{[^}]*opacity:\s*0;[^}]*background:\s*transparent;/,
  );
  assert.match(
    styles,
    /\.atmosphereVignette\s*\{[^}]*opacity:\s*0\.[3-7]\d?;/,
  );
});

test("PROFILE V4 store navigation docks immediately below the desktop profile header", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.storeNav\s*\{[^}]*position:\s*sticky;[^}]*z-index:\s*29;[^}]*top:\s*78px;/,
  );
  assert.match(
    styles,
    /\.hero,\s*[\s\S]*?\.catalog,\s*[\s\S]*?\.treasury\s*\{[^}]*scroll-margin-top:\s*14\dpx;/,
  );
});

test("PROFILE V4 store navigation recomposes for bottom-chrome tablet and mobile layouts", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const compact = styles.slice(styles.indexOf("@media (max-width: 980px)"));

  assert.match(
    compact,
    /\.storeNav\s*\{[^}]*top:\s*8px;/,
  );
  assert.match(
    compact,
    /\.hero,\s*[\s\S]*?\.catalog,\s*[\s\S]*?\.treasury\s*\{[^}]*scroll-margin-top:\s*6\dpx;/,
  );
});


test("PROFILE V4 store V3 uses IntersectionObserver instead of scroll-frame listeners for section activity", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /useEffect/);
  assert.match(store, /new IntersectionObserver/);
  assert.match(store, /data-v3-active/);
  assert.match(store, /setActiveSection/);
  assert.doesNotMatch(store, /addEventListener\(\s*["']scroll["']/);
  assert.doesNotMatch(store, /requestAnimationFrame/);
});

test("PROFILE V4 store V3 exposes the active catalog section through the sticky navigation", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /const \[activeSection, setActiveSection\]/);
  assert.match(store, /data-active=\{activeSection === "hero" \? "true" : "false"\}/);
  assert.match(store, /data-active=\{activeSection === "collections" \? "true" : "false"\}/);
  assert.match(store, /data-active=\{activeSection === "categories" \? "true" : "false"\}/);
  assert.match(store, /data-active=\{activeSection === "treasury" \? "true" : "false"\}/);
  assert.match(styles, /\.storeNav a\[data-active="true"\]/);
});

test("PROFILE V4 store V3 animates distant atmosphere on long independent cycles", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  for (const keyframe of [
    "storeOpticalDrift",
    "storeGhostDrift",
    "storeMassBreath",
  ]) {
    assert.match(styles, new RegExp(`@keyframes\\s+${keyframe}`));
  }

  assert.match(styles, /\.atmosphereOptical\s*\{[^}]*animation:\s*storeOpticalDrift\s+6\d?s/);
  assert.match(styles, /\.atmosphereGhostType\s*\{[^}]*animation:\s*storeGhostDrift\s+7\d?s/);
  assert.match(styles, /\.atmosphereLeftMass\s*\{[^}]*animation:\s*storeMassBreath\s+7\d?s/);
  assert.match(styles, /\.atmosphereLowerMass\s*\{[^}]*animation:\s*storeMassBreath\s+8\d?s/);
});

test("PROFILE V4 store V3 activates war-machine section animations only after visibility", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(styles, /\[data-store-zone="hero"\]\[data-v3-active="true"\]\s+\.operationAxis/);
  assert.match(styles, /\[data-store-zone="categories"\]\[data-v3-active="true"\]\s+\.supplyNetwork/);
  assert.match(styles, /\[data-store-zone="categories"\]\[data-v3-active="true"\]\s+\.frontLine/);
  assert.match(styles, /\[data-store-zone="collections"\]\[data-v3-active="true"\]\s+\.repairPlate/);
  assert.match(styles, /\[data-store-zone="treasury"\]\[data-v3-active="true"\]\s+\.lowerArmor/);

  for (const keyframe of [
    "storeOperationReveal",
    "storeSupplyReveal",
    "storeSupplyPulse",
    "storeFrontReveal",
    "storeFrontCrawl",
    "storeThreatPulse",
    "storeRepairReveal",
    "storeRepairSweep",
    "storeTreasuryReveal",
  ]) {
    assert.match(styles, new RegExp(`@keyframes\\s+${keyframe}`));
  }
});

test("PROFILE V4 store V3 reduced-motion mode freezes ambient loops and exposes final section states", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));

  assert.match(
    reduced,
    /\.atmosphereOptical,[\s\S]*\.atmosphereGhostType,[\s\S]*\.atmosphereLeftMass,[\s\S]*\.atmosphereLowerMass[\s\S]*\{[\s\S]*animation:\s*none/,
  );
  assert.match(
    reduced,
    /\.operationAxis,[\s\S]*\.supplyNetwork,[\s\S]*\.frontLine,[\s\S]*\.repairPlate,[\s\S]*\.lowerArmor[\s\S]*\{[\s\S]*transform:\s*none/,
  );
});

test("PROFILE V4 store V3 removes the dark-green intermediate veil below products", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.atmosphereBase\s*\{[^}]*inset:\s*0;[^}]*opacity:\s*0;[^}]*background:\s*transparent;/,
  );
});


test("PROFILE V4 final gives products hover and keyboard-focus lift without animating filters", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.productCard:hover,\s*\.productCard:focus-within\s*\{[^}]*transform:\s*translateY\(-4px\)/,
  );
  assert.match(
    styles,
    /\.productCard:hover\s+\.productVisual::before,\s*\.productCard:focus-within\s+\.productVisual::before\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*scale\(1\.06\)/,
  );
  assert.match(
    styles,
    /\.productSelect:focus-visible,\s*\.collectionBannerButton:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--brass\);[^}]*outline-offset:\s*5px;/,
  );
  assert.doesNotMatch(
    styles,
    /\.productCard:hover\s+\.productVisual img\s*\{[^}]*filter:/,
  );
});

test("PROFILE V4 final makes collection banners premium through transform-and-opacity microinteractions", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(
    styles,
    /\.collectionBannerButton::before\s*\{[^}]*linear-gradient[\s\S]*transform:\s*translate3d\(-130%,\s*0,\s*0\);/,
  );
  assert.match(
    styles,
    /\.collectionBannerCard:hover\s+\.collectionBannerButton::before,\s*\.collectionBannerCard:focus-within\s+\.collectionBannerButton::before\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*translate3d\(130%,\s*0,\s*0\);/,
  );
  assert.match(
    styles,
    /\.collectionBannerButton:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--brass\)/,
  );
});

test("PROFILE V4 final gives the hero restrained hover and focus response", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(styles, /\.heroAction\s*\{[^}]*min-height:\s*44px;/);
  assert.match(
    styles,
    /\.heroAction:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--brass\)/,
  );
  assert.match(
    styles,
    /\.heroVisual:hover\s*>\s*img,\s*\.hero:focus-within\s+\.heroVisual\s*>\s*img\s*\{[^}]*transform:\s*translateY\(-3px\)\s+scale\(1\.012\)/,
  );
  assert.match(
    styles,
    /\.heroVisual:hover::after,\s*\.hero:focus-within\s+\.heroVisual::after\s*\{[^}]*opacity:\s*1;/,
  );
});

test("PROFILE V4 final purchase controls expose disabled and processing states across store surfaces", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const category = await source("src/components/profile/v4/profile-store-category.tsx");
  const commerce = await source("src/components/profile/v4/profile-store-commerce.module.css");
  const categoryStyles = await source("src/components/profile/v4/profile-store-category.module.css");

  assert.match(store, /data-processing=\{[\s\S]*pendingOfferId === featuredCollectionBundleOffer\.id/);
  assert.match(category, /pendingOfferId === offer\.id \? "PROCESSANDO\.\.\." : "COMPRAR"/);
  assert.match(category, /disabled=\{offer\.fullyOwned \|\| !offer\.purchasable \|\| pendingOfferId !== null\}/);
  assert.match(
    commerce,
    /\.purchaseButton,\s*\.productCommerce button,\s*\.creditPack button\s*\{[^}]*min-height:\s*44px;/,
  );
  assert.match(categoryStyles, /\.commerce button:disabled\s*\{[^}]*opacity:/);
});

test("PROFILE V4 final removes sticky-hover motion on touch layouts while preserving focus semantics", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const touch = styles.slice(styles.indexOf("@media (hover: none)"));

  assert.match(
    touch,
    /\.productCard:hover\s*\{[^}]*transform:\s*none;/,
  );
  assert.match(
    touch,
    /\.collectionBannerCard:hover\s*\{[^}]*transform:\s*none;/,
  );
  assert.match(
    touch,
    /\.heroVisual:hover\s*>\s*img\s*\{[^}]*transform:\s*none;/,
  );
});

test("PROFILE V4 final reduced-motion mode removes interaction lift sweep and busy pulse", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const commerce = await source("src/components/profile/v4/profile-store-commerce.module.css");
  const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  const commerceReduced = commerce.slice(
    commerce.indexOf("@media (prefers-reduced-motion: reduce)"),
  );

  assert.match(
    reduced,
    /\.productCard:hover,[\s\S]*\.productCard:focus-within,[\s\S]*\.collectionBannerCard:hover,[\s\S]*\.collectionBannerCard:focus-within[\s\S]*\{[^}]*transform:\s*none;/,
  );
  assert.match(
    reduced,
    /\.collectionBannerButton::before\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    commerceReduced,
    /\.productCommerce button\[data-processing="true"\]\s*\{[^}]*animation:\s*none;/,
  );
});


test("PROFILE V4 featured collection hero uses the collection bundle offer for direct purchase", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /const featuredCollectionBundleOffer = useMemo\(/);
  assert.match(store, /featuredCollection\.bundleOfferIds/);
  assert.match(store, /storefront\.offers\.find\(\(offer\) => offer\.id === offerId\)/);
  assert.match(
    store,
    /handlePurchase\(featuredCollectionBundleOffer\)/,
  );
  assert.match(
    store,
    /data-processing=\{\s*pendingOfferId === featuredCollectionBundleOffer\.id \? "true" : undefined\s*\}/,
  );
});

test("PROFILE V4 featured collection hero turns the large banner into the showcase entry point", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /className=\{styles\.featuredHeroBanner\}/);
  assert.match(
    store,
    /href=\{showcaseHref\("collection", featuredCollection\.id\)\}/,
  );
  assert.match(
    styles,
    /\.featuredHeroBanner\s*\{[^}]*display:\s*block;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.featuredHeroBanner img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/,
  );
});

test("PROFILE V4 featured collection hero makes the promotion dominant and shows before-after pricing", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /className=\{styles\.featuredPromo\}/);
  assert.match(store, /promotionLabel\(featuredCollection\.promotionDiscountBps\)/);
  assert.match(store, /featuredCollectionBundleOffer\.basePrice/);
  assert.match(store, /featuredCollectionBundleOffer\.price/);
  assert.match(
    styles,
    /\.featuredPromo strong\s*\{[^}]*font-size:\s*clamp\(2\.8rem,\s*6vw,\s*6\.4rem\)/,
  );
  assert.match(
    styles,
    /\.featuredOldPrice\s*\{[^}]*text-decoration:\s*line-through;/,
  );
});

test("PROFILE V4 featured collection hero keeps purchase controls separate from the clickable banner", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(store, /className=\{styles\.featuredHeroCommerce\}/);
  assert.match(store, /COMPRAR COLEÇÃO/);
  assert.match(
    styles,
    /\.featuredHeroCommerce\s*\{[^}]*pointer-events:\s*auto;/,
  );
  assert.match(
    styles,
    /\.featuredHeroCommerce button,\s*\.featuredInspectFallback\s*\{[^}]*min-height:\s*44px;/,
  );
});

test("PROFILE V4 featured collection hero becomes a full-width promotion on desktop and stacks on mobile", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 520px)"));

  assert.match(
    styles,
    /\.featuredHero\s*\{[^}]*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    styles,
    /\.featuredHero\s*\{[^}]*min-height:\s*clamp\(/,
  );
  assert.match(
    styles,
    /\.featuredHeroOverlay\s*\{[^}]*position:\s*absolute;[^}]*inset:/,
  );
  assert.match(
    mobile,
    /\.featuredHeroOverlay\s*\{[^}]*position:\s*relative;/,
  );
  assert.match(
    mobile,
    /\.featuredHeroCommerce\s*\{[^}]*grid-template-columns:\s*1fr;/,
  );
});


test("PROFILE V4 featured hero mobile banner is centered inside a symmetric clipped media container", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 520px)"));

  assert.match(store, /className=\{styles\.featuredHeroMedia\}/);
  assert.match(
    styles,
    /\.featuredHeroMedia\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.featuredHeroBanner\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/,
  );
  assert.match(
    mobile,
    /\.featuredHeroMedia\s*\{[^}]*position:\s*relative;[^}]*width:\s*calc\(100% - 24px\);[^}]*margin-inline:\s*auto;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    mobile,
    /\.featuredHeroBanner img\s*\{[^}]*object-position:\s*center;/,
  );
});


test("PROFILE V4 mobile keeps dice and territory catalogs in two columns while collections stay single-column", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 520px)"));

  assert.match(
    mobile,
    /\.catalogGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    mobile,
    /\.collectionGrid\s*\{[^}]*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    mobile,
    /\.productSelect\s*\{[^}]*grid-template-rows:\s*minmax\(120px,\s*auto\)\s+auto;/,
  );
  assert.match(
    mobile,
    /\.productVisual\s*\{[^}]*min-height:\s*120px;[^}]*padding:\s*8px;/,
  );
});
