# Store Showcase V1 — Implementation Plan

**Date:** 2026-09-16  
**Branch:** `feature/store-showcase-v1`  
**Companion SPEC:** `docs/economy/store/showcase/SPEC.md`  
**Companion EVAL:** `docs/economy/store/showcase/EVAL.md`

## Goal

Replace the current in-page/mobile inspection and collection modal experience with a dedicated, full-screen, no-vertical-scroll Store Showcase that renders dice and territory skins as large exhibition objects while preserving the existing Economy V2 purchase authority.

## Non-goals

- no new wallet, ledger, pricing or ownership rules;
- no new database migration unless implementation proves a presentation requirement cannot be projected from the current storefront snapshot;
- no duplicate showcase-only dice assets;
- no alternate hand-redrawn territory silhouette;
- no gameplay/RNG/physics behavior changes.

## Architecture summary

The implementation adds a pure projection layer between `EconomyStorefrontSnapshot` and a new full-screen client presentation. The route authenticates exactly like the current Store page, loads the existing server-authoritative storefront snapshot, projects one offer/collection into a `StoreShowcaseViewModel`, and renders a client `StoreShowcase` shell.

The 3D layer uses one React Three Fiber Canvas. It reuses the canonical dice geometry/texture pipeline and adds a presentation-only territory extrusion pipeline sourced from `public/war-brasil-42.production.svg`.

The Store discovery page stops opening local inspection/collection overlays and navigates to the showcase route instead.

## Task 1 — Pure showcase projection contract (TDD)

**Create:**
- `src/lib/economy/store-showcase.ts`
- `tests/store-showcase-projection.test.mjs`

### RED

Add tests proving:

1. `offer` target resolves from `EconomyStorefrontSnapshot.offers`;
2. a multi-item normal offer maps each cosmetic to its active single-item offer when available;
3. a single territory offer maps itself as the current item purchase;
4. `collection` target resolves collection background/logo/promotion;
5. collection item offers come only from `singleOfferIds`;
6. collection bundle/completion offer comes from `bundleOfferIds`;
7. selected item defaults to the first item and rejects an unrelated `?item=` value;
8. projected price fields are copied from authoritative `EconomyOffer` values rather than recomputed;
9. unknown kind/id returns `null`;
10. mixed collection preserves item order and cosmetic slot.

### GREEN

Implement pure types/functions:

```ts
export type StoreShowcaseTargetKind = "offer" | "collection";

export type StoreShowcaseItem = Readonly<{
  cosmetic: CosmeticCatalogItem;
  individualOffer: EconomyOffer | null;
}>;

export type StoreShowcaseViewModel = Readonly<{
  kind: StoreShowcaseTargetKind;
  id: string;
  mode: "standard" | "collection";
  title: string;
  description: string | null;
  wallet: CampaignCreditWallet;
  background: string | null;
  logo: string | null;
  promotionDiscountBps: number;
  items: ReadonlyArray<StoreShowcaseItem>;
  selectedItemId: string;
  bundleOffer: EconomyOffer | null;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
}>;
```

Primary helper:

```ts
projectStoreShowcase(storefront, kind, id, selectedItemId?)
```

Do not calculate commercial prices here.

### Verify

Run:

```bash
npm run test:compile
node --test tests/store-showcase-projection.test.mjs
```

## Task 2 — Dedicated route and full-screen shell (TDD)

**Create:**
- `src/app/profile/store/showcase/[kind]/[id]/page.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.module.css`
- `tests/store-showcase-route.test.mjs`
- `tests/store-showcase-layout.test.mjs`

### RED

Add structural tests for:

- authenticated server route;
- `kind` restricted to `offer | collection`;
- `getEconomyStorefront(session.user.id)` reuse;
- invalid projection handled with `notFound()` or safe equivalent;
- showcase root with explicit `100dvh`, `overflow: hidden`, and three-zone grid;
- no dependency on `ProfileShell` inside the showcase route;
- visible back-to-store control;
- semantic current item text outside Canvas;
- bundle CTA contained in the fixed commerce dock.

### GREEN

Implement the route and a presentation-first shell with:

```text
header
showcase viewport
commerce dock
```

Responsive CSS must use both width and height queries. The shell must preserve the stage before descriptive text at constrained heights.

