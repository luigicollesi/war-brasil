# War Brasil — Store Showcase / Inspection EVAL

Status: **draft evaluation contract for review**  
Companion SPEC: `docs/economy/store/showcase/SPEC.md`

## 1. Purpose

This EVAL defines acceptance gates for the full-screen Store Showcase described in the companion SPEC.

It supplements:

- `docs/economy/EVAL.md`;
- `docs/economy/store/EVAL.md`;
- `docs/economy/territory-skins/EVAL.md`.

Wallet, ledger, purchase atomicity, `expectedPrice`, ownership and pricing gates from the parent EVALs remain mandatory.

A blocker failure means the showcase update is not ready to merge.

## 2. Evidence policy

Prefer deterministic automated coverage for routing, data projection, pricing integration, state transitions and geometry helpers.

Use targeted browser/E2E evidence for:

- viewport/no-scroll behavior;
- 3D canvas presence/fallback;
- item navigation;
- collection background presentation;
- purchase flows;
- responsive layouts;
- reduced-motion behavior.

Visual assertions should avoid brittle exact-pixel snapshots where semantic/layout bounds are sufficient.

No test may require production R2 credentials or production economic data.

## 3. Blocker gates

### SHOWCASE-01 — Dedicated full-screen route exists

**Requirement**

Normal offers and collections open a dedicated showcase route rather than depending on the old permanent desktop inspection panel.

**Pass**

- route shape supports `offer` and `collection` targets;
- direct navigation to a valid target renders the showcase;
- invalid target fails safely without exposing a broken purchase action;
- browser back returns to the prior Storefront route.

---

### SHOWCASE-02 — Showcase fits supported viewport without vertical page scroll

**Requirement**

Supported viewports from `360x640` upward must not require vertical document scrolling.

**Pass matrix**

Browser tests cover at least:

```text
360x640
390x844
768x1024
1280x720
1366x768
1440x900
1920x1080
```

For each viewport:

- showcase root height fits within `100dvh` tolerance;
- `document.documentElement.scrollHeight <= clientHeight + small rendering tolerance` or equivalent deterministic check;
- header, stage and commerce dock remain reachable;
- no primary CTA is clipped outside the viewport.

**Fail**

- user must scroll vertically to reach buy/completion CTA;
- stage pushes commerce controls below the viewport;
- mobile uses a long detail page instead of a fitted showcase.

---

### SHOWCASE-03 — Object area remains visually dominant

**Requirement**

Responsive compaction must sacrifice secondary copy before materially shrinking the 3D object.

**Pass**

Across the viewport matrix:

- stage is the largest primary layout region;
- selected object is not rendered as a small thumbnail inside an oversized empty canvas;
- compact-height layouts hide/reduce description before reducing stage to a minor region.

Automated evidence may assert stage-to-viewport ratios and minimum stage dimensions instead of exact object pixels.

---

### SHOWCASE-04 — One stable showcase shell handles normal and collection modes

**Requirement**

Normal products and collections share the same structural exhibition shell.

**Pass**

Switching mode changes environment/identity/lighting but preserves the conceptual header + stage + commerce dock structure.

---

### SHOWCASE-05 — Normal mode uses generic tactical environment

**Requirement**

Ordinary offers do not require per-product background art.

**Pass**

- normal showcase renders a generic military/futuristic environment;
- white/neutral pedestal lighting is present;
- no collection-only background is required for a normal offer.

---

### SHOWCASE-06 — Collection background fills the exhibition environment

**Requirement**

Collection `background` is the explicit full-screen visual environment.

**Pass**

For Football or another configured collection:

- canonical collection background is requested/rendered;
- it visually covers the showcase environment, not a small card subsection;
- localized overlays preserve readability;
- a single opaque full-screen overlay does not make the artwork effectively invisible.

**Fallback**

If background delivery fails, the generic tactical environment is used and commerce remains functional.

---

### SHOWCASE-07 — Collection mode uses gold premium lighting

**Requirement**

Collection inspection is visually distinguished by gold exhibition lighting.

**Pass**

- pedestal emissive treatment differs from normal white mode;
- object receives gold rim/fill emphasis;
- collection lighting remains readable over the collection background;
- lighting difference is implemented by scene state/config, not duplicated collection-specific 3D models.

---

### SHOWCASE-08 — Dice use canonical game geometry

**Requirement**

Store showcase does not maintain a second hand-built dice mesh.

**Pass**

Implementation reuses the canonical shared rounded die geometry or an extracted shared primitive derived from the same game implementation.

Code-level test/review verifies there is no separate showcase-only cube geometry that can diverge from gameplay dice shape.

---

### SHOWCASE-09 — Dice face textures reuse canonical cosmetic pipeline

**Requirement**

Showcase die faces are generated from the same cosmetic `assetRef` pipeline used by game dice.

