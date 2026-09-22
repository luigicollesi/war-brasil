# War Brasil — Storefront, Collections & Territory Skins EVAL

Status: **evaluation contract for implementation**  
Companion SPEC: `docs/economy/store/SPEC.md`

## 1. Purpose

This EVAL defines the acceptance gates for the storefront/catalog restructuring described in `docs/economy/store/SPEC.md`.

It supplements `docs/economy/EVAL.md` and `docs/economy/territory-skins/EVAL.md`.

Wallet/ledger/auth/audit gates from the parent Economy V2 EVAL remain mandatory. When an older storefront assertion conflicts with the new specific store SPEC — notably partial-ownership pricing, progressive pricing, mixed collections, collection asset roles or the `territory_skin` slot — the implementation must update/reconcile the parent EVAL rather than weaken this EVAL.

## 2. Evaluation policy

A blocker failure means the store restructure is not ready to merge.

Evidence should prefer deterministic automated tests for domain logic and migrations, with targeted browser/E2E coverage for user-visible merchandising and purchase behavior.

No test may depend on real production R2 credentials or production economic data.

## 3. Blocker gates

### STORE-01 — Owned item and commercial product are different entities

**Requirement**

The implemented model distinguishes an owned/equippable cosmetic from the product offered by the store.

**Pass**

- a bundle can reference multiple cosmetics without becoming an owned cosmetic itself;
- inventory contains component cosmetics, not bundle rows;
- one cosmetic can participate in individual and bundle products.

**Fail**

- ownership is stored against the bundle/product only;
- individual and bundled copies require duplicate cosmetic records.

---

### STORE-02 — Four initial cosmetic slots are supported

**Requirement**

The catalogue/loadout supports:

- `dice_attack`;
- `dice_defense`;
- `dice_neutral`;
- `territory_skin`.

**Pass**

Existing dice semantics continue to work and territory skins can be independently owned/equipped.

---

### STORE-03 — Dice can be purchased individually

**Requirement**

Attack, defense and neutral dice from one theme can each have their own store product and price.

**Pass**

Purchasing one die grants only that cosmetic and does not implicitly grant the full set.

---

### STORE-04 — Dice set can be purchased as a bundle

**Requirement**

The same dice can also be sold together as one bundle product.

**Pass**

- bundle detail exposes its three components;
- one atomic purchase grants all missing components;
- bundle discount is visible and deterministic.

---

### STORE-05 — Partial ownership reduces bundle price

**Requirement**

Already owned component cosmetics are excluded from bundle/completion pricing.

**Pass matrix**

For a three-die bundle, automated tests cover:

- owns 0/3;
- owns 1/3;
- owns 2/3;
- owns 3/3.

Expected behavior:

- only missing-item prices enter the subtotal;
- discount is applied to the missing-item subtotal;
- 3/3 cannot be purchased again;
- UI changes to completion/acquired semantics.

This gate intentionally supersedes the previous Economy V2 assumption that partial ownership never changes price.

---

### STORE-06 — Collections may be dice-only, territory-only or mixed

**Requirement**

A collection is a thematic grouping, not a fixed bundle shape.

**Pass**

Fixtures/tests prove at least:

- one dice-only collection with attack/defense/neutral dice;
- one mixed collection with dice and one or more territory skins.

The `football` reference fixture is valid with only:

- Football Attack Die;
- Football Defense Die;
- Football Neutral Die.

No territory skin is required for Football.

---

### STORE-07 — Collection merchandising uses exactly three V1 asset roles

**Requirement**

A store-visible collection resolves exactly one configured asset for each V1 editorial role:

```text
banner
background
logo
```

Collection-specific `hero`, `card`, `thumbnail` or equivalent redundant roles are not required by V1 and must not become runtime dependencies.

**Pass**

- semantic roles map to explicit object keys;
- DB/schema validation restricts V1 collection roles to `banner | background | logo` or an equivalent explicit closed set;
- at most one active mapping exists per `(collection, role)`;
- full store-visible collections have all three roles configured;
- collection editorial assets are not owned/equippable cosmetics.

---

### STORE-08 — Collection banner opens collection detail

**Requirement**

The collection `banner` is the primary promotional/entry asset in storefront discovery surfaces.

