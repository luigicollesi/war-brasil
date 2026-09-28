# Dice Pip Collection Style — Design

Date: 2026-09-28  
Branch: `feat/dice-pip-collection-style`

## Goal

Add two visual characteristics to a dice collection so all three dice in the collection share the same pip presentation:

1. `dice_pip_dark`
   - `false`: current behavior.
   - `true`: store preview uses white pips; gameplay uses a lighter variant of the owning player's color.

2. `dice_pip_compact`
   - `false`: current spread pip layout.
   - `true`: pips are pulled toward the center while retaining readable gaps.

These settings are presentation-only. They must not affect dice RNG, physics, results, combat rules, ownership, pricing, or purchases.

## Compatibility

Both fields default to `false`, so existing collections preserve today's behavior without data backfill:

- light pip color mode
- spread pip layout

Standalone/default dice outside collections also keep the current behavior.

## Persistence

### catalog.collections

Add:

```sql
dice_pip_dark boolean NOT NULL DEFAULT false
dice_pip_compact boolean NOT NULL DEFAULT false
```

The setting belongs to the collection, not to each individual die.

### game.player_cosmetic_loadouts

Add the same frozen presentation fields:

```sql
dice_pip_dark boolean NOT NULL DEFAULT false
dice_pip_compact boolean NOT NULL DEFAULT false
```

Reason: gameplay currently freezes mutable cosmetic catalog state at match start. The runtime intentionally does not rejoin `catalog.*` after the match begins. These values therefore need to be captured alongside `asset_ref`, `body_color`, and `body_highlight_color`.

For a cosmetic that has no collection, both values resolve to `false`.

## Database migration

Create managed migration:

`src/lib/db/migrations/managed/079-dice-pip-collection-style.sql`

The migration must:

- add both columns to `catalog.collections` with non-null false defaults;
- add both columns to `game.player_cosmetic_loadouts` with non-null false defaults;
- be safe for existing data;
- avoid triggers or duplicated per-die configuration.

No existing collection is switched to dark/compact by this migration. Collection-specific values are separate catalog data updates.

## Economy/storefront contract

Extend `StorefrontCollection` with:

```ts
dicePipDark: boolean;
dicePipCompact: boolean;
```

Extend `StorefrontCollectionRow` and `listStorefrontCollections()` to select the two collection columns.

`collectionsFromRows()` projects them once per collection.

Extend `StoreShowcaseView` with the same two booleans. Offer-only showcases use `false/false`; collection showcases inherit the collection values.

The individual `CosmeticCatalogItem` contract does not receive these fields because the configuration is intentionally collection-level.

## Pip layout API

Keep the existing public constant for backward compatibility, but introduce an explicit layout resolver in `src/lib/client/dice/pip-layout.ts`:

```ts
type DicePipSpacing = "spread" | "compact";

function dicePipLayout(
  value: DiceValue,
  spacing: DicePipSpacing = "spread",
): readonly (readonly [number, number])[];
```

### Spread

Use the exact existing coordinates.

### Compact

Use a centered layout approximately equivalent to:

- horizontal columns: 36 / 64 instead of 30 / 70;
- six-pip vertical rows: 32 / 50 / 68 instead of 26 / 50 / 74;
- center remains 50 / 50.

The layout topology and pip count never change.

Both the CanvasTexture path and the 2D `GameDie` fallback must use the same resolver so 2D and 3D cannot drift.

## Pip color API

Introduce a single presentation helper, for example:

`src/lib/client/dice/pip-presentation.ts`

Responsibilities:

- resolve store preview pip color;
- resolve gameplay pip color;
- derive a lighter player color deterministically when dark mode is active.

Suggested API:

```ts
function storeDicePipColor(dark: boolean): string;

function gameplayDicePipColor(
  playerColor: PlayerColor,
  dark: boolean,
): string;
```

Rules:

- store + light => current `DICE_VISUAL_PIP_COLOR`;
- store + dark => white;
- gameplay + light => current `playerColorHex(playerColor)`;
- gameplay + dark => lighter version of the same player color.

The lightening function must preserve hue identity and raise luminance with a bounded deterministic transform. It must not depend on browser CSS parsing.

## 3D texture pipeline

Extend `DiceTextureOptions` with:

```ts
pipCompact?: boolean;
```

Update cache keys in:

- `dice-assets-manager.ts`
- `use-dice-face-textures.ts`

so compact and spread textures can never share a stale cached CanvasTexture.

`createDiceFaceTexture()` passes the spacing mode to `drawPips()`.

No change is required to geometry or physics.

## Store preview behavior

`DiceShowcaseModel` receives collection-level pip flags through `StoreShowcaseView`.

For collection showcases:

- `dicePipDark=true` => white pips;
- `dicePipCompact=true` => compact layout.

For offer-only/standalone showcases:

- light + spread.

All three dice in a collection therefore share the same presentation settings automatically.

## Game snapshot and runtime

Extend `GameCosmeticSelection` with:

```ts
dicePipDark: boolean;
dicePipCompact: boolean;
```

For territory selections these values remain false.

At match start, `capturePlayerCosmeticLoadouts()` resolves each equipped/bot/default cosmetic and joins its collection to capture the two collection fields. The INSERT/UPSERT into `game.player_cosmetic_loadouts` persists them.

`loadRoomPlayerCosmetics()` returns only the frozen snapshot values, preserving the existing no-catalog-read invariant during an active match.

Default in-memory cosmetic selections use false/false.

## Battle rendering

Every battle dice presentation path must consume the frozen flags:

- cinematic 3D dice;
- regular 3D dice;
- static 2D results;
- reduced-motion / WebGL fallback.

For dark mode:

```
pipColor = gameplayDicePipColor(player.color, true)
```

For light mode:

```
pipColor = playerColorHex(player.color)
```

For compact mode, the same `pipCompact` flag is passed to both 3D CanvasTexture generation and `GameDie`.

The attacker and defender can have different settings in the same battle.

## Store 2D previews

Any store surface that renders pips separately from the 3D showcase must use the collection setting where collection context is available. A plain individual offer without collection context remains false/false.

## Tests

Add or update tests to cover:

1. migration contains both columns with `NOT NULL DEFAULT false`;
2. storefront repository selects both collection fields;
3. `StorefrontCollection` projection exposes both booleans;
4. collection showcase inherits flags;
5. offer showcase defaults to false/false;
6. spread coordinates remain byte-for-byte equivalent to current coordinates;
7. compact coordinates have correct pip counts and are closer to center;
8. texture cache key differs between compact/spread;
9. store dark mode resolves to white;
10. gameplay dark mode produces a lighter variant while preserving player-color distinction;
11. match snapshot captures collection settings;
12. runtime load uses frozen snapshot values and does not need `catalog.*`;
13. 2D `GameDie` and 3D texture generation both consume the shared layout resolver;
14. existing dice without collection remain light + spread.

## Non-goals

- No changes to dice physics.
- No changes to RNG or combat resolution.
- No arbitrary per-die pip settings.
- No user-facing toggle.
- No automatic choice based on body color.
- No changes to pricing or collection ownership.
- No Black Dragon-specific hardcoding in React components.

## Initial catalog usage

After the architecture lands, collection rows can opt in independently with simple data updates, e.g.:

```sql
UPDATE catalog.collections
SET dice_pip_dark = true,
    dice_pip_compact = true,
    updated_at = now()
WHERE id = 'collection.black-dragon';
```

The architecture itself must remain generic for future collections.
