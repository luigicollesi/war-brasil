import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("territory_effect usa a mesma boundary owned-only dos demais cosméticos", () => {
  const contract = source("src/lib/economy/economy-contract.ts");
  const service = source("src/lib/server/economy/economy-service.ts");
  const repository = source("src/lib/server/economy/economy-repository.ts");

  assert.match(contract, /"territory_effect"/);
  assert.match(service, /const item = await findOwnedCosmetic\(userId, cosmeticId, client\)/);
  assert.match(service, /"ECONOMY_COSMETIC_NOT_OWNED"/);
  assert.match(service, /if \(item\.slot !== slot\)/);
  assert.match(service, /if \(item\.status !== "available"\)/);
  assert.match(service, /await equipOwnedCosmetic\(userId, slot, cosmeticId, client\)/);

  assert.match(repository, /FROM inventory\.cosmetics owned/);
  assert.match(repository, /owned\.user_id=\$1::uuid/);
  assert.match(repository, /owned\.cosmetic_id=\$2/);
  assert.match(repository, /profile\.cosmetic_loadout/);
});

test("equipagem continua independente de wallet, ledger e purchase", () => {
  const service = source("src/lib/server/economy/economy-service.ts");
  const equipSection = service.slice(service.indexOf("export async function equipCosmetic"));

  assert.doesNotMatch(equipSection, /wallet|ledger|purchase|offer/i);
  assert.match(equipSection, /BEGIN/);
  assert.match(equipSection, /COMMIT/);
  assert.match(equipSection, /ROLLBACK/);
});