**Pass**

Activating a Football collection banner opens the Football collection detail surface rather than a disconnected generic product card.

The interaction is keyboard/touch accessible and does not depend on interpreting filenames or R2 folder listings.

---

### STORE-09 — Collection detail composes background, logo and real cosmetic assets

**Requirement**

Opened collection detail uses:

```text
background → visual stage
logo       → top identity
cosmetic assets → actual product content
```

**Pass**

For Football:

- Football background renders as the collection backdrop;
- Football logo is visible near the top/header identity region;
- attack, defense and neutral dice use their canonical cosmetic assets as the foreground product presentation;
- no separate collection hero/card asset is required to show the dice.

---

### STORE-10 — Collection completion is ownership-aware

**Requirement**

Collection detail shows `owned / total` progress and can offer a completion bundle based only on missing cosmetics.

**Pass**

Tests cover both a dice-only collection and a mixed collection where the user owns only some component cosmetics.

---

### STORE-11 — Bundle math uses exact integer arithmetic

**Requirement**

Authoritative bundle pricing does not use floating-point money math.

**Expected rule**

```text
subtotal = sum(current prices of missing items)
final_price = floor(subtotal * (10000 - discount_bps) / 10000)
```

**Pass**

Boundary tests verify deterministic rounding and zero/maximum allowed discount behavior.

---

### STORE-12 — Progressive pricing uses explicit tiers

**Requirement**

Selected cosmetics can use price tiers based on global cosmetic acquisition count.

**Pass**

- tiers are explicit and non-overlapping;
- final tier may be open-ended;
- fixed-price cosmetics remain supported;
- acquisition through an individual product or bundle affects the same cosmetic counter;
- owned items skipped from a bundle do not increment counters.

---

### STORE-13 — Tier-boundary concurrency is safe

**Requirement**

Concurrent purchases around a tier boundary cannot both consume an obsolete price when only one acquisition belongs in that tier.

**Pass**

A DB/integration test exercises a boundary such as acquisition `99 -> 100` with concurrent purchase attempts and verifies serialized authoritative pricing/counters.

---

### STORE-14 — Expected-price confirmation prevents silent overcharge

**Requirement**

Purchase request includes the user-confirmed expected price and the server recalculates the current price inside the transaction.

**Pass**

When current price differs:

- server performs no debit;
- grants no cosmetic;
- does not advance counters;
- returns a deterministic price-change result (recommended `409 PRICE_CHANGED`);
- client displays the new price and requires a second confirmation.

---

### STORE-15 — Timed availability is server-authoritative

**Requirement**

Offer start/end/active state is validated server-side.

**Pass**

Tests cover:

- before `starts_at`;
- active window;
- exact/near expiration boundary;
- after `ends_at`;
- manually disabled offer.

Manipulating client time or CTA state cannot make an expired offer purchasable.

---

### STORE-16 — Collections and campaigns are independent

**Requirement**

A collection can remain discoverable when a campaign ends, and campaigns can feature offers without changing ownership identity.

**Pass**

A campaign fixture expires while the related collection and cosmetics remain valid catalogue entities.

Campaign-specific art does not alter the three-role collection asset contract.

---

### STORE-17 — No false permanent-exclusivity messaging

**Requirement**

Timed offers that may return do not claim to be permanently unavailable after expiry.

**Pass**

UI copy distinguishes rotation/timed availability from explicitly configured never-returning editions.

---

### STORE-18 — Territory skins use one canonical recolorable source where applicable

**Requirement**

A grayscale/neutral territory skin can preview/render under all six supported player colors without six duplicated canonical source textures.

**Pass**

Visual/unit coverage exercises all six palettes and preserves recognizable ownership color.

---

### STORE-19 — Territory gameplay states remain stronger than cosmetics

**Requirement**

Territory skin rendering cannot obscure selection, hover, attackability, blocked state or ownership semantics.

**Pass**

Visual/E2E coverage checks at least representative light/dark/high-detail territory skins under gameplay highlights.

This gate must also satisfy `docs/economy/territory-skins/EVAL.md`.

---

### STORE-20 — Store IA is Destaques / Dados / Territórios / Coleções

**Requirement**

