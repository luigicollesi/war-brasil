import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentProfileCommandSnapshot,
  searchProfileCommanders,
} from "../.test-build/profile/profile-command-data.js";

async function withProfileEnvironment(state, run) {
  const previousMode = process.env.PROFILE_EVAL_MODE;
  const previousState = process.env.PROFILE_EVAL_STATE;

  if (state === null) {
    delete process.env.PROFILE_EVAL_MODE;
    delete process.env.PROFILE_EVAL_STATE;
  } else {
    process.env.PROFILE_EVAL_MODE = "1";
    process.env.PROFILE_EVAL_STATE = state;
  }

  try {
    await run();
  } finally {
    if (previousMode === undefined) delete process.env.PROFILE_EVAL_MODE;
    else process.env.PROFILE_EVAL_MODE = previousMode;

    if (previousState === undefined) delete process.env.PROFILE_EVAL_STATE;
    else process.env.PROFILE_EVAL_STATE = previousState;
  }
}

test("Quartel V2 expõe identidade, título, presença e atividade por contrato", async () => {
  await withProfileEnvironment(null, async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "loaded");
    assert.equal(snapshot.identity.availability, "available");
    assert.equal(snapshot.identity.source, "local-static");
    assert.equal(snapshot.identity.data?.displayName, "Luigi");
    assert.equal(snapshot.identity.data?.title, "Estrategista do Sul");
    assert.equal(snapshot.identity.data?.presence.state, "online");
    assert.equal(snapshot.identity.data?.activity.state, "idle");
    assert.equal(snapshot.isEvaluationFixture, false);
  });
});

test("Tesouraria possui duas moedas semanticamente distintas", async () => {
  await withProfileEnvironment(null, async () => {
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
});

test("Rede de Comando carrega resumo social e busca fica separada", async () => {
  await withProfileEnvironment(null, async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.social.availability, "available");
    assert.equal(snapshot.social.source, "local-static");
    assert.ok(snapshot.social.data.friends.length > 0);
    assert.ok(snapshot.social.data.incomingRequests.length > 0);
    assert.ok(snapshot.social.data.recentContacts.length > 0);
    assert.ok(snapshot.social.data.friends.every((friend) => friend.presence && friend.activity));
  });

  assert.deepEqual(await searchProfileCommanders("m"), []);

  const matches = await searchProfileCommanders("mar");
  assert.ok(matches.length > 0);
  assert.ok(matches.every((entry) => /mar/i.test(`${entry.displayName} ${entry.handle}`)));
  assert.ok(matches.length <= 8);

  assert.deepEqual(await searchProfileCommanders("zzzz-sem-sinal"), []);
});

test("Livro de Campanha usa janela limitada com continuação explícita", async () => {
  await withProfileEnvironment(null, async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();
    const history = snapshot.history.data;

    assert.equal(snapshot.history.availability, "available");
    assert.equal(snapshot.history.source, "local-static");
    assert.equal(history.matches.length, 3);
    assert.equal(history.hasMore, true);
    assert.ok(history.nextCursor);
    assert.ok(history.matches.every((match) => match.participants.length > 0));
  });
});

test("Intendência identifica preço e moeda sem estado de compra", async () => {
  await withProfileEnvironment(null, async () => {
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
});

test("guest remove identidade e torna sistemas pessoais indisponíveis", async () => {
  await withProfileEnvironment("guest", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "guest");
    assert.equal(snapshot.identity.availability, "unavailable");
    assert.equal(snapshot.identity.data, null);
    assert.equal(snapshot.wallet.availability, "unavailable");
    assert.equal(snapshot.social.availability, "unavailable");
    assert.equal(snapshot.history.availability, "unavailable");
    assert.equal(snapshot.storefront.availability, "unavailable");
    assert.equal(snapshot.isEvaluationFixture, true);
  });
});

test("wallet-unavailable não converte ausência em saldo zero", async () => {
  await withProfileEnvironment("wallet-unavailable", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "partial-data");
    assert.equal(snapshot.wallet.availability, "unavailable");
    assert.equal(snapshot.wallet.data, null);
    assert.equal(snapshot.social.availability, "available");
  });
});

test("empty-history representa fonte disponível sem operações", async () => {
  await withProfileEnvironment("empty-history", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "empty-history");
    assert.equal(snapshot.history.availability, "empty");
    assert.deepEqual(snapshot.history.data.matches, []);
    assert.equal(snapshot.history.data.hasMore, false);
    assert.equal(snapshot.history.data.nextCursor, null);
  });
});

test("empty-social preserva busca com roster vazio", async () => {
  await withProfileEnvironment("empty-social", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "empty-social");
    assert.equal(snapshot.social.availability, "empty");
    assert.deepEqual(snapshot.social.data.friends, []);
    assert.equal(snapshot.social.data.totalFriends, 0);
  });
});

test("empty-storefront mantém Intendência disponível e vazia", async () => {
  await withProfileEnvironment("empty-storefront", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "empty-storefront");
    assert.equal(snapshot.storefront.availability, "empty");
    assert.deepEqual(snapshot.storefront.data.featuredItems, []);
  });
});

test("error V2 exercita error boundary por exceção controlada", async () => {
  await withProfileEnvironment("error", async () => {
    await assert.rejects(getCurrentProfileCommandSnapshot(), /PROFILE_COMMAND_EVAL_ERROR/);
  });
});

test("estado de avaliação inválido cai no snapshot local", async () => {
  await withProfileEnvironment("estado-invalido", async () => {
    const snapshot = await getCurrentProfileCommandSnapshot();

    assert.equal(snapshot.state, "loaded");
    assert.equal(snapshot.isEvaluationFixture, false);
    assert.equal(snapshot.identity.source, "local-static");
  });
});