**Pass**

- six face textures derive from the selected cosmetic asset;
- canonical face definitions are reused;
- no six-image showcase asset pack is required;
- asset failure degrades through the established safe/procedural fallback.

---

### SHOWCASE-10 — Showcase pips are black

**Requirement**

All displayed showcase dice use black or near-black pips regardless of attack/defense/neutral role.

**Pass**

A unit/integration test verifies showcase texture generation supplies the expected pip color while gameplay-specific value/skin identity remains unchanged.

---

### SHOWCASE-11 — Dice idle rotation is exhibition motion, not physics

**Requirement**

Idle dice rotate slowly around the vertical axis without gameplay roll physics.

**Pass**

- no Rapier/body simulation is required for showcase idle state;
- rotation is deterministic/presentation-driven;
- target pacing is visually slow (~6–10 seconds per revolution, tunable);
- object remains on the pedestal rather than bouncing/rolling.

---

### SHOWCASE-12 — Direct manipulation rotates object, not camera

**Requirement**

Pointer/touch drag manipulates the object orientation.

**Pass**

- camera transform remains stable during drag within expected responsive framing tolerance;
- selected model rotation changes;
- idle rotation pauses during interaction;
- idle rotation resumes after inactivity unless reduced motion is active.

---

### SHOWCASE-13 — Navigation arrows switch items, not faces/camera

**Requirement**

Left/right arrows navigate cosmetics within the set/collection.

**Pass**

For a three-die set:

```text
attack -> right -> defense -> right -> neutral
```

or equivalent declared ordering.

Camera and pedestal remain stable while selected cosmetic changes.

**Fail**

Arrows merely rotate one die to a different face or orbit the camera.

---

### SHOWCASE-14 — Item transition preserves scene anchor

**Requirement**

Changing items feels like replacing equipment on one exhibition platform.

**Pass**

- pedestal is not remounted/repositioned as a navigation effect;
- camera does not animate laterally to another bay;
- model uses short enter/exit transition or reduced-motion equivalent;
- item metadata/price changes with selected model.

---

### SHOWCASE-15 — One primary 3D model is live at a time

**Requirement**

V1 does not render the entire collection as simultaneous hidden live 3D models.

**Pass**

Inspection/review confirms only current primary model is mounted/rendered at full detail; adjacent assets may be prefetched without mounting full scenes.

---

### SHOWCASE-16 — Pedestal is stable and low profile

**Requirement**

The pedestal provides a visual anchor without consuming excessive stage height.

**Pass**

- pedestal remains through item changes;
- normal mode uses white/neutral emission;
- collection mode transitions to gold emission;
- object remains the dominant visual element.

---

### SHOWCASE-17 — Fixed canonical territory mannequin is used

**Requirement**

Territory skins use one configured presentation mannequin territory.

**Pass**

- mannequin ID is defined in presentation/shared configuration;
- no database field is introduced solely for mannequin choice;
- every territory-skin showcase uses the same canonical mannequin in V1;
- mannequin is not exposed as owned territory/game state.

---

### SHOWCASE-18 — Territory mannequin derives from canonical map SVG

**Requirement**

The 3D plate silhouette is derived from the real map territory path.

**Pass**

Geometry pipeline references the canonical `war-brasil-42.production.svg` source and configured `territory-{id}` element.

**Fail**

- hand-redrawn polygon;
- duplicated hard-coded shape unrelated to canonical SVG;
- screenshot/raster silhouette used as the geometry authority.

---

### SHOWCASE-19 — Territory path is normalized independently of map position

**Requirement**

Original SVG coordinates must not determine showcase placement/scale.

**Pass**

Automated geometry test proves extraction/normalization:

- obtains non-zero bounds;
- recenters local geometry around the intended origin;
- normalizes scale independent of original map-space position;
- preserves silhouette aspect ratio within tolerance.

This should follow the same principle already proven by territory-card `getBBox()`/viewBox normalization.

---

### SHOWCASE-20 — Territory mannequin is a shallow 3D plate

**Requirement**

Territory skin is not displayed as a flat 2D SVG only when WebGL is available.

**Pass**

- geometry has non-zero depth;
- front/back preserve canonical silhouette;
- side surfaces are generated;
- depth is small relative to width/height;
- object rotates around a centered local vertical axis.

---

### SHOWCASE-21 — Territory skin covers front/back and styled sides

**Requirement**

The 3D territory plate must not reveal generic unstyled side walls.

**Pass**

For image-based skin:

- front uses canonical skin texture/treatment;
- back uses same/equivalent treatment;
- sides use texture/material derived from the same skin.

For procedural skin:

- front/back/sides use a semantically consistent showcase adapter;
- default/plain fallback remains visually coherent.

---

### SHOWCASE-22 — Territory plate rotates slowly while idle

