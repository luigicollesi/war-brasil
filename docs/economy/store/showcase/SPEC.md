# War Brasil — Store Showcase / Inspection SPEC

Status: **draft for review**  
Scope: full-screen store inspection/showcase experience for dice sets, collections and territory skins.

## 1. Authority

This document specializes `docs/economy/store/SPEC.md` for the user-facing inspection/showcase experience.

The following authorities remain unchanged:

- `docs/economy/SPEC.md`: wallet, ledger, ownership, authentication, auditability and authoritative purchase rules;
- `docs/economy/store/SPEC.md`: products, offers, collections, pricing, campaigns and merchandising assets;
- `docs/economy/territory-skins/SPEC.md`: territory-skin identity, delivery and gameplay rendering constraints.

When this document conflicts with the current store presentation, this document governs the new showcase/inspection experience only. It must not redefine ownership, bundle math or pricing authority.

## 2. Goal

Replace the current card-centric inspection experience with a full-screen military/futuristic exhibition surface where the owned/purchasable cosmetic is the visual protagonist.

The showcase must:

1. occupy the full supported viewport without vertical page scrolling;
2. present dice as large interactive 3D objects on a light pedestal;
3. present territory skins on one fixed 3D mannequin territory plate;
4. reuse the canonical dice and territory assets already used by the game;
5. allow item-level purchase and set/collection completion without leaving the showcase;
6. use a generic tactical exhibition environment for ordinary products;
7. use the collection `background` as the complete environment for collection showcases;
8. use white lighting for ordinary products and gold/premium lighting for collections;
9. adapt layout and camera framing to viewport size before shrinking the showcased object;
10. preserve server-authoritative pricing, `expectedPrice`, ownership and completion semantics.

## 3. Product principle

The showcase is not a conventional store detail page.

The design principle is:

> **The cosmetic is the protagonist; the interface only frames, identifies and acquires it.**

The screen must feel closer to a military equipment exhibition bay than to an ecommerce product page.

## 4. Navigation model

### 4.1 Dedicated route

Inspection uses a dedicated full-screen route rather than the current permanent desktop inspection panel or a small modal.

Canonical route shape:

```text
/profile/store/showcase/[kind]/[id]
```

Supported `kind` values in V1:

```text
offer
collection
```

Examples:

```text
/profile/store/showcase/offer/offer.simple-silver
/profile/store/showcase/collection/collection.football
```

An optional selected item may be reflected in the URL query:

```text
?item=dice.attack.simple-silver
```

The route must remain valid when the selected item parameter is absent; the first valid showcase item becomes selected.

### 4.2 Entry points

The Storefront opens the showcase when the user activates:

- a normal dice-set tile;
- a normal territory-skin tile;
- a collection banner;
- the featured collection hero.

Collection-owned cosmetics remain excluded from the normal catalog grids according to the parent Store SPEC.

### 4.3 Exit

A visible `Voltar à Intendência` / back control returns to the Storefront and should preserve normal browser-history semantics.

## 5. Full-screen layout contract

### 5.1 No vertical page scroll

For supported viewports, the showcase root must fit within:

```text
100dvh
```

The document body must not require vertical scrolling while the showcase is active.

Official V1 minimum supported viewport:

```text
360 x 640 CSS px
```

If vertical space becomes constrained, the UI must remove or compress secondary information before materially shrinking the 3D stage.

Priority order:

```text
1. showcased object
2. purchase actions
3. item navigation
4. item identity
5. descriptive copy
```

Descriptive paragraphs are the first content allowed to collapse or disappear in compact-height layouts.

### 5.2 Layout zones

The screen contains exactly three primary zones:

```text
header
showcase stage
commerce/navigation dock
```

Desktop target proportions are approximately:

```text
header:   5–8% of viewport height
stage:    70–78%
dock:     14–20%
```

These values are framing targets, not hard-coded pixel requirements.

### 5.3 Responsive modes

Layout selection must account for both width and available height.

#### Wide

Typical examples:

```text
1920x1080
1440x900
```

Behavior:

- large central stage;
- item identity/purchase HUD may sit to the right of the stage;
- bottom dock remains compact;
- object receives the majority of usable visual area.

