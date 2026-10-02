import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/080-gunslinger-dice-collection.sql",
  "utf8",
);
const bodyPresentation = readFileSync(
  "src/lib/shared/dice-body-presentation.ts",
  "utf8",
);
const gameCosmetics = readFileSync(
  "src/lib/server/game-cosmetic-loadout-service.ts",
  "utf8",
);
const entitlementRepository = readFileSync(
  "src/lib/server/economy/entitlement-repository.ts",
  "utf8",
);
const economyService = readFileSync(
  "src/lib/server/economy/economy-service.ts",
  "utf8",
);

const gunslingerDice = [
  "dice.attack.gunslinger",
  "dice.defense.gunslinger",
  "dice.neutral.gunslinger",
];

test("Gunslinger usa os prefixos canônicos de object storage", () => {
  for (const path of [
    "cosmetics/dice/gunslinger/attack.webp",
    "cosmetics/dice/gunslinger/defense.webp",
    "cosmetics/dice/gunslinger/neutral.webp",
    "store/collections/gunslinger/banner.webp",
    "store/collections/gunslinger/background.webp",
    "store/collections/gunslinger/logo.webp",
  ]) {
    assert.match(migration, new RegExp(path.replaceAll("/", "\\/")));
  }
});

test("Gunslinger possui entidade editorial com política comercial explícita", () => {
  assert.match(
    migration,
    /id, slug, name, description, active, sort_order,[\s\S]*featured, promotion_discount_bps/,
  );
  assert.match(
    migration,
    /'collection\.gunslinger',[\s\S]*'gunslinger',[\s\S]*TRUE,[\s\S]*80,[\s\S]*FALSE,[\s\S]*0/,
  );
  assert.match(migration, /featured=FALSE/);
  assert.match(migration, /promotion_discount_bps=0/);
});

test("Gunslinger pertence a um cosmetic_set dark e compact", () => {
  assert.match(migration, /'set\.gunslinger'/);
  assert.match(
    migration,
    /status, sort_order, dice_pip_dark, dice_pip_compact[\s\S]*'available',[\s\S]*80,[\s\S]*TRUE,[\s\S]*TRUE/,
  );

  for (const cosmeticId of gunslingerDice) {
    assert.match(
      migration,
      new RegExp(
        `\\('set\\.gunslinger', '${cosmeticId.replaceAll(".", "\\.")}', [0-2]\\)`,
      ),
    );
  }
});

test("Gunslinger possui configuração completa para renderização congelada", () => {
  assert.match(
    migration,
    /collection_id,[\s\S]*body_color, body_highlight_color/,
  );
  assert.match(bodyPresentation, /dice_attack: "#BF4D4D"/);
  assert.match(bodyPresentation, /dice_defense: "#3984C6"/);
  assert.match(bodyPresentation, /dice_neutral: "#3F8B68"/);
  assert.match(bodyPresentation, /DARK_BODY_CHANNEL_RATIO = 0\.58/);
  assert.match(
    gameCosmetics,
    /COALESCE\(cosmetic_set\.dice_pip_dark,FALSE\) AS dice_pip_dark/,
  );
  assert.match(
    gameCosmetics,
    /COALESCE\(cosmetic_set\.dice_pip_compact,FALSE\) AS dice_pip_compact/,
  );
  assert.match(
    gameCosmetics,
    /body_color,body_highlight_color,dice_pip_dark,dice_pip_compact,captured_at/,
  );
});

test("Gunslinger é uma collection premium de exatamente três dados", () => {
  assert.match(migration, /'collection\.gunslinger'/);
  assert.doesNotMatch(migration, /territory\.(effect|skin)\.gunslinger/);
  assert.match(
    migration,
    /'product\.gunslinger'[\s\S]*'bundle',[\s\S]*2000,[\s\S]*TRUE/,
  );
  assert.match(
    migration,
    /'offer\.gunslinger'[\s\S]*'campaign-credit',[\s\S]*1200/,
  );

  for (const cosmeticId of gunslingerDice) {
    assert.match(
      migration,
      new RegExp(
        `\\('product\\.gunslinger', '${cosmeticId.replaceAll(".", "\\.")}', [0-2]\\)`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `\\('offer\\.gunslinger', '${cosmeticId.replaceAll(".", "\\.")}', [0-2]\\)`,
      ),
    );
  }
});

test("Gunslinger mantém preço premium individual de 500 créditos", () => {
  for (const cosmeticId of gunslingerDice) {
    assert.match(
      migration,
      new RegExp(
        `\\('${cosmeticId.replaceAll(".", "\\.")}', 'fixed', 500\\)`,
      ),
    );
  }
});

test("produtos Gunslinger possuem entitlements autoritativos para compra", () => {
  assert.match(migration, /INSERT INTO catalog\.product_entitlements/);

  for (const [productId, cosmeticId] of [
    ["product.single.dice.attack.gunslinger", "dice.attack.gunslinger"],
    ["product.single.dice.defense.gunslinger", "dice.defense.gunslinger"],
    ["product.single.dice.neutral.gunslinger", "dice.neutral.gunslinger"],
  ]) {
    assert.match(
      migration,
      new RegExp(
        `\\('${productId.replaceAll(".", "\\.")}', 0, 'game_cosmetic', '${cosmeticId.replaceAll(".", "\\.")}'\\)`,
      ),
    );
  }

  gunslingerDice.forEach((cosmeticId, position) => {
    assert.match(
      migration,
      new RegExp(
        `\\('product\\.gunslinger', ${position}, 'game_cosmetic', '${cosmeticId.replaceAll(".", "\\.")}'\\)`,
      ),
    );
  });
});

test("Gunslinger participa das tabelas de observabilidade econômica", () => {
  assert.match(
    migration,
    /INSERT INTO catalog\.cosmetic_stats\(cosmetic_id, acquisition_count\)/,
  );
  assert.match(
    migration,
    /COUNT\(owned\.user_id\)::bigint[\s\S]*LEFT JOIN inventory\.cosmetics owned/,
  );
  assert.match(
    entitlementRepository,
    /INSERT INTO economy\.purchase_entitlements/,
  );
  assert.match(
    entitlementRepository,
    /INSERT INTO economy\.purchase_items\(purchase_id,cosmetic_id,unit_price\)/,
  );
  assert.match(
    entitlementRepository,
    /UPDATE catalog\.cosmetic_stats[\s\S]*acquisition_count=acquisition_count\+1/,
  );
  assert.match(
    economyService,
    /snapshotPurchaseCommercialContext\([\s\S]*purchaseId,[\s\S]*offer\.product_id/,
  );
  assert.match(
    economyService,
    /insertPurchaseLedgerEntry\(userId, purchaseId, price, client\)/,
  );
});