The store exposes the four primary discovery surfaces.

**Pass**

- Destaques contains campaign/editorial content and featured collection banners instead of a flat full catalogue dump;
- Dados exposes individual and set purchasing;
- Territórios exposes territory-skin previews;
- Coleções exposes themed collections and progress.

---

### STORE-21 — Store is intentionally scrollable

**Requirement**

The storefront may vertically scroll and must not inherit Lobby/Matchmaking's no-scroll contract.

**Pass**

Desktop and mobile can reach all catalogue content without clipping. Sticky store chrome, if used, does not cover actionable content.

---

### STORE-22 — Card hierarchy avoids information overload

**Requirement**

Default cards prioritize art, name, context and price.

**Pass**

Detailed acquisition count, next tier, countdown, savings breakdown and similar secondary information live in product/collection detail unless one is the single intentional badge/status.

---

### STORE-23 — Owned states replace invalid purchase CTA

**Requirement**

A fully owned single product/bundle does not present an active purchase CTA.

**Pass**

UI uses appropriate states such as `Adquirido`, `Equipar`, `Equipado` or completion CTA for partial bundles.

---

### STORE-24 — Purchase transaction is atomic

**Requirement**

Wallet debit, ownership grants, acquisition counters and purchase history succeed or fail together.

**Pass**

Fault-injection/integration coverage verifies rollback on failure after each critical stage and leaves no partial debit/grant/counter update.

---

### STORE-25 — Duplicate ownership is prevented by DB constraint

**Requirement**

The DB, not only application code, prevents duplicate `(user, cosmetic)` ownership.

**Pass**

Concurrent/repeated acquisition attempts cannot create duplicate inventory rows.

---

### STORE-26 — Purchase history preserves price snapshots

**Requirement**

The purchase record preserves the product/offer and enough per-item/discount information to explain the historical amount paid even after future price changes.

**Pass**

Changing current price tiers after a purchase does not alter/reinterpret the recorded historical purchase.

---

### STORE-27 — Database contains object keys, not environment-specific R2 URLs

**Requirement**

Canonical asset references are object keys such as:

```text
cosmetics/dice/football/attack.webp
store/collections/football/banner.webp
```

not complete `https://...` URLs.

**Pass**

Dev/prod base delivery can change without rewriting catalogue rows.

---

### STORE-28 — Runtime does not discover assets with bucket listing

**Requirement**

Store/runtime rendering resolves exact asset keys from DB mappings and must not require `ListObjects` or folder scans.

**Pass**

Static/code audit finds no runtime list operation used to construct catalogue or collection contents.

---

### STORE-29 — R2 credentials are server-only

**Requirement**

No account token/access key/secret appears in browser bundles, repository source, docs, fixtures or committed environment files.

**Pass**

Implementation uses server-only configuration for the S3-compatible connection, following the contract:

```text
ASSET_STORAGE_URL
ASSET_STORAGE_REGION
ASSET_STORAGE_BUCKET
ASSET_STORAGE_ACCESS_KEY_ID
ASSET_STORAGE_SECRET_ACCESS_KEY
```

Optional `ASSET_PUBLIC_BASE_URL` contains no secret.

---

### STORE-30 — Dev/prod object storage is isolated

**Requirement**

Development and production do not write to the same mutable bucket.

**Expected planned mapping**

```text
dev  -> war-brasil-assets-dev
prod -> war-brasil-assets-prod
```

Exact credentials/policies are configured during implementation, not in repository docs.

---

### STORE-31 — Missing object asset degrades gracefully

**Requirement**

One missing/broken R2 object cannot crash the full storefront or match renderer.

**Pass**

Tests verify placeholder/fallback behavior and actionable server logging without exposing secrets.

A missing required collection object may mark that collection presentation degraded/unavailable, but must not crash unrelated store content.

---

### STORE-32 — Migration number is allocated from current repository state

**Requirement**

The implementation must inspect the newest migration immediately before writing the store migration and choose a strictly newer number.

**Pass**

No hard-coded migration number from this planning document is reused blindly.

---

### STORE-33 — Migration is forward-safe and backfills existing catalogue

**Requirement**

Existing Economy V2 dice catalogue/ownership data is preserved while introducing products, collections and territory skins.