#### Compact desktop

Typical examples:

```text
1366x768
1280x720
```

Behavior:

- header and dock become denser;
- descriptive copy is reduced;
- stage remains dominant;
- no page scroll is introduced.

#### Portrait/mobile

Typical examples:

```text
390x844
360x640
768x1024
```

Behavior:

- stage occupies the upper/middle majority;
- side HUD moves below the stage;
- item strip/bundle CTA remains within the same `100dvh` frame;
- the page still does not vertically scroll;
- if item count exceeds available width, only the item strip may scroll horizontally.

## 6. Shared showcase shell

The page uses a single presentation shell for normal offers and collections.

Conceptual component boundaries:

```text
StoreShowcasePage
├── ShowcaseHeader
├── ShowcaseViewport
│   ├── ShowcaseCanvas
│   │   ├── ShowcaseLightingRig
│   │   ├── ShowcasePedestal
│   │   └── ShowcaseObject
│   │       ├── DiceShowcaseModel
│   │       └── TerritoryShowcaseModel
│   └── ShowcaseItemHud
└── ShowcaseCommerceDock
    ├── ShowcaseItemStrip
    ├── ItemPurchaseAction
    └── BundlePurchaseAction
```

A single React Three Fiber `<Canvas>` should be preferred for the active screen. Changing item type should swap the showcased model and lighting state rather than remounting the full page.

## 7. Normal showcase mode

Normal products use a generic War Brasil military/futuristic exhibition environment.

Required visual traits:

- very dark green/graphite tactical background;
- restrained technical grid/atmospheric detail;
- white/neutral key light;
- white illuminated pedestal ring;
- readable ivory UI text;
- brass/gold reserved for economy/value emphasis rather than bathing the whole scene.

The normal environment must not require a new image asset per product.

## 8. Collection showcase mode

### 8.1 Background

A collection uses its canonical `background` editorial asset as the full-screen environment.

The background must fill the visual screen, not remain trapped inside a card or small modal.

Darkening must be localized rather than implemented as one opaque full-screen black layer. Recommended treatment:

- localized gradient behind text/HUD;
- lower gradient behind commerce controls;
- subtle top vignette;
- minimal interference behind the showcased 3D object.

The collection artwork should remain explicitly recognizable.

### 8.2 Identity

Collection mode may display:

- collection logo;
- collection name;
- owned/total progress;
- promotion badge;
- current item type/name.

The logo is identity, not the main content. The showcased cosmetic remains visually dominant.

### 8.3 Premium lighting

Collection mode uses a premium gold lighting rig:

- gold pedestal emission;
- gold lower key/fill;
- gold rim/back light around the object;
- optional restrained volumetric-like glow implemented without requiring real volumetric rendering;
- optional subtle dust/light particles when performance budget allows.

The effect must remain legible over all collection backgrounds.

## 9. Dice showcase

### 9.1 Reuse of canonical game renderer

The showcase must reuse the current dice asset pipeline instead of constructing a second cosmetic representation.

Reusable foundations include:

```text
getSharedRoundedDieGeometry
getDiceFaceTextures
createDiceFaceTexture
DieVisual / equivalent shared visual primitive
DICE_FACE_DEFINITIONS
```

The combat physics/Rapier stage must not be required for store inspection.

A dedicated showcase scene controls orientation, auto-rotation, lighting and transitions deterministically.

### 9.2 Face textures and pips

The cosmetic `assetRef` remains the canonical base texture source.

All six die faces are generated through the existing canvas face-texture pipeline.

Showcase dice force black pips:

```text
pipColor = black / near-black
```

No duplicate showcase-only dice images are required.

### 9.3 Idle motion

A die slowly rotates around its vertical axis while idle.

Target feel:

```text
~6–10 seconds per complete revolution
```

The exact duration may be tuned visually.

The movement must be smooth and exhibition-like, not resemble a gameplay roll.

### 9.4 Direct manipulation

Pointer/touch drag rotates the currently displayed 3D object for inspection.

Rules:

