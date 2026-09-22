# War Brasil — Storefront, Collections & Territory Skins SPEC

Status: **approved design / implementation pending**  
Scope: restructuring of the Economy V2 storefront/catalog only.

## 1. Authority and relationship with Economy V2

This document is the specific authority for the next store/catalog restructuring.

It refines `docs/economy/SPEC.md` for:

- storefront information architecture;
- commercial products and bundles;
- mixed cosmetic collections;
- progressive pricing and timed availability;
- territory-skin merchandising;
- collection/campaign visual assets;
- Cloudflare R2 access contract for store assets.

`docs/economy/SPEC.md` remains authoritative for wallet, ledger, authentication, auditability, credits and general Economy V2 security rules.

When this SPEC conflicts with older storefront rules in the parent Economy V2 document — especially partial ownership pricing, dynamic/progressive pricing, collection semantics or supported cosmetic slots — this document is the more specific authority for the store-restructure implementation. The parent SPEC/EVAL must be reconciled during implementation so contradictory rules do not remain after migration.

`docs/economy/territory-skins/SPEC.md` remains authoritative for territory rendering and gameplay-legibility constraints. This document defines how territory skins are catalogued, sold and presented in the store.

## 2. Goal

Turn the current store from a flat cosmetic catalogue into an editorial **Arsenal / Storefront** capable of selling:

1. attack dice individually;
2. defense dice individually;
3. neutral dice individually;
4. complete dice sets with a bundle discount;
5. territory skins;
6. territory-skin packs;
7. thematic collections containing dice, territory skins, or both;
8. complete or partial collection bundles;
9. permanent, timed and progressively priced offers;
10. themed campaigns and collection merchandising.

The design must preserve server-authoritative economy rules and must not couple ownership to R2 filenames or folder structure.

## 3. Core domain model

The store distinguishes four concepts.

### 3.1 Cosmetic item

A `cosmetic_item` is something the user can own and equip.

Initial equip slots:

- `dice_attack`
- `dice_defense`
- `dice_neutral`
- `territory_skin`

A bundle is **not** an owned cosmetic. Buying a bundle grants ownership of its component cosmetic items.

### 3.2 Cosmetic collection

A `cosmetic_collection` is a persistent thematic family and visual identity.

A collection may contain any compatible combination of cosmetics. Mixed dice + territory collections are valid, but territory content is not mandatory.

Mixed example:

```text
Celestial
├── Celestial Attack Die
├── Celestial Defense Die
├── Celestial Neutral Die
├── Starry Sky Territory Skin
└── Solar Ornamental Territory Skin
```

Dice-only example:

```text
Football
├── Football Attack Die
├── Football Defense Die
└── Football Neutral Die
```

A cosmetic may also exist without a collection.

### 3.3 Store product

A `store_product` is what the store sells.

A product can be:

- `single`: one cosmetic item;
- `bundle`: two or more cosmetic items.

The same three Football dice may therefore be offered as three individual products and as one discounted dice-set product without duplicating ownership records.

### 3.4 Store offer

A `store_offer` controls how and when a product is commercially available.

The product and its cosmetics remain stable while offers may start, expire and return later. The same product can participate in multiple rotations without recreating the owned cosmetic entities.

## 4. Collection merchandising contract

### 4.1 Minimal asset kit

A store-visible collection has exactly three required editorial asset roles in V1:

- `banner`
- `background`
- `logo`

Do **not** require collection-specific `hero`, `card`, `thumbnail` or other redundant artwork in V1.

The intent is to keep authoring, storage and visual consistency manageable while allowing each collection to feel unique.

### 4.2 Asset responsibilities

#### `banner`

The banner is the collection's storefront advertisement and primary entry point.

It may be used in:

- Destaques;
- Coleções;
- campaign/editorial rails that feature a collection.

The banner should communicate the collection fantasy and may visually feature the real cosmetic designs. Clicking/tapping the banner opens the collection detail surface.

#### `background`

The background is the environmental stage for the opened collection detail surface.

It should:

- establish the collection atmosphere;
- leave sufficient negative/low-detail space for interface overlays;
- sit behind the actual product/cosmetic presentation;
- not be the canonical item preview itself.

#### `logo`

The logo is the collection's visual signature and appears prominently at the top of the opened collection detail surface.

