# Dice Pip Cosmetic Set Style — Design

Date: 2026-09-28  
Branch: `feat/dice-pip-collection-style`

## Goal

Add two presentation characteristics shared by the three dice of one canonical cosmetic set:

1. `dice_pip_dark`
   - `false`: keep the current dark/store pip treatment and normal player-color gameplay pips.
   - `true`: store/showcase pips are white; gameplay pips use a lighter deterministic variant of the owning player's color.

2. `dice_pip_compact`
   - `false`: keep the current spread pip layout.
   - `true`: move pips toward the center while retaining readable gaps.

These settings are presentation-only. They must not affect dice RNG, physics, combat results, ownership, offers, collections, pricing, or purchases.

## Source of truth

The canonical source of truth is `catalog.cosmetic_sets`.

The settings do **not** belong to `catalog.collections` and do **not** belong to individual rows in `catalog.cosmetics`.

A commercial collection may contain a cosmetic set, but commercial grouping and dice visual grouping are different concerns. Dice outside a commercial collection still resolve presentation from their `cosmetic_set`.

`catalog.cosmetic_set_items` must enforce one set per cosmetic through a unique constraint on `cosmetic_id`. This makes the effective set lookup unambiguous.

Current invariant:

- every dice cosmetic belongs to exactly one cosmetic set;
- every dice cosmetic set contains exactly one `dice_attack`, one `dice_defense`, and one `dice_neutral`;
- internal sets such as `set.default` and `set.brazil` may be `retired` commercially while remaining valid visual configuration sources.

## Persistence

### catalog.cosmetic_sets

Canonical fields:

```sql
dice_pip_dark boolean NOT NULL DEFAULT false
dice_pip_compact boolean NOT NULL DEFAULT false
```

Initial configuration:

```text
set.cosmic-night   dark=true   compact=false
set.black-dragon   dark=true   compact=false
all other current sets
                   dark=false  compact=false
```

### catalog.collections

No pip presentation fields are stored here.

Any transitional `dice_pip_dark` or `dice_pip_compact` columns must be removed.

### catalog.cosmetic_set_items

The membership relation is authoritative for resolving a die's visual set.

Required invariant:

```sql
UNIQUE (cosmetic_id)
```

### game.player_cosmetic_loadouts

Keep frozen presentation fields:

```sql
dice_pip_dark boolean NOT NULL DEFAULT false
dice_pip_compact boolean NOT NULL DEFAULT false
```

Reason: gameplay freezes mutable cosmetic catalog state at match start. Runtime intentionally does not rejoin `catalog.*` after a match begins.

## Database migration

Create managed migration:

`src/lib/db/migrations/managed/079-dice-pip-cosmetic-set-style.sql`

The migration must be safe both for:

- a clean database coming from migration 078; and
- production where the structural change was already applied manually.

It must:

- add both fields to `catalog.cosmetic_sets` with non-null false defaults;
- remove the obsolete fields from `catalog.collections` if they exist;
- keep/add the two snapshot fields in `game.player_cosmetic_loadouts`;
- create any missing internal/current cosmetic sets needed by the current catalog;
- guarantee the three dice memberships for those sets;
- enforce unique `cosmetic_id` membership;
- set dark mode only for `set.cosmic-night` and `set.black-dragon`;
- keep compact mode false for all current sets.

## Economy/storefront contract

`CosmeticSet` exposes:

```ts
dicePipDark: boolean;
dicePipCompact: boolean;
```

`listStorefrontSetItems()` reads both fields from `catalog.cosmetic_sets`, and `setsFromRows()` projects them once per set.

Commercial `StorefrontCollection` remains unchanged. It represents merchandising, assets, promotion and bundle relationships only.

### Effective showcase presentation

`StoreShowcaseItem` exposes the effective presentation values:

```ts
dicePipDark: boolean;
dicePipCompact: boolean;
```

For a dice item, `resolveStoreShowcaseView()` finds the canonical `CosmeticSet` containing the cosmetic and projects its flags.

For territory cosmetics, both flags resolve to false.

An offer that is not attached to a commercial collection still inherits the flags from its cosmetic set. No "offer-only = false/false" shortcut is allowed.

## Pip layout API