- camera remains effectively fixed;
- user manipulates the object, not an orbiting camera rig;
- idle rotation pauses during direct interaction;
- idle rotation resumes smoothly after a short inactivity delay;
- reduced-motion mode disables continuous automatic rotation.

### 9.5 Item navigation arrows

Left/right navigation arrows switch the showcased cosmetic within the set/collection.

They do **not** rotate the camera and do **not** exist primarily to select die faces.

Transition behavior:

1. current model exits slightly toward the navigation direction with fade/rotation;
2. next model enters from the opposite direction;
3. pedestal and camera remain stationary;
4. selected item state and purchase action update atomically with the visual transition.

Target transition duration:

```text
250–350ms
```

## 10. Pedestal

The pedestal is a permanent spatial anchor shared across showcased items.

V1 visual form:

- thin circular or low-profile geometric base;
- illuminated emissive ring;
- soft receive-shadow surface;
- subtle upward light cone/halo without a large physical structure.

The pedestal must not occupy enough vertical area to force the showcased object to become small.

Changing items should leave the pedestal in place.

Changing from a die to a territory plate may smoothly transition pedestal lighting but should not replace the entire environment.

## 11. Territory mannequin showcase

### 11.1 Fixed mannequin territory

V1 uses one fixed territory shape as a material mannequin.

The mannequin territory is presentation-only and is not a catalog identity or game state.

It must be configured in code/shared presentation configuration, for example:

```text
SHOWCASE_TERRITORY_ID
```

No database column is required solely to choose the mannequin territory.

The selected mannequin should have a visually useful silhouette with enough width and shape variation to communicate the skin material.

### 11.2 Geometry source

The mannequin must derive from the canonical map SVG used by the game:

```text
/war-brasil-42.production.svg#territory-{id}
```

The implementation must not create a hand-redrawn duplicate path.

The existing territory-card technique proves the canonical path can be isolated independently of its map position by measuring/normalizing its bounding box.

For 3D rendering, a showcase geometry helper must:

1. locate/extract the configured canonical territory path;
2. normalize the path's original map-space bounds;
3. convert it to a Three.js-compatible shape;
4. center it around a local origin;
5. normalize scale for the showcase stage;
6. extrude it to a shallow 3D plate.

### 11.3 Plate geometry

The territory mannequin is a shallow physical plate rather than a flat plane.

Required traits:

- front and back preserve the territory silhouette;
- shallow visible depth;
- optional minimal bevel only if it does not materially distort the silhouette;
- centered origin suitable for rotation around the vertical axis;
- upright exhibition pose.

Depth must be visually noticeable when viewed obliquely but remain much smaller than plate width/height.

### 11.4 Territory-skin material

The displayed `territory_skin` must visually wrap the plate rather than style only a flat front.

V1 minimum:

- front uses the canonical skin representation;
- back uses the same or intentionally equivalent skin treatment;
- extruded side uses a material derived from the same skin, not generic gray/black.

For image-based skins, the side may use a generated/repeated strip derived from the source texture rather than requiring perfect continuous UV correspondence with the front.

For procedural skins, a showcase-specific material adapter may reproduce the same semantic visual treatment without affecting gameplay rendering code.

The showcase must not redefine territory ownership color or gameplay interaction rules because the mannequin is presentation-only.

### 11.5 Motion

The territory plate:

- stands upright on/above the pedestal;
- begins at a slight readable angle rather than exact edge-on/front-on alignment;
- slowly rotates around its local vertical axis;
- supports pointer/touch drag using the same interaction model as dice;
- clearly reveals shallow depth during rotation.

## 12. Mixed collections

Collections may contain dice, territory skins or both.

The same showcase route and shell must handle mixed contents.

Selecting an item switches `ShowcaseObject` by cosmetic slot:

```text
dice_attack / dice_defense / dice_neutral -> DiceShowcaseModel
territory_skin                            -> TerritoryShowcaseModel
```

The camera, pedestal and shell remain stable while the model implementation changes.

No full page navigation is required when moving between items inside one collection.

## 13. Commerce interaction

### 13.1 Current item purchase

The currently selected item exposes its individual product/offer when one exists.

Required states:

- purchasable;
- owned;
- equipped;
- unavailable/no active individual offer.