**Requirement**

Territory mannequin behaves as an exhibition object like the die.

**Pass**

- plate stands upright;
- starts from a readable oblique angle;
- idle rotation clearly reveals depth over time;
- drag manipulation uses the shared object-interaction model;
- camera remains fixed.

---

### SHOWCASE-23 — Mixed collection switches model class without route reload

**Requirement**

One collection may contain dice and territory skins.

**Pass scenario**

Within one collection showcase:

```text
dice item -> select territory skin -> territory plate appears -> select die -> die appears
```

The route/shell remains mounted and no full-page navigation is required.

---

### SHOWCASE-24 — Current item purchase remains individual

**Requirement**

Selecting a cosmetic does not force bundle purchase.

**Pass**

When an active single offer exists:

- current item's individual price is visible;
- purchase grants only that cosmetic;
- ownership state refreshes in the showcase;
- bundle/completion state recalculates from canonical storefront data.

---

### SHOWCASE-25 — Buy-all/completion CTA is always reachable without vertical scroll

**Requirement**

Bundle/completion action is the dominant commerce CTA and stays inside the fitted viewport.

**Pass matrix**

At each viewport in SHOWCASE-02:

- CTA is visible/reachable;
- no vertical scroll is required;
- partial ownership uses completion semantics;
- fully owned bundle is non-purchasable and reports complete state.

---

### SHOWCASE-26 — Showcase does not reimplement pricing

**Requirement**

Displayed prices come from authoritative storefront offers.

**Pass**

- showcase does not calculate permanent, bundle or promotional price from hard-coded client rules;
- Football or equivalent promoted collection displays server-projected promotion price;
- completion price updates after item ownership changes.

---

### SHOWCASE-27 — Purchase uses expectedPrice and idempotency

**Requirement**

Showcase purchase calls use the existing protected economy protocol.

**Pass**

Request contains at least:

```text
offerId
idempotencyKey
expectedPrice
```

Existing wallet/ledger/inventory tests remain green.

---

### SHOWCASE-28 — Price conflict is fail-closed

**Requirement**

A stale showcase price must never silently charge the new value.

**Pass**

On authoritative price mismatch:

- no debit;
- no ownership grant;
- new price becomes visible;
- explicit second confirmation is required;
- selected item remains stable where possible.

---

### SHOWCASE-29 — Ownership/equipped states refresh without leaving showcase

**Requirement**

Successful purchase can be observed in place.

**Pass**

After successful item purchase:

- item changes to owned;
- individual CTA is disabled/changes semantics;
- collection/set progress updates;
- completion price updates;
- user remains in showcase unless they explicitly navigate away.

---

### SHOWCASE-30 — Item strip is horizontally constrained

**Requirement**

Large collections must not cause vertical page growth.

**Pass**

- item strip may horizontally scroll when needed;
- root document remains vertically fitted;
- selected item can still be brought into view;
- keyboard focus is not lost when the strip scrolls.

---

### SHOWCASE-31 — Reduced-motion mode disables continuous motion

**Requirement**

`prefers-reduced-motion: reduce` is respected.

**Pass**

- no continuous idle die rotation;
- no continuous territory rotation;
- item changes use minimal fade/immediate swap;
- manual item selection and purchases remain functional;
- no required state change waits for animation completion.

---

### SHOWCASE-32 — Keyboard commerce and navigation are complete

**Requirement**

WebGL pointer interaction is optional for completing store tasks.

**Pass**

Keyboard-only E2E can:

1. enter showcase;
2. switch selected item;
3. focus/read ownership and price;
4. purchase current item or bundle where test balance allows;
5. activate back navigation.

---

### SHOWCASE-33 — Semantic HTML mirrors visual canvas state

**Requirement**

Screen reader users are not dependent on canvas internals.

**Pass**

Accessible HTML exposes:

- current item name;
- position/index in collection;
- slot/type;
- owned/equipped state;
- price and original/promotional price where relevant;
- current collection promotion;
- purchase result/error.

Canvas may be `aria-hidden` if semantic equivalent is present.

---

### SHOWCASE-34 — WebGL fallback preserves commerce

**Requirement**

3D rendering failure must not block buying/inspection semantics.

**Pass**

Forced no-WebGL test verifies:

- dice show canonical 2D fallback;
- territory skin shows normalized 2D mannequin fallback;
- navigation still switches items;
- individual/bundle purchase actions still work;
- prices/ownership are unchanged.

---

### SHOWCASE-35 — Collection background failure degrades safely

**Requirement**

Remote background delivery failure cannot break collection showcase.

**Pass**

- generic tactical background replaces failed collection background;
- collection name/logo when available still identify the collection;
- selected items and commerce remain usable;
- no retry loop causes layout instability.

---