Do not implement 3D yet; use an explicit visual placeholder in the stage so the layout contract can stabilize first.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-route.test.mjs tests/store-showcase-layout.test.mjs
```

## Task 3 — Route Store discovery into showcase and retire old inspection surfaces (TDD)

**Modify:**
- `src/components/profile/v4/profile-store.tsx`
- `src/components/profile/v4/profile-store.module.css`
- `tests/profile-v4-store.test.mjs`
- `tests/economy-storefront-interaction.test.mjs` if its old modal assertions conflict with the approved showcase contract

**Remove when no longer referenced:**
- `src/components/profile/v4/profile-store-mobile-inspection.module.css`
- `src/components/profile/v4/profile-store-collection-modal.module.css`

### RED

Update/add tests requiring:

- normal dice tiles navigate to `/profile/store/showcase/offer/{offerId}`;
- purchasable normal territory skin tiles navigate to offer showcase;
- collection banners and featured collection navigate to `/profile/store/showcase/collection/{collectionId}`;
- old permanent desktop inspection section is absent;
- old mobile inspection dialog is absent;
- old collection modal is absent;
- catalog purchase authority remains server-derived.

### GREEN

Replace `inspect()` and `openCollection()` overlay state with `router.push()` navigation. Remove dead modal state/effects/JSX and CSS imports.

Keep the Store listing itself visually functional; the broader card-to-fluid-store redesign can be polished after the showcase path is stable, but discovery should already stop rendering the old inspection panels.

### Verify

```bash
npm run test:compile
node --test tests/profile-v4-store.test.mjs tests/economy-storefront-interaction.test.mjs
```

## Task 4 — Shared 3D exhibition Canvas, pedestal and interaction controller (TDD)

**Create:**
- `src/components/profile/v4/store-showcase/showcase-canvas.tsx`
- `src/components/profile/v4/store-showcase/showcase-pedestal.tsx`
- `src/components/profile/v4/store-showcase/showcase-object-controller.tsx`
- `src/lib/client/store-showcase/showcase-config.ts`
- `tests/store-showcase-3d-foundation.test.mjs`

### RED

Require:

- one `<Canvas>` for active showcase;
- fixed camera configuration controlled by responsive framing, not OrbitControls;
- stable pedestal mounted outside item-specific model branch;
- standard light mode = neutral/white;
- collection light mode = gold;
- reduced-motion path disables continuous idle rotation;
- direct pointer/touch drag rotates object group, not camera;
- idle rotation resumes after interaction only when reduced motion is false.

### GREEN

Implement a generic controller around the selected model:

```text
ShowcaseCanvas
├── lighting rig
├── pedestal
└── ShowcaseObjectController
    └── selected model
```

Use `useFrame` for slow idle Y rotation. Pointer drag changes model-group yaw/pitch with bounded pitch. Camera transform remains stable.

Set initial mannequin constant in `showcase-config.ts`:

```ts
export const SHOWCASE_TERRITORY_ID = 18;
```

If visual/geometry validation later proves territory 18 unsuitable, change the constant only; no schema changes.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-3d-foundation.test.mjs
```

## Task 5 — Dice showcase using canonical game assets (TDD)

**Create:**
- `src/components/profile/v4/store-showcase/dice-showcase-model.tsx`
- `tests/store-showcase-dice.test.mjs`

**Reuse:**
- `src/lib/client/dice/dice-assets-manager.ts`
- `src/lib/client/dice/textures/create-face-texture.ts`
- `src/components/dice-3d/die-visual.tsx`
- `src/components/dice-3d/use-dice-face-textures.ts`

### RED

Tests require:

- canonical `getSharedRoundedDieGeometry` reused;
- canonical face textures reused;
- `pipColor` forced to near-black in showcase;
- no Rapier/rigid body dependency in showcase model;
- selected cosmetic `assetRef`/preview source used as texture source;
- one primary die model mounted at a time.

### GREEN

Render one large die centered above the pedestal. The die should use an exhibition orientation and slow controller rotation; no roll animation or physics.

