import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentProfileCommandSnapshot,
  searchProfileCommanders,
} from "../.test-build/profile/profile-command-data.js";

test("Quartel V2 expõe identidade, título e presença por contrato", async () => {
  const snapshot = await getCurrentProfileCommandSnapshot();

  assert.equal(snapshot.identity.availability, "available");
  assert.equal(snapshot.identity.source, "local-static");
  assert.equal(snapshot.identity.data?.displayName, "Luigi");
  assert.equal(snapshot.identity.data?.title, "Estrategista do Sul");
  assert.equal(snapshot.identity.data?.presence, "online");
});

test("Tesouraria possui duas moedas semanticamente distintas", async () => {
  const snapshot = await getCurrentProfileCommandSnapshot();
  const wallet = snapshot.wallet.data;

  assert.equal(snapshot.wallet.availability, "available");
  assert.equal(snapshot.wallet.source, "local-static");
  assert.ok(wallet);
  assert.equal(wallet.common.currency, "campaign-credit");
  assert.equal(wallet.premium.currency, "command-reserve");
  assert.notEqual(wallet.common.symbol, wallet.premium.symbol);
  assert.notEqual(wallet.common.label, wallet.premium.label);
  assert.ok(wallet.common.balance >= 0);
  assert.ok(wallet.premium.balance >= 0);
});

test("Rede de Comando carrega somente resumo social e busca fica separada", async () => {
  const snapshot = await getCurrentProfileCommandSnapshot();

  assert.equal(snapshot.social.availability, "available");
  assert.equal(snapshot.social.source, "local-static");
  assert.ok(snapshot.social.data.friends.length > 0);
  assert.ok(snapshot.social.data.incomingRequests.length > 0);
  assert.ok(snapshot.social.data.recentContacts.length > 0);

  assert.deepEqual(await searchProfileCommanders("m"), []);

  const matches = await searchProfileCommanders("mar");
  assert.ok(matches.length > 0);
  assert.ok(matches.every((entry) => /mar/i.test(`${entry.displayName} ${entry.handle}`)));
  assert.ok(matches.length <= 8);
});

test("Livro de Campanha usa janela limitada com continuação explícita", async () => {
  const snapshot = await getCurrentProfileCommandSnapshot();
  const history = snapshot.history.data;

  assert.equal(snapshot.history.availability, "available");
  assert.equal(snapshot.history.source, "local-static");
  assert.equal(history.matches.length, 3);
  assert.equal(history.hasMore, true);
  assert.ok(history.nextCursor);
  assert.ok(history.matches.every((match) => match.participants.length > 0));
});

test("Intendência identifica preço e moeda sem estado de compra", async () => {
  const snapshot = await getCurrentProfileCommandSnapshot();
  const items = snapshot.storefront.data.featuredItems;

  assert.equal(snapshot.storefront.availability, "available");
  assert.equal(snapshot.storefront.source, "local-static");
  assert.ok(items.length > 0);
  assert.ok(
    items.every((item) =>
      ["campaign-credit", "command-reserve"].includes(item.price.currency),
    ),
  );
  assert.ok(items.every((item) => item.price.amount > 0));
  assert.ok(items.every((item) => !("owned" in item) && !("purchased" in item)));
});