**Pass**

Migration tests/verification demonstrate:

- existing dice cosmetics remain addressable;
- existing ownership remains valid;
- product mappings are backfilled;
- collection mappings can represent dice-only and mixed collections;
- new constraints do not invalidate existing valid rows;
- destructive cleanup is deferred unless proven safe.

---

### STORE-34 — Territory-skin migration is part of implementation

**Requirement**

The implementation migration adds the necessary catalogue/loadout support for `territory_skin`; this documentation change alone does not mutate the DB.

**Pass**

Repository history clearly separates this planning SPEC/EVAL from later SQL/application implementation.

---

### STORE-35 — Collection asset migration/seed supports the three-role contract

**Requirement**

The implementation migration/seed shape supports `banner`, `background` and `logo` mappings without requiring collection-specific hero/card rows.

**Pass**

A Football fixture can map exactly:

```text
store/collections/football/banner.webp
store/collections/football/background.webp
store/collections/football/logo.webp
```

and satisfy collection validation.

---

### STORE-36 — Bucket provisioning/access is part of implementation

**Requirement**

This planning change must not create or expose real Cloudflare credentials.

**Pass**

The implementation phase later proves dev-bucket connectivity with a harmless server-side read/write test or equivalent authorized verification, while secrets remain outside Git.

---

### STORE-38 — Public cosmetic reads bypass the application Worker

**Requirement**

Public cosmetic and collection image reads use the production R2 Custom Domain rather than invoking Better Auth, catalogue allowlist queries or the OpenNext Worker for every image.

**Pass**

- production declares `ASSET_PUBLIC_BASE_URL=https://assets.bellumcivile.com`;
- DB rows continue to contain object keys rather than complete CDN URLs;
- server DTO projection resolves dice, territory skins, collection assets and profile appearance assets through the shared public delivery layer;
- cross-origin Canvas/WebGL consumers use CORS-safe loading;
- the R2 bucket has a CORS policy allowing `GET`/`HEAD` from `https://bellumcivile.com`;
- authenticated `/api/assets/*` endpoints remain fallback/private compatibility paths rather than the normal production image path;
- no client-side metadata request is required merely to render dice body colors already present in the catalogue DTO.

---

### STORE-37 — Parent Economy V2 docs are reconciled before implementation is declared complete

**Requirement**

Older rules that contradict the implemented storefront are updated rather than left ambiguous.

At minimum review/reconcile parent statements about:

- supported cosmetic types;
- partial-ownership bundle pricing;
- dynamic/progressive pricing;
- collection semantics;
- collection merchandising roles;
- storefront offer/product model.

**Pass**

There is one unambiguous final documentation contract.

## 4. Required scenario matrix

Implementation must cover at least the following scenarios.

### 4.1 Dice bundle ownership

| Owned before | Expected result |
| --- | --- |
| none | buy all 3 with full bundle discount |
| attack only | price/grant defense + neutral only |
| attack + defense | price/grant neutral only |
| all 3 | no purchase CTA / reject repeated purchase |

### 4.2 Collection shapes

At least:

- Football-style dice-only collection with 3 dice and no territory skin;
- territory-only collection or equivalent supported fixture;
- mixed collection with dice + territory skin;
- full ownership state for each tested shape.

### 4.3 Collection merchandising flow

For the Football reference fixture verify:

1. storefront renders `banner.webp` as the promotional entry;
2. clicking/tapping the banner opens Football collection detail;
3. detail resolves `background.webp` as the backdrop;
4. detail resolves `logo.webp` as the top collection identity;
5. detail renders canonical attack/defense/neutral cosmetic assets in the foreground;
6. no `hero.webp` or `card.webp` collection dependency is required;
7. individual and bundle purchase paths remain available from the detail surface.

### 4.4 Mixed collection completion

At least one scenario each for:

- owns dice but no territory skin;
- owns territory skin but no dice;
- owns a mix of both;
- owns full collection.

### 4.5 Progressive price boundary

At least:

- first tier normal purchase;
- last acquisition before tier transition;
- first acquisition in new tier;
- two concurrent purchases crossing a boundary;
- stale `expectedPrice` rejection.