If the existing `useDiceFaceTextures` API cannot safely accept the store cosmetic source, minimally generalize that shared hook instead of creating a second texture cache.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-dice.test.mjs tests/dice-3d-foundation.test.mjs tests/cosmetic-dice-presentation.test.mjs
```

## Task 6 — Item navigation and scene-preserving transitions (TDD)

**Modify:**
- `src/components/profile/v4/store-showcase/store-showcase.tsx`
- `src/components/profile/v4/store-showcase/showcase-canvas.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.module.css`

**Create:**
- `tests/store-showcase-navigation.test.mjs`

### RED

Require:

- left/right arrows cycle item selection in declared item order;
- arrows change selected cosmetic, not die face/camera;
- URL query `?item=` is updated without full page reload when practical;
- camera and pedestal stay mounted/stable;
- selected item metadata and individual offer change together;
- reduced-motion uses immediate/minimal transition;
- keyboard arrows/buttons can perform item navigation.

### GREEN

Implement selected-item client state initialized from projected view model. Use a short 250–350ms enter/exit model transform/fade when motion is enabled. Keep one full-detail active model at a time; preloading adjacent texture assets is allowed.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-navigation.test.mjs
```

## Task 7 — Individual purchase and bundle/completion commerce (TDD)

**Modify:**
- `src/components/profile/v4/store-showcase/store-showcase.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.module.css`

**Create:**
- `src/components/profile/v4/store-showcase/showcase-commerce.tsx`
- `tests/store-showcase-purchase.test.mjs`

### RED

Require purchase calls to include:

```json
{
  "offerId": "...",
  "idempotencyKey": "...",
  "expectedPrice": 0
}
```

Tests cover:

- buy current item;
- bundle buy-all;
- completion bundle;
- fully owned disabled state;
- insufficient balance feedback;
- `ECONOMY_PRICE_CHANGED` fail-closed handling;
- `ECONOMY_OFFER_UNAVAILABLE` handling;
- `router.refresh()` or equivalent refresh after success/conflict;
- projected `offer.price` used directly, no client-side discount recomputation.

### GREEN

Extract/reuse the purchase behavior from the existing Store. Preserve wallet/ledger authority and current copy semantics.

The buy-all/completion CTA must be visually dominant and stay in the no-scroll dock at all supported sizes.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-purchase.test.mjs tests/profile-v4-purchase.test.mjs tests/economy-storefront-purchase-pricing.test.mjs
```

## Task 8 — Territory mannequin geometry pipeline (TDD)

**Create:**
- `src/lib/client/store-showcase/territory-showcase-geometry.ts`
- `src/components/profile/v4/store-showcase/territory-showcase-model.tsx`
- `tests/store-showcase-territory-geometry.test.mjs`

### RED

Add deterministic helper tests for:

- canonical source is `/war-brasil-42.production.svg`;
- configured `territory-18` is selected;
- extracted path has non-zero bounds;
- normalized shape is centered around local origin;
- aspect ratio is preserved;
- extrusion depth > 0 and shallow relative to width/height;
- front/back/side geometry exists;
- failure path can return a normalized 2D silhouette fallback descriptor.

### GREEN

Preferred runtime pipeline:

1. fetch canonical SVG text once and cache the promise;
2. `DOMParser` selects `#territory-${SHOWCASE_TERRITORY_ID}`;
3. build a minimal SVG containing the selected path `d`;
4. parse with `SVGLoader` from Three examples;
5. convert parsed path to `Shape` objects;
6. normalize shapes to a local centered coordinate system;
7. generate `ExtrudeGeometry` with shallow depth and minimal/no bevel;
8. rotate geometry into an upright exhibition plane;
9. compute normals/bounds once and cache by mannequin id.

Do not hand-copy the SVG `d` path into TypeScript.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-territory-geometry.test.mjs tests/territory-geometry.test.mjs
```

## Task 9 — Territory skin material on front/back/sides (TDD)

**Create/Modify:**
- `src/components/profile/v4/store-showcase/territory-showcase-model.tsx`
- `src/lib/client/store-showcase/territory-showcase-material.ts`
- `tests/store-showcase-territory-material.test.mjs`

### RED

Require:

- image-based skin uses canonical delivered cosmetic source;
- front/back use skin texture treatment;
- side material is derived from the same skin and is never generic unstyled gray;
- procedural/default skin gets a coherent presentation adapter;
- material failure falls back safely without breaking commerce;
- territory plate uses shared object rotation/drag controller.

### GREEN

For V1 image skins, use the canonical texture on front/back and derive a repeatable side strip or color/material sample from the same source. Perfect continuous UV wrapping is not required.

For procedural skins, implement a small registry adapter that preserves recognizable material semantics without importing gameplay interaction state.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-territory-material.test.mjs tests/territory-skin-renderer.test.mjs
```