It may also be reused where compact collection identity is useful, but it is not an owned/equippable cosmetic.

### 4.3 Collection detail composition

Opening a collection must conceptually produce:

```text
collection background
        +
collection logo at top
        +
actual cosmetic assets as foreground content
        +
product/price/ownership actions
```

The collection detail must not require a separate collection `hero` image to display the cosmetics. The actual attack/defense/neutral dice assets and territory-skin previews are the product content.

Collection detail must support:

- collection name and short marketing copy;
- the collection logo;
- the collection background;
- number of cosmetics;
- user completion progress (`owned / total`);
- owned/unowned state per cosmetic;
- relevant bundles;
- individual products;
- `Completar conjunto` / `Completar coleção` when only part is owned.

### 4.4 Active collection validation

A collection exposed as a full visual storefront collection should resolve exactly one active mapping for each required V1 role:

```text
banner
background
logo
```

A broken/missing remote object must still degrade safely at runtime, but incomplete editorial configuration should be detected by validation/tests rather than normalized as an intentional V1 state.

## 5. Football collection reference fixture

The first concrete dice-only collection reference is `football`.

Current cosmetic assets conceptually map to:

```text
cosmetics/dice/football/attack.webp
cosmetics/dice/football/defense.webp
cosmetics/dice/football/neutral.webp
```

Collection merchandising maps to:

```text
store/collections/football/banner.webp
store/collections/football/background.webp
store/collections/football/logo.webp
```

`football` intentionally has no territory skin in its initial collection contents. This proves that mixed collections are supported but not required.

The banner advertises the three football dice. Opening it uses the Football background, places the Football logo at the top and renders the actual three dice assets as the main collection content.

## 6. Product composition

The conceptual target is:

```text
catalog.cosmetics
catalog.collections
catalog.products
catalog.product_items
catalog.offers
```

Exact SQL names may adapt to the current Economy V2 schema during implementation, but the domain separation is mandatory.

A product-item relation must support dice bundles:

```text
Product: football-dice-set
├── football-attack-die
├── football-defense-die
└── football-neutral-die
```

and mixed bundles:

```text
Product: celestial-complete-bundle
├── celestial-attack-die
├── celestial-defense-die
├── celestial-neutral-die
├── starry-sky-territory-skin
└── solar-ornamental-territory-skin
```

## 7. Individual dice and bundle pricing

Every dice cosmetic may have an individual product and price.

Example:

```text
Football Attack   500 credits
Football Defense  500 credits
Football Neutral  500 credits
```

A dice-set bundle may grant all three at a lower effective price:

```text
Individual subtotal  1500
Bundle price          1200
Savings                300
```

### 7.1 Partial ownership

Bundles must never charge again for component cosmetics the user already owns.

If the user already owns Football Attack:

```text
Owned
✓ Football Attack

Missing
- Football Defense  500
- Football Neutral  500
```

The bundle/completion price is calculated only over missing cosmetics.

The CTA changes from `Adquirir conjunto` to `Completar conjunto` / `Completar coleção` when appropriate.

### 7.2 Bundle discount

Bundle discount should be represented as basis points (`discount_bps`) or an equivalent exact integer representation.

Recommended deterministic calculation:

```text
subtotal = sum(current price of every missing item)
final_price = floor(subtotal * (10000 - discount_bps) / 10000)
```

All prices are integer credit units. No floating-point money math is allowed in the authoritative purchase path.

If no items remain missing, the product is considered acquired/completed and cannot be purchased again.

## 8. Progressive scarcity pricing

Selected cosmetics may use progressive pricing to create transparent scarcity/value appreciation.

Progressive pricing uses explicit tiers, not an unbounded formula that increments after every purchase.

Example:

```text
0–99 acquisitions       500
100–249                  575
250–499                  675
500–999                  775
1000+                    900
```

The authoritative counter is acquisition count per cosmetic item, regardless of whether the item was acquired individually or through a bundle.

Buying a mixed bundle increments the acquisition count only for newly granted cosmetic items.

Suggested conceptual structures:

```text
catalog.cosmetic_stats
- cosmetic_id
- acquisition_count

catalog.price_tiers
- cosmetic_id
- acquisitions_from
- acquisitions_until nullable
- price
```

Tier ranges must be deterministic and non-overlapping.

A product may also use fixed pricing. Progressive pricing is opt-in, not mandatory for all store content.