### SHOWCASE-36 — Territory geometry failure degrades to canonical 2D shape

**Requirement**

Failure to build extrusion must not substitute unrelated geometry.

**Pass**

Forced geometry failure renders the same configured canonical territory as a normalized 2D SVG path and preserves commerce/navigation.

---

### SHOWCASE-37 — Showcase state never changes authoritative gameplay behavior

**Requirement**

Store inspection is presentation-only.

**Pass**

Tests/review verify:

- dragging/rotating showcase object has no server game-state effect;
- mannequin territory is not inserted into match state;
- showcase pip color does not alter dice RNG/value semantics;
- buying still follows normal inventory rules;
- buying does not auto-equip unless the existing economy contract explicitly changes later.

---

### SHOWCASE-38 — No showcase-only duplicate cosmetic assets are required

**Requirement**

V1 reuses canonical product assets.

**Pass**

No requirement is introduced for:

```text
six dice-face images per die
showcase-only territory path
collection-specific 3D model
showcase-only duplicate skin image
```

Existing dice cosmetic asset + canonical map SVG + collection editorial assets are sufficient.

---

### SHOWCASE-39 — Performance budget avoids hidden scene multiplication

**Requirement**

Item navigation remains responsive on supported devices.

**Pass**

At minimum:

- one primary Canvas for the showcase screen;
- one active high-detail showcased model;
- adjacent items may preload textures only;
- geometry/texture caches are reused;
- no unbounded texture creation occurs while cycling repeatedly through the same items.

A repeated-navigation automated/instrumented test should confirm stable resource counts or cache behavior where practical.

---

### SHOWCASE-40 — Old permanent inspection surface is retired from target UX

**Requirement**

Once showcase routing is enabled, the Storefront does not keep a second competing desktop inspection panel.

**Pass**

- activating normal set/territory opens showcase route;
- collection banner opens showcase route;
- `INSPEÇÃO // CATÁLOGO` is represented by the dedicated showcase experience rather than a permanent large block beneath catalog sections.

## 4. Required automated test groups

Implementation should add/extend deterministic coverage in these groups.

### 4.1 Store/showcase contract tests

Verify:

- route target projection;
- item ordering;
- single/bundle offer mapping;
- collection background/logo projection;
- mixed collection slot dispatch;
- promotion and completion prices are consumed, not recomputed.

### 4.2 Dice showcase unit tests

Verify:

- canonical geometry primitive reuse;
- black showcase pip configuration;
- selected cosmetic `assetRef` reaches face-texture pipeline;
- item navigation changes cosmetic identity;
- reduced-motion disables idle rotation state.

### 4.3 Territory geometry unit/integration tests

Verify:

- canonical mannequin ID resolves;
- canonical path extraction;
- bounds are non-zero;
- centered/normalized geometry;
- extrusion depth > 0;
- front/back/side material groups exist;
- same mannequin is used for multiple skins.

### 4.4 Browser/E2E

Verify at least:

1. normal Simple Silver-like set;
2. promoted Football-like collection;
3. mixed fixture containing one die and one territory skin;
4. partial ownership/completion;
5. smallest supported viewport;
6. compact 1280x720 desktop;
7. normal wide desktop;
8. reduced motion;
9. no-WebGL fallback.

## 5. Visual evaluation checklist

These checks may be manual evidence or stable browser assertions where practical.

### Normal showcase

- object is visually large;
- pedestal light reads as white/neutral;
- background feels tactical/military rather than ecommerce card UI;
- HUD does not obscure the object;
- buy-all CTA is clearly stronger than item-level secondary metadata.

### Collection showcase

- collection background is immediately recognizable;
- collection logo/identity is visible without dominating object;
- gold lighting clearly distinguishes premium mode;
- promoted price is readable;
- object remains readable against background.

### Territory plate

- silhouette is clearly the chosen canonical territory;
- plate has visible depth when rotated;
- sides visually belong to the skin material;
- plate stands upright and reads as a physical exhibit;
- no map-relative offset/scale is visible.

## 6. Regression gates

The implementation is not ready if it causes regressions in:

- existing economy purchase integration tests;
- bundle/completion math;
- collection promotion pricing;
- R2 delivery/fallback behavior;
- game dice rendering/physics;
- territory gameplay SVG interaction/hitboxes;
- loadout ownership/equip validation;
- Storefront filtering of collection items from normal catalogs.

## 7. Merge gate

The showcase implementation is ready to merge only when:

1. all blocker gates applicable to V1 pass;
2. parent Economy/Store/Territory EVAL suites remain green;
3. responsive no-scroll evidence exists for the required viewport matrix;
4. both dice and territory 3D paths have deterministic fallback coverage;
5. purchase/completion E2E is demonstrated from the showcase itself;
6. no unresolved contradiction remains between implementation and companion SPEC.
