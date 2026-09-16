# Store Showcase V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen, no-scroll military/futuristic Store Showcase for normal dice sets, collections, and territory skins using the existing authoritative Economy/Storefront model and canonical 3D dice/map assets.

**Architecture:** Add a dedicated `/profile/store/showcase/[kind]/[id]` route that projects the existing storefront snapshot into a focused showcase DTO. Render one persistent full-screen shell with one React Three Fiber canvas; switch only the active showcase model (die or territory plate), environment, lighting and commerce state. Reuse existing dice geometry/texture primitives, derive one fixed mannequin territory from the canonical map SVG, and keep all pricing/purchase authority in the existing economy service.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, React Three Fiber 9.7, Three.js 0.185, existing Economy V2 services, Node test runner, Playwright-style E2E harnesses already in the repository.

**Spec:** `docs/economy/store/showcase/SPEC.md`

## Global Constraints

- Supported showcase viewport minimum: `360 x 640 CSS px`.
- Showcase must fit inside `100dvh` with no vertical document scrolling on supported viewports.
- Layout has exactly three primary zones: header, stage, commerce/navigation dock.
- Preserve server-authoritative pricing, `expectedPrice`, idempotency, ownership and completion semantics.
- Normal offers use generic tactical environment with white/neutral exhibition lighting.
- Collections use their canonical `background` full-screen plus gold/premium exhibition lighting.
- Dice reuse canonical shared geometry and canonical face-texture generation; showcase pips are black/near-black.
- Showcase motion manipulates the object, not the camera; reduced-motion disables continuous motion.
- Territory skins use one fixed code-configured mannequin territory derived from `/war-brasil-42.production.svg#territory-{id}`.
- Territory mannequin has shallow 3D depth and skin-consistent front/back/sides.
- No migration is introduced solely for presentation decisions.

---

### Task 1: Showcase projection and route contract

**Files:**
- Create: `src/lib/economy/store-showcase.ts`
- Create: `src/app/profile/store/showcase/[kind]/[id]/page.tsx`
- Test: `tests/store-showcase-contract.test.mjs`

**Interfaces:**
- Consumes: `EconomyStorefrontSnapshot`, `EconomyOffer`, `StorefrontCollection` from `src/lib/economy/economy-contract.ts`.
- Produces: `StoreShowcaseView`, `resolveStoreShowcaseView(storefront, kind, id, selectedItemId?)`.

- [ ] **Step 1: Write the failing contract test** asserting `offer` and `collection` resolution, safe invalid-target behavior, selected-item fallback, individual/bundle offer lookup, and mixed `dice_*`/`territory_skin` item classification.
- [ ] **Step 2: Run** `npm run test:run -- --test-name-pattern="store showcase contract"` and verify RED because `store-showcase.ts`/route do not exist.
- [ ] **Step 3: Implement minimal projection types and resolver** with no pricing recomputation; copy authoritative `offer.price`, `offer.basePrice`, ownership and promotion fields.
- [ ] **Step 4: Add the authenticated server route** following the existing `/profile/store/page.tsx` session/profile/economy loading pattern; invalid kind/id returns `notFound()` or a safe unavailable state with no purchase CTA.
- [ ] **Step 5: Re-run targeted test and `npm run test:compile`**; both must pass.
- [ ] **Step 6: Commit** `feat(store): add showcase route contract`.

### Task 2: Full-screen responsive showcase shell

**Files:**
- Create: `src/components/profile/v4/store-showcase/store-showcase.tsx`
- Create: `src/components/profile/v4/store-showcase/store-showcase.module.css`
- Modify: `src/app/profile/store/showcase/[kind]/[id]/page.tsx`
- Test: `tests/store-showcase-layout.test.mjs`

**Interfaces:**
- Consumes: `StoreShowcaseView` from Task 1.
- Produces: `StoreShowcase` client component with header/stage/dock zones and semantic current-item state.

- [ ] **Step 1: Write failing structural/layout tests** for `100dvh`, `overflow:hidden`, three-zone shell, compact/portrait media queries, visible bundle CTA and horizontally constrained item strip.
- [ ] **Step 2: Run targeted test** and verify RED on missing component/styles.
- [ ] **Step 3: Implement shell** with semantic HTML, keyboard-accessible item buttons, browser-back control, wallet/price labels and purchase placeholders wired only to existing projected data.
- [ ] **Step 4: Add CSS** using dynamic viewport height, `minmax(0, ...)`, height-sensitive media queries and no vertical root overflow; description collapses before stage.
- [ ] **Step 5: Run targeted test, compile and lint**.
- [ ] **Step 6: Commit** `feat(store): add full-screen showcase shell`.

### Task 3: Storefront entry points and removal of permanent desktop inspection

**Files:**
- Modify: `src/components/profile/v4/profile-store.tsx`
- Modify: `src/components/profile/v4/profile-store.module.css`
- Modify/Delete usage: `src/components/profile/v4/profile-store-mobile-inspection.module.css`
- Test: `tests/profile-v4-store.test.mjs`