The individual purchase control sits visually close to the displayed item information or immediately below the pedestal/HUD depending on responsive mode.

### 13.2 Buy-all / completion CTA

When a bundle/completion offer exists, the set/collection CTA is the strongest commerce action on the screen.

It remains visible without vertical scrolling.

Required semantics:

```text
0 owned -> Comprar conjunto / Comprar coleção
partial -> Completar conjunto / Completar coleção
all owned -> Coleção completa / Conjunto completo
```

The price shown must be the authoritative Storefront price already produced by the existing pricing system.

Collection promotions such as Football 40% OFF remain layered after normal bundle pricing according to the parent Store SPEC.

### 13.3 Purchase protocol

All purchase requests continue to use:

- `offerId`;
- idempotency key;
- `expectedPrice`;
- server-side price recomputation;
- atomic wallet/ledger/inventory behavior.

The showcase is only another presentation surface over the existing economy protocol.

### 13.4 Price-change behavior

If the server returns a price-change conflict:

- no local optimistic ownership is committed;
- new authoritative price is displayed;
- user must explicitly confirm again;
- stage remains on the same selected cosmetic where possible.

## 14. Item strip

The commerce dock includes a compact item navigator for the current set/collection.

Each entry communicates at minimum:

- item type/slot;
- selected state;
- owned state;
- equipped state where relevant.

The strip must not compete visually with the 3D object.

On narrow viewports only this strip may use horizontal overflow scrolling.

Vertical scrolling of the page is still prohibited.

## 15. Camera and framing

### 15.1 Fixed-camera principle

The experience should appear to replace/manipulate equipment on one exhibition platform.

Therefore:

- navigation between items does not move the camera;
- object inspection is model rotation, not orbit-camera rotation;
- camera framing may adapt when switching model classes or viewport sizes, but not as a user-visible navigation gimmick.

### 15.2 Adaptive framing

Object scale/camera distance/FOV must respond to available stage dimensions.

The implementation should derive framing from:

- stage width;
- stage height;
- object bounding dimensions;
- model class (`dice` vs `territory`).

The objective is consistent **visual occupancy**, not fixed world-unit size.

Target visual occupancy:

- die: roughly 35–48% of total viewport height in common desktop layouts;
- territory plate: roughly 42–55% where silhouette permits.

These are visual tuning ranges, not strict test pixels.

## 16. Motion and accessibility

### 16.1 Reduced motion

When `prefers-reduced-motion: reduce` is active:

- continuous idle rotation is disabled;
- item swaps use minimal fade or immediate replacement;
- essential controls remain fully usable;
- no purchase action depends on animation completion.

### 16.2 Keyboard

At minimum:

- back control is keyboard reachable;
- previous/next item controls are keyboard reachable;
- current item purchase is keyboard reachable;
- buy-all/completion CTA is keyboard reachable;
- item strip entries are keyboard reachable;
- selected/owned states are available through semantic labels.

Keyboard navigation must not require WebGL pointer interaction.

### 16.3 Screen reader

The WebGL canvas is visual presentation and may remain hidden from accessibility APIs if equivalent semantic item information is exposed in HTML.

Semantic HTML must announce:

- current item;
- item position within set/collection;
- price;
- ownership state;
- collection promotion where applicable;
- purchase result/error.

## 17. Performance

### 17.1 One active 3D model

V1 renders one primary showcased model at rest.

During the short item-navigation transition, only the current model and the explicit target model may be mounted simultaneously. As soon as the transition settles, the outgoing model must be unmounted so the steady state returns to one high-detail model.

Do not keep every collection item as a live high-detail 3D model behind the scenes.

### 17.2 Asset reuse and cache

Dice geometry/face texture caches must be reused.

The current item is high priority. Adjacent previous/next item textures may be prefetched opportunistically.

Collection background/logo should load through existing stable delivery paths.

### 17.3 Render loop

Continuous rendering is justified only while:

- idle rotation is active;
- user is dragging;
- an item transition is running;
- an explicitly animated light effect requires it.

When reduced-motion/static states allow, the scene should avoid unnecessary continuous work.

