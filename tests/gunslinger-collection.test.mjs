import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/080-gunslinger-dice-collection.sql",
  "utf8",
);

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

test("Gunslinger pertence a um cosmetic_set dark e compact", () => {
  assert.match(migration, /'set\.gunslinger'/);
  assert.match(
    migration,
    /status, sort_order, dice_pip_dark, dice_pip_compact[\s\S]*'available',[\s\S]*80,[\s\S]*TRUE,[\s\S]*TRUE/,
  );

  for (const cosmeticId of [
    "dice.attack.gunslinger",
    "dice.defense.gunslinger",
    "dice.neutral.gunslinger",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `\\('set\\.gunslinger', '${cosmeticId.replaceAll(".", "\\.")}', [0-2]\\)`,
      ),
    );
  }
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

  for (const cosmeticId of [
    "dice.attack.gunslinger",
    "dice.defense.gunslinger",
    "dice.neutral.gunslinger",
  ]) {
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
  for (const cosmeticId of [
    "dice.attack.gunslinger",
    "dice.defense.gunslinger",
    "dice.neutral.gunslinger",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `\\('${cosmeticId.replaceAll(".", "\\.")}', 'fixed', 500\\)`,
      ),
    );
  }
});