## 9. Price race protection

Storefront prices are previews. The server is authoritative.

Purchase requests must include the price the user confirmed, for example:

```json
{
  "offerId": "...",
  "expectedPrice": 1200
}
```

The server recalculates the current price inside the purchase transaction.

If the authoritative price differs from `expectedPrice`, the purchase must not silently charge the new value. It returns a price-change response such as:

```text
409 PRICE_CHANGED
```

The client then presents the new price and requires a new confirmation.

This is required for progressive tiers and dynamic completion bundles.

## 10. Timed availability and rotation

Availability and pricing are separate concerns.

Initial availability models:

- permanent;
- timed.

An offer may define:

```text
starts_at
ends_at
active
```

The server determines whether an offer can be purchased. Client countdowns are informational only.

A timed offer must communicate its end clearly. If the product may return later, the storefront must not imply permanent exclusivity.

Recommended copy:

```text
Disponível até <date>.
Pode retornar à rotação futuramente.
```

Truly never-returning editions require an explicit product/campaign decision and are not the default behavior.

## 11. Campaigns are not collections

A collection is a persistent thematic catalogue concept.

A campaign is temporary merchandising/editorial presentation.

Example:

```text
Collection: Celestial
Campaign: Operação Celestial
Window: 15/09 → 29/09
```

The collection may remain discoverable after the campaign ends.

Conceptual structures:

```text
catalog.campaigns
catalog.campaign_offers
```

Campaign-specific editorial assets, if later required, are independent from the three-role collection asset contract. Campaigns must not force collections to grow beyond `banner`, `background` and `logo`.

## 12. Store information architecture

The store is intentionally scrollable. Unlike Lobby/Matchmaking, it is an exploration surface and must not be compressed into a no-scroll viewport.

Primary navigation:

```text
Destaques | Dados | Territórios | Coleções
```

The upper store chrome should keep current currency and inventory access readily visible. A sticky header is allowed/recommended when it does not obscure content.

### 12.1 Destaques

Priority order:

1. active campaign/editorial promotion;
2. featured collection banners;
3. featured products;
4. new products;
5. featured bundles;
6. selected territory skins.

A collection banner is a first-class promotional CTA. Activating it opens collection detail.

Do not render the entire catalogue as one undifferentiated card grid.

### 12.2 Dados

A dice theme/set is presented as one coherent family while still exposing individual purchase choices.

Product detail must be able to display:

- attack die preview and individual price;
- defense die preview and individual price;
- neutral die preview and individual price;
- individual subtotal;
- bundle/completion price;
- savings;
- ownership status per die.

### 12.3 Territórios

Territory skins receive a dedicated merchandising surface.

Each territory-skin preview must demonstrate its recolorable nature across the six supported player colors without requiring six separate canonical texture files.

### 12.4 Coleções

Collection discovery prioritizes the `banner` artwork.

The opened collection surface uses:

```text
background → visual stage
logo       → identity/header
cosmetic assets → actual foreground products
```

A collection may be dice-only, territory-only or mixed. Completion progress spans every cosmetic that belongs to that collection.

## 13. Card and detail hierarchy

Store cards should prioritize:

1. art;
2. product/collection name;
3. type or collection context;
4. current price;
5. one meaningful badge only when required (`NOVO`, `EM ROTAÇÃO`, etc.).

Do not overload cards with rarity, sales count, tier, next tier, timer, category and multiple prices at the same time.

Detailed scarcity/tier information belongs in the product detail surface.

Owned products must not retain an active purchase CTA. They should transition to states such as:

- `Adquirido`;
- `Equipar`;
- `Equipado`;
- `Completar conjunto/coleção` when the product is a partially owned bundle.

## 14. Territory skin store contract

Territory skins are first-class cosmetic items with slot `territory_skin`.

The store must respect `docs/economy/territory-skins/SPEC.md`:

- player ownership color remains the primary gameplay signal;
- the skin is cosmetic only;
- selection/attack/hover/block state is rendered above the cosmetic layer;
- recolorable skins should use neutral/grayscale source assets where applicable;
- one source asset must adapt to all six player colors.

For the current grayscale texture strategy:

```text
white/light gray → highlight derived from owner color
mid gray         → owner/base color
charcoal/black   → darker owner-color shades
```

