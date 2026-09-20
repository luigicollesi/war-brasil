# Economy Storefront V2 — Adjusted SPEC/EVAL Implementation Plan

> Source of truth for the adjustments: `feature/economy-store-collections` at commit `4f9451c` (`docs/economy/store/SPEC.md` + `EVAL.md`).

## Goal

Align `feature/economy-storefront-v2` with the revised Storefront/Collections contract before expanding the UI. Preserve the server-authoritative Economy V2 wallet/ledger/inventory semantics while introducing the collection-first storefront required by the updated EVAL.

## Task 1 — Reconcile tests with the revised collection contract

**Files**
- Modify: `tests/economy-storefront-schema.test.mjs`
- Modify: `tests/economy-v2-storefront-contract.test.mjs`
- Modify: `tests/integration/economy-migration.test.mjs`

**RED requirements**
- V1 collection roles are a closed set: `banner | background | logo`.
- `hero`, `card`, `thumbnail` cannot become collection runtime dependencies.
- At most one active asset mapping exists per `(collection, role)`.
- Football exists as a dice-only collection containing attack/defense/neutral and no territory skin.
- Football has active exact-key mappings for all three V1 roles:
  - `store/collections/football/banner.webp`
  - `store/collections/football/background.webp`
  - `store/collections/football/logo.webp`
- Football retains distinct single-die products and one bundle product.

Run targeted structural tests after writing them and confirm they fail for the expected missing/incorrect contract.

## Task 2 — Fix migration 043 for revised V1 merchandising

**Files**
- Modify: `src/lib/db/migrations/managed/043-economy-storefront-v2.sql`

**Implementation**
- Replace the old five-role collection constraint with exactly `banner`, `background`, `logo`.
- Model collection asset mappings with an `active` flag and a partial unique index enforcing at most one active mapping per `(collection_id, role)` while permitting future historical replacements.
- Seed/backfill Football as the reference dice-only collection.
- Seed Football’s three exact merchandising keys.
- Preserve existing collection membership derived from `set.futebol` and verify no territory skin is added to Football.
- Keep `catalog.cosmetic_assets` independent from collection editorial assets.
- Keep campaign assets independent from the three-role collection contract.

## Task 3 — Introduce collection read model

**Files**
- Modify: `src/lib/economy/economy-contract.ts`
- Modify: `src/lib/server/economy/economy-storefront-repository.ts`
- Modify: `src/lib/server/economy/economy-service.ts`
- Test: `tests/economy-v2-storefront-contract.test.mjs`

**Contract**
Add collection data without removing legacy `sets` during rollout:
- collection id/slug/name/description;
- `banner`, `background`, `logo` exact object keys;
- owned/total progress;
- component cosmetics with ownership/equipped state;
- available single products/offers;
- bundle/completion offer and authoritative preview price;
- `complete` / `partiallyOwned` state.

Only expose a collection as fully merchandised when exactly one active asset exists for every required V1 role. Missing remote bytes still degrade at render time; incomplete DB configuration must be detectable by tests.

## Task 4 — Repair the purchase/client contract

**Files**
- Modify: `src/components/profile/v4/profile-store.tsx`
- Test: `tests/profile-v4-purchase.test.mjs`
- Test: `tests/profile-v4-store.test.mjs`

**Implementation**
- Replace remaining `territory_effect` UI references with `territory_skin`.
- Send `expectedPrice` with every purchase request.
- Treat `PRICE_CHANGED` / `ECONOMY_PRICE_CHANGED` as a stale confirmation: refresh storefront state and require a new user action rather than silently retrying.
- Remove legacy copy claiming partial bundles keep full price.
- Use `Adquirir conjunto`, `Completar conjunto/coleção`, and `Adquirido` according to ownership state.

## Task 5 — Build collection-first storefront V1

**Files**
- Modify: `src/components/profile/v4/profile-store.tsx`
- Add focused collection presentation components if the current file becomes too large.
- Test: `tests/profile-v4-store.test.mjs`
- Add/extend interaction tests for collection opening.

**UI requirements**
- Store remains scrollable.
- Provide navigation semantics for `Destaques | Dados | Territórios | Coleções` without requiring all later content to be finished in this slice.
- Football banner is the discovery CTA.
- Opening Football composes:
  - background as visual stage;
  - logo near the top identity region;
  - canonical attack/defense/neutral dice assets in the foreground;
  - ownership progress;
  - individual purchase actions;
  - bundle/completion action with current preview price.
- No collection hero/card asset dependency.
- Preserve keyboard/touch activation semantics.

## Task 6 — Complete pricing/race integration

**Files**
- Modify only as needed: `src/lib/economy/storefront-pricing.ts`
- Modify only as needed: `src/lib/server/economy/storefront-quote-repository.ts`
- Modify: `src/lib/server/economy/economy-service.ts`
- Extend: `tests/economy-storefront-pricing.test.mjs`
- Extend: `tests/economy-storefront-purchase-pricing.test.mjs`
- Extend integration purchase tests.

**Gates**
- 0/3, 1/3, 2/3, 3/3 Football ownership matrix.
- Missing-item subtotal only.
- Exact integer BPS discount.
- 3/3 cannot repurchase.
- `expectedPrice` checked after authoritative recalculation inside the transaction.
- Progressive tier counters increment only for newly granted cosmetics and remain race-safe.

## Task 7 — Timed offers, campaigns, territory skins and R2 follow-up

After the collection slice is stable:
- timed availability driven by server time;
- campaign editorial model independent from collections;
- territory-skin sale/read model and mixed-collection fixture;
- object-storage validation for exact-key reads, no runtime listing, server-only credentials and dev/prod isolation.

Do not make real R2 credentials or production data part of automated tests.

## Task 8 — Verification

Run, in order, with fresh output:

```bash
npm run test:compile
node --test tests/economy-storefront-schema.test.mjs
node --test tests/economy-storefront-pricing.test.mjs
node --test tests/economy-storefront-purchase-pricing.test.mjs
node --test tests/economy-v2-storefront-contract.test.mjs
node --test tests/profile-v4-purchase.test.mjs
node --test tests/profile-v4-store.test.mjs
npm run test:run
npm run test:db
npm run lint
npm run build
```

Database verification must include applying migrations through `043` on an isolated/dev database and checking rerun/idempotency behavior. Do not claim the store ready to merge while any blocker gate or migration verification remains unproven.