## Task 10 — Mixed collection switching and collection environment polish (TDD)

**Modify:**
- `src/components/profile/v4/store-showcase/showcase-canvas.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.tsx`
- `src/components/profile/v4/store-showcase/store-showcase.module.css`

**Create:**
- `tests/store-showcase-collection.test.mjs`

### RED

Require:

- collection background is full-screen environment;
- logo remains identity, not dominant product image;
- gold mode differs from standard light mode;
- mixed collection can navigate die -> territory -> die without route reload;
- background failure falls back to generic tactical environment;
- promotion labels use projected authoritative values;
- Football reference displays 40% promotion and authoritative prices.

### GREEN

Use localized CSS gradients around HUD/dock instead of one opaque global overlay. Scene changes model class based on selected item slot while keeping Canvas/pedestal/camera stable.

### Verify

```bash
npm run test:compile
node --test tests/store-showcase-collection.test.mjs tests/economy-storefront-collection-promotion.test.mjs
```

## Task 11 — Responsive no-scroll viewport contract and accessibility (TDD)

**Create:**
- `tests/e2e/store-showcase-viewport.spec.ts` or integrate into the repository's current Playwright E2E harness if that is the established convention
- `tests/store-showcase-accessibility.test.mjs`

**Modify:**
- showcase CSS/components as required

### RED

Browser matrix:

```text
360x640
390x844
768x1024
1280x720
1366x768
1440x900
1920x1080
```

At each size assert:

- document does not vertically scroll beyond small rendering tolerance;
- back control is visible;
- 3D/fallback stage is the dominant layout region;
- individual CTA is reachable;
- bundle/completion CTA is reachable;
- horizontal item strip may scroll horizontally but does not grow page vertically.

Accessibility tests require:

- semantic current item name/slot/index;
- ownership and price outside Canvas;
- keyboard item navigation;
- keyboard purchase path;
- `prefers-reduced-motion` disables continuous idle motion;
- Canvas can remain `aria-hidden` because semantic equivalent exists.

### GREEN

Tune width and height media queries. For compact-height modes, hide/shorten description first, then compact HUD/dock; do not sacrifice object stage first.

### Verify

Run targeted E2E plus unit/structural tests.

## Task 12 — Store listing visual integration polish

**Modify:**
- `src/components/profile/v4/profile-store.tsx`
- `src/components/profile/v4/profile-store.module.css`

**Create/Modify tests:**
- `tests/profile-v4-store.test.mjs`
- optional `tests/store-showcase-discovery-layout.test.mjs`

### RED

Codify the approved integrated Store direction:

- logical sections remain, but top-level catalog sections do not each require heavy boxed cards;
- collection discovery is banner-led;
- tiles behave as exhibition entry points;
- old inspection/collection modal framing cannot reappear;
- featured collection retains promotion prominence.

### GREEN

Reduce redundant panel borders/backgrounds, keep section rhythm via spacing/type/dividers, and preserve existing information architecture.

### Verify

```bash
npm run test:compile
node --test tests/profile-v4-store.test.mjs tests/store-showcase-discovery-layout.test.mjs
```

## Task 13 — Full verification and cleanup

### Remove dead code

Delete old modal-only CSS/components/state after confirming no imports remain.

### Run full gates

```bash
npm run lint
npm test
npm run test:db
npm run build
```

Run the repository's existing Store/Economy browser E2E and the new showcase viewport E2E.

### Required final regression evidence

- canonical 3D game dice tests remain green;
- Economy purchase/pricing tests remain green;
- Store collection promotion tests remain green;
- territory-skin renderer tests remain green;
- no DB migration was added unless separately justified and reviewed;
- `feature/store-showcase-v1` remains based on current `dev` or is rebased/back-merged before PR readiness.

## Expected implementation sequence

```text
projection
→ route/layout
→ storefront navigation cutover
→ shared 3D stage
→ dice model
→ item navigation
→ commerce
→ territory extrusion
→ territory material
→ collection mixed-mode polish
→ viewport/accessibility E2E
→ storefront visual polish
→ full regression verification
```

Each task follows RED → GREEN → REFACTOR. Do not skip a failing-test observation before implementation of that task.