Simple single-asset skins may use one WebP directly. Complex skins may use multiple roles such as `surface`, `pattern`, `overlay` or future material maps.

## 15. Cloudflare R2 / object-storage contract

Cloudflare R2 is the planned S3-compatible object store for canonical cosmetic and merchandising assets.

No real bucket credential, token, account secret or access key may be committed to Git, SPEC or EVAL.

Bucket creation, access-policy configuration and real environment values are explicitly deferred to implementation.

### 15.1 Environment isolation

Planned buckets:

```text
war-brasil-assets-dev
war-brasil-assets-prod
```

Development and production must not share a mutable bucket namespace.

### 15.2 Planned server-only access variables

The implementation should reuse the parent Economy V2 storage contract and extend it only as needed:

```text
ASSET_STORAGE_URL
ASSET_STORAGE_REGION=auto
ASSET_STORAGE_BUCKET
ASSET_STORAGE_ACCESS_KEY_ID
ASSET_STORAGE_SECRET_ACCESS_KEY
```

Production delivery uses the R2 Custom Domain as the canonical public read path:

```text
ASSET_PUBLIC_BASE_URL=https://assets.bellumcivile.com
```

Postgres continues to store only stable object keys. Server-side DTO projection converts those keys into delivery URLs. Normal public image reads must therefore follow:

```text
Postgres object key
  -> publicAssetDeliveryUrl()
  -> assets.bellumcivile.com/<object-key>
  -> Cloudflare cache
  -> R2 on cache miss
```

The authenticated `/api/assets/*` routes and the `ASSET_STORAGE` binding remain fallback/private compatibility boundaries; they are not the production hot path for public cosmetic images.

All credential-bearing variables are server-only and must never use a public/client environment prefix. `ASSET_PUBLIC_BASE_URL` contains no credential and is a normal production runtime variable.

### 15.3 Key strategy

Postgres stores object keys, not complete URLs.

Examples:

```text
cosmetics/dice/football/attack.webp
cosmetics/dice/football/defense.webp
cosmetics/dice/football/neutral.webp
cosmetics/territory-skins/solar-ornamental.webp
store/collections/football/banner.webp
store/collections/football/background.webp
store/collections/football/logo.webp
```

The application resolves the correct environment/base URL at runtime/server boundary.

Runtime catalogue rendering must never depend on `ListObjects`/bucket directory discovery. The database maps each semantic asset role to an exact object key.

### 15.4 Suggested R2 layout

```text
cosmetics/
├── dice/
│   ├── football/
│   │   ├── attack.webp
│   │   ├── defense.webp
│   │   └── neutral.webp
│   ├── celestial/
│   ├── viking/
│   └── military/
│
└── territory-skins/
    ├── starry-sky.webp
    ├── solar-ornamental.webp
    ├── brazil-ornamental.webp
    └── multi-asset-skin/
        ├── surface.webp
        ├── pattern.svg
        └── overlay.webp

store/
├── collections/
│   ├── football/
│   │   ├── banner.webp
│   │   ├── background.webp
│   │   └── logo.webp
│   ├── celestial/
│   │   ├── banner.webp
│   │   ├── background.webp
│   │   └── logo.webp
│   └── ...
└── campaigns/
    └── ...
```

### 15.5 Collection object policy

Collection runtime rendering should request only the exact three configured editorial keys plus the exact cosmetic keys needed for visible items.

The collection system must not derive behavior from directory names alone. `football` is a stable collection slug, while DB IDs remain the canonical relational identifiers.

## 16. Target database model

The implementation migration must evolve the existing Economy V2 schema toward the following capabilities. Exact physical table names may preserve/rename existing structures after repository/database audit, but the logical responsibilities are mandatory.

### 16.1 Catalogue

```text
collections
- id
- slug
- name
- description/marketing metadata
- active

collection_assets
- id
- collection_id
- role (banner | background | logo)
- object_key
- mime_type

cosmetics
- id
- collection_id nullable
- slug
- name
- slot
- rarity
- active

cosmetic_assets
- id
- cosmetic_id
- role
- object_key
- mime_type
- version

products
- id
- collection_id nullable
- slug
- name
- product_type (single | bundle)
- bundle_discount_bps nullable
- active

product_items
- product_id
- cosmetic_id
- position

offers
- id
- product_id
- pricing_model
- starts_at nullable
- ends_at nullable
- active
- priority

price_tiers
- cosmetic_id
- acquisitions_from
- acquisitions_until nullable
- price

cosmetic_stats
- cosmetic_id
- acquisition_count

campaigns
- id
- slug
- title
- marketing metadata
- starts_at
- ends_at
- priority
- active

campaign_offers
- campaign_id
- offer_id
- position
```