### 4.6 Timed offer

At least:

- scheduled;
- active;
- expiring while detail view is open;
- expired;
- returned through a later new offer.

### 4.7 Territory skin visual matrix

At least:

```text
6 player colors
×
representative simple grayscale skin
×
representative complex/high-detail skin
```

Check ownership readability and gameplay highlights.

### 4.8 Store viewport matrix

At least:

- desktop 1440×900;
- desktop 1366×768;
- mobile 390×844;
- compact mobile 390×667 or lower practical target supported by the app.

Verify scrolling, sticky chrome, collection banners, collection detail surfaces and CTA reachability.

## 5. Migration verification checklist

When implementation begins, evidence should include:

1. latest migration number before new migration allocation;
2. migration applied to an isolated/dev DB successfully;
3. migration re-run/guard behavior according to project convention;
4. expected tables/columns/indexes/constraints present;
5. backfilled current dice catalogue count reconciles with pre-migration data;
6. ownership count reconciles with pre-migration data;
7. loadout remains valid;
8. collection role constraint/mapping supports only the approved V1 roles;
9. Football fixture resolves 3 dice + 3 collection merchandising assets correctly;
10. rollback strategy or forward-fix strategy documented for production rollout;
11. application tests run against migrated schema.

No production migration is authorized merely by this EVAL.

## 6. R2 verification checklist

When bucket access is configured during implementation, evidence should include:

1. dev uses `war-brasil-assets-dev` or the approved equivalent;
2. production points to a distinct production bucket;
3. secrets are server-only;
4. exact-key read succeeds for a known fixture object;
5. Football exact-key reads cover `attack.webp`, `defense.webp`, `neutral.webp`, `banner.webp`, `background.webp` and `logo.webp`;
6. authorized upload path succeeds only where required by tooling/admin flow;
7. runtime catalogue does not require list permission;
8. missing object produces fallback behavior;
9. no credential value appears in client JS/build output/logged API response;
10. DB stores object keys rather than complete environment-specific URLs.

## 7. UX / visual quality checks

These are required manual/visual review items in addition to automated blockers:

- store feels like War Brasil's military/prestige arsenal rather than generic SaaS ecommerce;
- collection banners are visually strong promotional entry points without burying navigation;
- opening a collection produces a coherent scene using its background, top logo and real cosmetic assets;
- the three-asset collection model feels intentional rather than visually sparse;
- collection presentation does not depend on redundant hero/card artwork;
- Football reads as one coherent dice family while preserving individual buying;
- dice-set presentation reads as one family while preserving individual buying generally;
- territory skins visibly demonstrate six-color adaptability;
- mixed collection completion is understandable without inspecting price math manually;
- gold is used for prestige/value/focus, green for command structure, red primarily for real urgency/error/unavailable state;
- animations respect `prefers-reduced-motion`;
- mobile collection banners/detail surfaces remain legible and actionable;
- the store can grow to many products without turning the landing view into an undifferentiated grid.

## 8. Non-blocking future candidates

These are intentionally outside the first implementation unless separately specified:

- additional collection editorial roles beyond `banner`, `background`, `logo`;
- personalized discount market;
- real-money purchases;
- gifting/trading;
- limited serialized cosmetic numbers;
- player-to-player resale;
- automatic recommendation engine;
- daily login-driven FOMO mechanics;
- additional cosmetic slots beyond dice/territory skin;
- admin CMS for uploading collection art.

## 9. Definition of done

The store restructure is complete only when:

1. all STORE blocker gates pass;
2. parent Economy V2 regressions remain green;
3. territory-skin EVAL remains green;
4. the DB migration has been verified against the current migration chain;
5. R2 dev access is configured and verified without exposing credentials;
6. individual dice, dice bundles, territory skins and mixed collection completion work end-to-end;
7. dice-only collections such as Football work without a territory-skin requirement;
8. collection merchandising uses the approved `banner/background/logo` contract end-to-end;
9. progressive pricing and timed offers are server-authoritative and race-safe;
10. storefront visual review passes desktop/mobile matrices;
11. parent Economy V2 SPEC/EVAL is reconciled with the implemented model;
12. implementation evidence is committed/referenced according to the repository's normal workflow.