Keep the existing public spread constant for backward compatibility and add an explicit resolver in `src/lib/client/dice/pip-layout.ts`:

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

Use centered coordinates approximately equivalent to:

- horizontal columns: 36 / 64 instead of 30 / 70;
- six-pip vertical rows: 32 / 50 / 68 instead of 26 / 50 / 74;
- center remains 50 / 50.

The topology and pip count never change.

Both the CanvasTexture path and the 2D `GameDie` fallback must use the same resolver.

## Pip color API

Add a single presentation helper in `src/lib/client/dice/pip-presentation.ts`.

Responsibilities:

- resolve store/showcase pip color;
- resolve gameplay pip color;
- derive a lighter player color deterministically when dark mode is active.

API:

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

The lightening transform must be deterministic and independent of browser CSS parsing.

## 3D texture pipeline

Extend `DiceTextureOptions` with:

```ts
pipCompact?: boolean;
```

Include compact/spread in every texture cache key.

`createDiceFaceTexture()` passes the effective spacing mode to the shared pip-layout resolver.

No geometry or physics change is required.

## Store preview behavior

`DiceShowcaseModel` receives the effective `StoreShowcaseItem` flags.

For any dice, regardless of whether it belongs to a commercial collection:

- `dicePipDark=true` => white pips;
- `dicePipCompact=true` => compact layout.

The three dice in the canonical set share the same settings through the set relationship.

## Game snapshot and runtime

Extend `GameCosmeticSelection` with:

```ts
dicePipDark: boolean;
dicePipCompact: boolean;
```

At match start, `capturePlayerCosmeticLoadouts()` resolves each selected cosmetic and joins:

```text
resolved cosmetic
  -> catalog.cosmetic_set_items
  -> catalog.cosmetic_sets
```

The two flags are copied into `game.player_cosmetic_loadouts`.

Territory cosmetics and any defensive legacy row with no set resolve to false/false.

`loadRoomPlayerCosmetics()` reads only the frozen snapshot values. It must preserve the existing no-`catalog.*` runtime invariant.

## Battle and order-roll rendering

Every gameplay dice presentation path consumes the frozen flags:

- battle cinematic 3D dice;
- static battle 2D results;
- reduced-motion / WebGL fallback;
- neutral order-roll cinematic;
- neutral order-roll 2D result.

For dark mode:

```ts
pipColor = gameplayDicePipColor(player.color, true)
```

For normal mode:

```ts
pipColor = gameplayDicePipColor(player.color, false)
```

Compact mode is passed to both CanvasTexture generation and `GameDie`.

Attacker, defender and neutral/order dice may therefore use different frozen settings when their equipped sets differ.

## Tests

Cover at least:

1. migration adds fields to `catalog.cosmetic_sets`, not `catalog.collections`;
2. migration keeps the snapshot fields;
3. membership uniqueness is enforced on `cosmetic_id`;
4. set repository selects both flags;
5. `CosmeticSet` projection exposes both booleans;
6. a collection showcase resolves flags from the cosmetic set, not the collection;
7. an offer outside a collection also resolves flags from its cosmetic set;
8. spread coordinates remain equivalent to the current layout;
9. compact coordinates retain correct pip counts and move outer pips inward;
10. texture cache keys differ between compact and spread;
11. store dark mode resolves to white;
12. gameplay dark mode produces a lighter deterministic player-color variant;
13. match snapshot captures set settings;
14. runtime load uses only frozen snapshot values;
15. 2D and 3D rendering use the shared layout resolver;
16. default/internal dice remain light + spread;
17. Cosmic Night and Black Dragon are dark + spread.

## Non-goals

- No changes to dice physics.
- No changes to RNG or combat resolution.
- No arbitrary per-die persisted pip settings.
- No user-facing toggle.
- No automatic mode selection from body colors.
- No Black Dragon/Cosmic Night hardcoding in React components.
- No use of commercial collections as the visual source of truth.

## Initial catalog usage

Catalog configuration is data-driven:

```sql
UPDATE catalog.cosmetic_sets
SET dice_pip_dark = true,
    dice_pip_compact = false,
    updated_at = now()
WHERE id IN ('set.cosmic-night', 'set.black-dragon');
```

Future sets can opt into either characteristic without changing rendering code.
