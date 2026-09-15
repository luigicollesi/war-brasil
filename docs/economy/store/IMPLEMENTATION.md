# Storefront V2 — Implementation Evidence

Branch: `feature/economy-storefront-v2`

Companion contracts:

- `docs/economy/store/SPEC.md`
- `docs/economy/store/EVAL.md`
- `docs/economy/SPEC.md`
- `docs/economy/EVAL.md`
- `docs/economy/territory-skins/SPEC.md`
- `docs/economy/territory-skins/EVAL.md`

This file maps the implementation to the Storefront V2 acceptance areas. It does not replace executable verification output.

## 1. Domain/schema

Implemented in the 043/044 migration chain:

- cosmetic item remains the ownership unit;
- `products` support `single` and `bundle`;
- `product_items` compose products from cosmetics;
- `collections` are independent thematic entities;
- `collection_assets` implements the closed V1 roles `banner | background | logo`;
- at most one active collection mapping exists per role;
- `offers` carry product, lifecycle and availability metadata;
- `cosmetic_pricing`, `price_tiers`, `cosmetic_stats` support fixed/progressive pricing;
- `campaigns`, `campaign_offers`, `campaign_assets` are independent from collections;
- canonical runtime slot is `territory_skin`;
- 044 promotes the four V1 territory skins to normal single products/offers.

Reference files:

```text
src/lib/db/migrations/managed/043-economy-storefront-v2.sql
src/lib/db/migrations/managed/044-economy-storefront-territory-commerce.sql
```

## 2. Football collection fixture

Football proves the dice-only collection shape:

```text
collection.football
├── dice.attack.futebol
├── dice.defense.futebol
└── dice.neutral.futebol
```

Required editorial object keys:

```text
store/collections/football/banner.webp
store/collections/football/background.webp
store/collections/football/logo.webp
```

Football has three individual products plus one bundle product and does not require a territory skin.

Automated evidence:

```text
tests/integration/economy-storefront-collections.test.mjs
tests/integration/economy-storefront-shapes.test.mjs
```

## 3. Pricing/completion

The shared quote engine calculates:

```text
missing items
-> current unit price for each missing item
-> integer subtotal
-> bundle discount in basis points
-> integer final price
```

Owned components are excluded before discount. Full ownership produces a completed/non-purchasable result.

Reference implementation/tests:

```text
src/lib/economy/storefront-pricing.ts
src/lib/server/economy/storefront-quote-repository.ts
src/lib/server/economy/economy-service.ts
tests/economy-storefront-pricing.test.mjs
tests/economy-storefront-purchase-pricing.test.mjs
tests/integration/economy-storefront-shapes.test.mjs
```

Required shapes covered:

- dice bundle 0/3, 1/3, 2/3, 3/3;
- mixed collection owns dice/no skin;
- mixed collection owns skin/no dice;
- mixed ownership;
- full mixed collection.

## 4. Progressive pricing / race protection

Progressive pricing uses explicit DB tiers and per-cosmetic acquisition counters.

Purchase locks relevant counters in stable cosmetic order before calculating the authoritative quote.

`expectedPrice` is mandatory. A changed authoritative price produces `409 ECONOMY_PRICE_CHANGED` without debit/grant/counter mutation.

Concurrency integration covers a `99 -> 100` boundary with two simultaneous confirmations at the old tier; only the acquisition belonging to that tier succeeds at the old price and the stale purchase must reconfirm the new price.

Evidence:

```text
tests/economy-storefront-pricing.test.mjs
tests/economy-storefront-purchase-pricing.test.mjs
tests/integration/economy-storefront-lifecycle.test.mjs
```

## 5. Timed offers and campaigns

Offer lifecycle is server-authoritative via `active`, `starts_at`, `ends_at`.

Integration scenarios cover:

- scheduled;
- active;
- exact expiration boundary;
- expired;
- disabled;
- later return through a new offer for the same stable product.

The UI displays an end date without permanent-exclusivity wording and refreshes after authoritative `ECONOMY_OFFER_UNAVAILABLE` rejection when a detail surface became stale.

Campaigns are independent editorial entities. Expiring a campaign leaves collection/cosmetic/product identities intact.

Evidence:

```text
src/lib/server/economy/economy-storefront-repository.ts
src/lib/server/economy/economy-service.ts
src/components/profile/v4/profile-store.tsx
tests/economy-storefront-campaigns.test.mjs
tests/integration/economy-storefront-lifecycle.test.mjs
tests/integration/economy-storefront-collections.test.mjs
tests/integration/economy-storefront-shapes.test.mjs
```

## 6. Territory skin commerce

The Storefront snapshot exposes territory skins independently from offers.