**Interfaces:**
- Consumes: showcase route contract from Task 1.
- Produces: normal dice-set tiles, territory tiles, collection banners and featured hero navigate to dedicated showcase route.

- [ ] **Step 1: Add failing tests** proving clicks/links target `/profile/store/showcase/offer/...` and `/profile/store/showcase/collection/...`, and old permanent desktop inspection is absent.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Replace in-page inspection flow** with route navigation while preserving direct purchase buttons only where explicitly retained by the Store SPEC; collection banners/hero navigate to collection showcase.
- [ ] **Step 4: Remove dead permanent inspection presentation rules/components without touching economy logic**.
- [ ] **Step 5: Run profile/store tests, compile and lint**.
- [ ] **Step 6: Commit** `refactor(store): route inspection into showcase`.

### Task 4: Shared showcase canvas and exhibition controls

**Files:**
- Create: `src/components/profile/v4/store-showcase/showcase-canvas.tsx`
- Create: `src/components/profile/v4/store-showcase/showcase-pedestal.tsx`
- Create: `src/components/profile/v4/store-showcase/showcase-object-controller.tsx`
- Create: `src/lib/client/store-showcase/showcase-motion.ts`
- Test: `tests/store-showcase-3d.test.mjs`

**Interfaces:**
- Produces: `ShowcaseCanvas`, `ShowcasePedestal`, deterministic motion helpers for idle/manual orientation and transition direction.

- [ ] **Step 1: Write failing tests** asserting the showcase canvas contains no Rapier dependency, keeps a fixed camera configuration, exposes normal/collection lighting modes, reduced-motion configuration, and stable pedestal identity across item switches.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement one persistent R3F Canvas** with responsive camera framing, demand/continuous frame strategy appropriate to idle rotation, white vs gold lighting rig and low-profile pedestal.
- [ ] **Step 4: Implement object manipulation state**: pointer/touch drag changes object rotation; idle Y rotation pauses during interaction and resumes after inactivity; reduced motion disables idle rotation.
- [ ] **Step 5: Run targeted tests, compile and lint**.
- [ ] **Step 6: Commit** `feat(store): add showcase 3d stage`.

### Task 5: Canonical dice showcase model

**Files:**
- Create: `src/components/profile/v4/store-showcase/dice-showcase-model.tsx`
- Reuse/modify if needed: `src/components/dice-3d/die-visual.tsx`
- Reuse: `src/lib/client/dice/dice-assets-manager.ts`
- Reuse: `src/lib/client/dice/textures/create-face-texture.ts`
- Test: `tests/store-showcase-dice.test.mjs`

**Interfaces:**
- Consumes: item `assetRef`, dice slot/skin fallback and shared showcase rotation controller.
- Produces: one die model using canonical geometry/textures and `pipColor="#0b0b0b"`.

- [ ] **Step 1: Write failing tests** proving canonical geometry/texture helpers are reused, no showcase-only cube geometry exists, black pip color is supplied, and Rapier/gameplay roll stage is not used.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement dice showcase model** with large exhibition scale, shadows and canonical `DieVisual`.
- [ ] **Step 4: Integrate item transitions** so arrows switch attack/defense/neutral while camera/pedestal remain stable.
- [ ] **Step 5: Run tests, compile and lint**.
- [ ] **Step 6: Commit** `feat(store): render canonical dice in showcase`.

### Task 6: Collection environment and premium presentation

**Files:**
- Modify: `src/components/profile/v4/store-showcase/store-showcase.tsx`
- Modify: `src/components/profile/v4/store-showcase/store-showcase.module.css`
- Modify: `src/components/profile/v4/store-showcase/showcase-canvas.tsx`
- Test: `tests/store-showcase-collection.test.mjs`

**Interfaces:**
- Consumes: collection `background`, `logo`, `promotionDiscountBps`, ownership counts.
- Produces: full-screen collection visual mode with localized overlays and gold scene state.

- [ ] **Step 1: Write failing tests** for full-screen background usage, collection logo/discount semantics, gold mode and generic fallback when background unavailable.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement collection background layer** with localized gradients instead of one opaque full-screen overlay.
- [ ] **Step 4: Wire premium lighting state** and collection identity without changing item/bundle pricing.
- [ ] **Step 5: Run targeted tests, compile and lint**.
- [ ] **Step 6: Commit** `feat(store): add collection showcase environment`.

### Task 7: Canonical territory mannequin geometry

**Files:**
- Create: `src/lib/client/store-showcase/territory-showcase-config.ts`
- Create: `src/lib/client/store-showcase/territory-geometry.ts`
- Create: `src/components/profile/v4/store-showcase/territory-showcase-model.tsx`
- Test: `tests/store-showcase-territory.test.mjs`

**Interfaces:**
- Produces: `SHOWCASE_TERRITORY_ID`, geometry normalization/extrusion helpers, `TerritoryShowcaseModel`.

