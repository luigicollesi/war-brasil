import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentProfileSnapshot } from "../.test-build/profile/profile-data.js";

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

test("perfil normal retorna apenas identidade local e dados indisponíveis", async () => {
  await withProfileEnvironment(null, async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "partial-data");
    assert.equal(snapshot.identity?.displayName, "Luigi");
    assert.equal(snapshot.identity?.source, "local-static");
    assert.equal(snapshot.isEvaluationFixture, false);
    assert.equal(snapshot.progression.availability, "unavailable");
    assert.equal(snapshot.statistics.availability, "unavailable");
    assert.equal(snapshot.history.availability, "unavailable");
    assert.equal(snapshot.achievements.availability, "unavailable");
  });
});

test("guest de avaliação remove identidade sem inventar autenticação", async () => {
  await withProfileEnvironment("guest", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "guest");
    assert.equal(snapshot.identity, null);
    assert.equal(snapshot.isEvaluationFixture, true);
  });
});

test("loaded de avaliação exercita todas as seções com histórico em janela limitada", async () => {
  await withProfileEnvironment("loaded", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "loaded");
    assert.equal(snapshot.isEvaluationFixture, true);
    assert.equal(snapshot.progression.availability, "available");
    assert.equal(snapshot.statistics.availability, "available");
    assert.equal(snapshot.history.availability, "available");
    assert.equal(snapshot.achievements.availability, "available");
    assert.equal(snapshot.history.data.campaigns.length, 3);
    assert.equal(snapshot.history.data.hasMore, true);
    assert.ok(snapshot.achievements.data.length > 0);
  });
});

test("empty-history esvazia somente o arquivo de campanhas", async () => {
  await withProfileEnvironment("empty-history", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "empty-history");
    assert.equal(snapshot.progression.availability, "available");
    assert.equal(snapshot.statistics.availability, "available");
    assert.equal(snapshot.history.availability, "empty");
    assert.deepEqual(snapshot.history.data.campaigns, []);
    assert.equal(snapshot.history.data.hasMore, false);
    assert.equal(snapshot.achievements.availability, "available");
  });
});

test("no-progression-system mantém demais fontes disponíveis", async () => {
  await withProfileEnvironment("no-progression-system", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "no-progression-system");
    assert.equal(snapshot.progression.availability, "unavailable");
    assert.equal(snapshot.progression.data, null);
    assert.equal(snapshot.statistics.availability, "available");
    assert.equal(snapshot.history.availability, "available");
    assert.equal(snapshot.achievements.availability, "available");
  });
});

test("partial-data de avaliação continua explicitamente parcial", async () => {
  await withProfileEnvironment("partial-data", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "partial-data");
    assert.equal(snapshot.isEvaluationFixture, true);
    assert.equal(snapshot.progression.availability, "unavailable");
    assert.equal(snapshot.statistics.availability, "unavailable");
    assert.equal(snapshot.history.availability, "unavailable");
    assert.equal(snapshot.achievements.availability, "unavailable");
  });
});

test("error de avaliação exercita o boundary real", async () => {
  await withProfileEnvironment("error", async () => {
    await assert.rejects(getCurrentProfileSnapshot(), /PROFILE_EVAL_ERROR/);
  });
});

test("estado inválido não ativa fixture", async () => {
  await withProfileEnvironment("estado-invalido", async () => {
    const snapshot = await getCurrentProfileSnapshot();

    assert.equal(snapshot.state, "partial-data");
    assert.equal(snapshot.isEvaluationFixture, false);
  });
});