When a real active single offer exists, the same generic purchase pipeline provides price and purchase action. Without an offer, the UI does not invent a price or purchasing capability.

044 activates commerce for:

```text
territory.effect.azulejo-brasil
territory.effect.azulejo-ornamental
territory.effect.ceu-estrelado
territory.effect.solar-ornamental
```

The integration test verifies wallet debit, individual `territory_skin` ownership, purchase receipt and item-level price snapshot.

Evidence:

```text
src/lib/db/migrations/managed/044-economy-storefront-territory-commerce.sql
src/components/profile/v4/profile-store.tsx
tests/integration/economy-storefront-lifecycle.test.mjs
```

Renderer/gameplay visual requirements remain governed by `docs/economy/territory-skins/EVAL.md`.

## 7. Storefront information architecture

Profile V4 Store uses the required exploration surfaces:

```text
Destaques | Dados | Territórios | Coleções
```

Implemented behavior:

- campaign/featured content in Destaques;
- dice-only commercial offers in Dados;
- territory skin discovery/commerce in Territórios;
- collection banners/progress/detail in Coleções;
- collection detail composes background + logo + canonical cosmetic assets;
- no collection hero/card runtime dependency;
- store remains vertically scrollable;
- explicit mobile inspection dialog, Escape close and focus return;
- reduced-motion CSS path remains present.

Evidence:

```text
src/components/profile/v4/profile-store.tsx
src/components/profile/v4/profile-store.module.css
src/components/profile/v4/profile-store-mobile-inspection.module.css
src/components/profile/v4/profile-store-commerce.module.css
tests/profile-v4-store.test.mjs
tests/economy-storefront-campaigns.test.mjs
```

## 8. Object storage

Implemented contract:

```text
ASSET_STORAGE_URL
ASSET_STORAGE_REGION=auto
ASSET_STORAGE_BUCKET
ASSET_STORAGE_ACCESS_KEY_ID
ASSET_STORAGE_SECRET_ACCESS_KEY
```

Native HTTPS R2 configuration requires an explicit environment bucket. Dev/prod can therefore use isolated mutable buckets.

Runtime/catalogue rules:

- DB stores object keys;
- exact key delivery only;
- no `ListObjects` catalogue discovery;
- collection keys resolve through a server endpoint;
- catalogue validation uses `HEAD` against exact configured keys;
- collection validation checks exactly the active DB mappings;
- missing remote images use component/runtime fallback rather than becoming economic identity.

Evidence:

```text
.env.example
src/lib/server/assets/asset-storage-config.ts
src/lib/server/assets/asset-storage-s3.ts
src/lib/server/assets/collection-asset-storage.ts
src/app/api/assets/collections/route.ts
scripts/validate-dice-assets.mjs
scripts/validate-storefront-assets.mjs
tests/asset-storage.test.mjs
tests/asset-storage-https-config.test.mjs
tests/storefront-assets-validation.test.mjs
tests/storefront-collection-assets.test.mjs
```

Real R2 dev connectivity is environment evidence and cannot be manufactured by repository tests without authorized credentials.

## 9. Migration verification

Automated migration coverage now exercises the chain through 044 and reruns the prepare command to validate guarded/idempotent behavior.

It reconciles:

- 26 cosmetics total;
- 4 defaults;
- 22 non-default available cosmetics;
- 6 dice bundles;
- 22 single products after territory commerce;
- four active commercial territory skins;
- existing inventory/loadout defaults;
- collection roles and constraints.

Evidence:

```text
tests/integration/database-migration.test.mjs
tests/integration/economy-migration.test.mjs
tests/integration/economy-storefront-collections.test.mjs
```

## 10. Documentation reconciliation

Reconciled documents use one final contract:

- canonical slot `territory_skin`;
- individual dice purchasing is valid;
- partial ownership reduces completion price;
- progressive pricing is valid via explicit tiers;
- campaign != collection;
- V1 collection assets are exactly banner/background/logo;
- storage bucket is environment-specific, not globally hardcoded to prod.

## 11. Verification commands

Repository verification should execute at least:

```bash
npm run lint
npm test
npm run test:db
npm run build
```

The repository `Test` GitHub Actions workflow additionally runs dependency audits, realtime tests, build secret scanning and multi-client E2E.

## 12. External/manual evidence still required before production rollout

Repository implementation cannot fabricate these environment/manual results:

1. authorized R2 dev exact-key connectivity for the real six Football objects and territory objects;
2. manual/browser visual review at 1440x900, 1366x768, 390x844 and compact <=390x667;
3. territory renderer visual matrix across six PlayerColors, representative simple/complex skins and gameplay states;
4. reduced-motion visual inspection.

These are rollout/merge evidence gates, not missing domain implementation.