- [ ] **Step 1: Write failing tests** for one fixed mannequin ID, canonical SVG source reference, non-zero bounds, centered normalized output, preserved aspect ratio, non-zero shallow depth and no hand-redrawn polygon source.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement canonical SVG path loading/conversion** using Three.js SVG utilities available from the installed `three` package; normalize geometry to local origin and stable showcase scale.
- [ ] **Step 4: Extrude shallow plate geometry** with front/back/side material groups and optional minimal bevel only if silhouette remains stable.
- [ ] **Step 5: Integrate upright slow rotation/drag through the shared controller**.
- [ ] **Step 6: Run targeted tests, compile and lint**.
- [ ] **Step 7: Commit** `feat(store): add 3d territory mannequin`.

### Task 8: Territory skin material adapter and mixed collections

**Files:**
- Create: `src/lib/client/store-showcase/territory-showcase-material.ts`
- Modify: `src/components/profile/v4/store-showcase/territory-showcase-model.tsx`
- Modify: `src/components/profile/v4/store-showcase/store-showcase.tsx`
- Test: `tests/store-showcase-mixed-collection.test.mjs`

**Interfaces:**
- Consumes: image/procedural territory skin representation.
- Produces: front/back skin material and side material derived from the same skin; model switching by cosmetic slot.

- [ ] **Step 1: Write failing tests** proving image skins style front/back/sides, procedural skins have coherent adapter/fallback, and a mixed collection switches die → territory → die without route reload.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement image material adapter** with canonical image on front/back and generated/repeated side strip or derived side texture/material.
- [ ] **Step 4: Implement procedural adapter/fallback** without coupling to gameplay state.
- [ ] **Step 5: Route model selection by slot** within the same canvas/shell.
- [ ] **Step 6: Run targeted tests, compile and lint**.
- [ ] **Step 7: Commit** `feat(store): support mixed showcase collections`.

### Task 9: Purchase flow inside showcase

**Files:**
- Modify: `src/components/profile/v4/store-showcase/store-showcase.tsx`
- Create: `src/components/profile/v4/store-showcase/showcase-commerce.tsx`
- Reuse: `/api/economy/purchases`
- Test: `tests/store-showcase-commerce.test.mjs`
- Integration/E2E: extend `scripts/e2e/economy-e2e.mjs`

**Interfaces:**
- Uses existing purchase payload `{ offerId, idempotencyKey, expectedPrice }`.
- Produces: individual purchase and dominant bundle/completion CTA with in-place refresh.

- [ ] **Step 1: Write failing tests** for individual CTA states, bundle/completion CTA states, expectedPrice/idempotency payload, 409 price-change fail-closed behavior and ownership refresh.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement commerce component** without client-side price recomputation.
- [ ] **Step 4: Refresh route/storefront projection after success/conflict** while preserving selected item when still valid.
- [ ] **Step 5: Extend Economy E2E** for one individual purchase and one completion purchase from showcase.
- [ ] **Step 6: Run targeted unit/integration tests, compile and lint**.
- [ ] **Step 7: Commit** `feat(store): enable showcase purchases`.

### Task 10: Accessibility, fallbacks and viewport EVAL

**Files:**
- Modify: showcase components/styles as needed
- Create/extend: `scripts/e2e/store-showcase-e2e.mjs`
- Modify: CI workflow only if the existing E2E runner requires an explicit command registration
- Test: `tests/store-showcase-accessibility.test.mjs`

**Interfaces:**
- Produces: keyboard-complete semantic mirror, reduced-motion behavior, no-WebGL fallback and viewport evidence.

- [ ] **Step 1: Write failing tests** for semantic current-item state, keyboard navigation, reduced-motion classes/config and 2D fallbacks.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement semantic/fallback behavior**; canvas may remain `aria-hidden` when HTML state fully mirrors it.
- [ ] **Step 4: Build E2E viewport matrix** for `360x640`, `390x844`, `768x1024`, `1280x720`, `1366x768`, `1440x900`, `1920x1080`; assert no vertical document scroll, visible primary CTA and dominant stage.
- [ ] **Step 5: Add no-WebGL/reduced-motion E2E paths** and verify commerce/navigation remain functional.
- [ ] **Step 6: Run all showcase tests plus `npm test`, `npm run lint`, `npm run build`, relevant DB tests and Economy E2E**.
- [ ] **Step 7: Commit** `test(store): verify showcase eval contract`.

## Final verification

- [ ] Map every `SHOWCASE-01` through `SHOWCASE-40` gate to automated evidence or a documented visual/manual criterion where automation is inappropriate.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:db`.
- [ ] Run `npm run build`.
- [ ] Run Economy/showcase E2E.
- [ ] Confirm no production migration is introduced by this presentation-only feature.
- [ ] Run final diff review for duplicate dice geometry, client-side pricing math, accidental gameplay coupling and scroll regressions.