### 17.4 Device fallback

If WebGL/Three rendering is unavailable or fails:

- dice degrade to the existing canonical 2D cosmetic preview;
- territory skin degrades to a normalized 2D mannequin path using the canonical SVG geometry;
- all commerce controls remain functional;
- fallback does not change prices or ownership behavior.

## 18. Error handling

### 18.1 Cosmetic asset failure

A failed remote cosmetic asset must:

- degrade to the existing safe/procedural fallback where one exists;
- retain semantic item identity;
- never cause a different item to be purchased accidentally.

### 18.2 Collection background failure

Collection mode falls back to the generic tactical environment while retaining collection logo/name/commerce data where available.

### 18.3 Territory geometry failure

If mannequin geometry cannot be generated:

- use normalized 2D canonical territory path;
- do not substitute an unrelated hand-authored shape;
- keep purchase functionality available.

## 19. Data contract

The showcase should consume the existing storefront read model wherever practical.

A specialized projection may be introduced for routing/server loading, but it must derive from canonical products/offers/collections rather than duplicating commercial state.

Conceptually:

```ts
type StoreShowcaseSnapshot = {
  mode: "offer" | "collection";
  title: string;
  description: string | null;
  background: string | null;
  logo: string | null;
  promotionDiscountBps: number;
  items: readonly StoreShowcaseItem[];
  bundleOffer: EconomyOffer | null;
};

type StoreShowcaseItem = {
  cosmeticId: string;
  slot: CosmeticSlot;
  name: string;
  assetRef: string | null;
  owned: boolean;
  equipped: boolean;
  singleOffer: EconomyOffer | null;
};
```

This is a semantic contract, not a mandatory exact TypeScript shape.

## 20. No new database requirement by default

The V1 showcase must not require a migration solely for:

- choosing the mannequin territory;
- lighting mode;
- pedestal style;
- black showcase pips;
- camera framing;
- auto-rotation timing.

These are presentation concerns.

A database change is justified only if implementation discovers missing persistent commercial/catalog information that cannot be derived from current products, offers, cosmetics or collection assets.

## 21. Storefront integration

The Storefront remains a discovery/browsing surface.

The new flow becomes:

```text
Storefront
  -> select set / territory / collection
  -> full-screen showcase
  -> inspect item(s)
  -> purchase item or bundle/completion
  -> remain in showcase with refreshed ownership
  -> return to Storefront
```

The old permanent desktop `INSPEÇÃO // CATÁLOGO` panel is no longer part of the target design once the showcase route is implemented.

A small-modal-only inspection flow is also not the target for desktop or mobile.

## 22. Visual non-goals

V1 does not require:

- a free-flying camera;
- physics-driven dice rolling;
- arbitrary mannequin territory selection;
- full-map 3D rendering;
- ray-traced/volumetric rendering;
- custom 3D models authored outside the canonical dice/map pipelines;
- collection-specific pedestal models;
- separate 3D scene per cosmetic.

## 23. Implementation boundaries

Implementation should prefer focused modules rather than growing the existing `ProfileStore` component.

Expected separation:

```text
storefront browsing
showcase routing/data projection
3D stage infrastructure
dice showcase model
territory mannequin geometry/materials
commerce dock/actions
responsive layout
```

Game combat dice code and territory gameplay rendering should expose/reuse primitives where helpful, but store-specific camera/lighting/animation concerns must not leak back into gameplay rules.

## 24. Acceptance summary

The design is implemented when a user can, without page scrolling:

1. open a normal dice set and see a large canonical 3D die rotating over a white-lit pedestal;
2. drag the die to inspect it;
3. switch between set items while camera/pedestal remain fixed;
4. buy the current item or complete/buy the set;
5. open a collection and see its background fill the screen with gold exhibition lighting;
6. switch through collection items, including mixed dice and territory skins;
7. see a territory skin rendered on a shallow upright 3D plate built from one canonical map territory path;
8. buy the current item or collection completion offer using the existing authoritative economy protocol;
9. receive a usable responsive experience from 360x640 upward without vertical page scrolling;
10. retain functional 2D fallbacks when 3D rendering is unavailable.