For V1 collection assets, the DB should enforce or validate:

- role belongs to `banner | background | logo`;
- at most one active mapping exists per `(collection_id, role)`;
- a store-visible collection has all three roles configured.

### 16.2 Economy / ownership

The implementation must preserve or evolve the existing Economy V2 equivalents for:

```text
user_cosmetics
user_cosmetic_loadout
store_purchases
store_purchase_items
wallet / ledger
```

`user_cosmetics` must prevent duplicate ownership of the same cosmetic per user.

Purchase history must preserve the commercial product/offer and enough price snapshots to reproduce what the user paid at purchase time.

## 17. Purchase transaction

A purchase must be atomic and server-authoritative.

Recommended sequence:

1. begin DB transaction;
2. lock the relevant offer/product state;
3. validate `starts_at`, `ends_at` and active state;
4. read current user ownership;
5. derive missing product items;
6. if nothing is missing, reject as already owned/completed;
7. lock/read relevant cosmetic counters in a stable order;
8. derive current item prices/tiers;
9. calculate bundle discount when applicable;
10. compare with `expectedPrice`;
11. if different, abort with `PRICE_CHANGED` and no mutation;
12. validate wallet balance;
13. debit wallet through existing ledger rules;
14. grant only missing cosmetics;
15. increment acquisition counters for newly granted cosmetics;
16. record purchase and item-level price snapshots;
17. commit.

The transaction must be concurrency-safe around tier boundaries.

## 18. Database migration strategy

No migration is executed by this documentation change.

Database migration belongs to the implementation phase and must follow the migration discipline already established by Economy V2.

Before creating SQL, implementation must:

1. inspect the newest migration number in the repository;
2. inspect the current Economy V2 catalogue/inventory tables and live-compatible assumptions;
3. allocate a migration number strictly after the newest repository migration;
4. prefer additive/forward-compatible changes first;
5. backfill existing dice cosmetics, offers and ownership into the new model;
6. introduce products/product-items and collection semantics;
7. add `territory_skin` as a supported cosmetic slot/type;
8. add progressive-pricing structures and counters;
9. add collection merchandising asset mappings with `banner/background/logo` roles;
10. add constraints/indexes after required backfill where necessary;
11. switch application reads/writes only after the migrated shape is valid;
12. defer destructive cleanup of obsolete columns/tables to a later migration unless proven safe.

Migration and seed operations must be idempotent or safely guarded according to existing repository conventions.

The Football collection should be usable as an implementation/seed fixture for validating the new three-asset collection contract and individual/bundled dice products.

## 19. Rollout order

Recommended implementation order:

1. audit current Economy V2 schema/store code and latest migration;
2. provision/configure R2 dev access and server-only environment contract;
3. write and run the additive DB migration against the implementation environment;
4. migrate/backfill current dice catalogue into item/product/collection semantics;
5. implement object-key asset resolver;
6. implement the three-role collection asset contract (`banner/background/logo`);
7. seed/integrate Football as the first dice-only collection fixture;
8. add territory-skin catalogue support and six-color previews;
9. implement individual dice products;
10. implement dynamic bundle/completion pricing;
11. implement progressive tiers and concurrency-safe purchase path;
12. implement mixed collections and completion flows;
13. implement campaigns/timed offers;
14. restructure storefront UI into Destaques / Dados / Territórios / Coleções;
15. reconcile parent `docs/economy/SPEC.md` and `EVAL.md` with the final implementation;
16. complete EVAL evidence and regression tests.

## 20. Explicit non-goals of this design pass

This documentation change does **not**:

- provision or mutate an R2 bucket;
- upload the Football assets to R2;
- create Cloudflare API tokens;
- commit credentials;
- execute a database migration;
- change user balances;
- add a currency-earning method;
- introduce real-money purchases;
- add cosmetic trading or gifting;
- implement the storefront code itself;
- require extra collection artwork beyond `banner`, `background` and `logo`.

Those actions require the subsequent implementation phase and its EVAL gates.
