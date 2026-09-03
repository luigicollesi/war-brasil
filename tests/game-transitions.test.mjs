import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLE_COMPARISON_PRESENTATION_MS,
  BATTLE_DICE_PRESENTATION_MS,
  BATTLE_RESULT_PRESENTATION_MS,
  INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS,
  INITIAL_TERRITORY_PRESENTATION_MS,
  INITIAL_TERRITORY_REVEAL_COUNT,
  INITIAL_TERRITORY_REVEAL_DURATION_MS,
  INITIAL_TERRITORY_REVEAL_STEP_MS,
  INITIAL_TERRITORY_SYNC_DELAY_MS,
  ORDER_ROLL_PRESENTATION_MS,
  isInitialTerritoryPresentationDue,
  isOrderRollPresentationDue,
  nextBattlePresentationTransition,
} from "../.test-build/game-transitions.js";

test("rolagem de batalha só avança após a janela visual 3D", () => {
  const startedAt = "2026-08-26T12:00:00.000Z";
  const before = Date.parse(startedAt) + BATTLE_DICE_PRESENTATION_MS - 1;
  const atLimit = Date.parse(startedAt) + BATTLE_DICE_PRESENTATION_MS;

  assert.equal(
    nextBattlePresentationTransition("show_attacker_result", startedAt, before),
    null,
  );
  assert.equal(
    nextBattlePresentationTransition("show_attacker_result", startedAt, atLimit),
    "await_defender_roll",
  );
  assert.equal(
    nextBattlePresentationTransition("show_defender_result", startedAt, atLimit),
    "show_comparison",
  );
});

test("estágios passivos de combate não avançam por tempo", () => {
  const startedAt = "2026-08-26T12:00:00.000Z";
  const muchLater = Date.parse(startedAt) + 60_000;

  assert.equal(
    nextBattlePresentationTransition("awaiting_attacker_roll", startedAt, muchLater),
    null,
  );
  assert.equal(
    nextBattlePresentationTransition("awaiting_defender_roll", startedAt, muchLater),
    null,
  );
});

test("comparação e resultado mantêm janelas próprias", () => {
  const startedAt = "2026-08-26T12:00:00.000Z";
  const startMs = Date.parse(startedAt);

  assert.equal(
    nextBattlePresentationTransition(
      "show_comparison",
      startedAt,
      startMs + BATTLE_COMPARISON_PRESENTATION_MS - 1,
    ),
    null,
  );
  assert.equal(
    nextBattlePresentationTransition(
      "show_comparison",
      startedAt,
      startMs + BATTLE_COMPARISON_PRESENTATION_MS,
    ),
    "resolve_battle",
  );
  assert.equal(
    nextBattlePresentationTransition(
      "show_battle_result",
      startedAt,
      startMs + BATTLE_RESULT_PRESENTATION_MS,
    ),
    "clear_battle",
  );
});

test("apresentação inicial reserva margem de sincronização antes da animação", () => {
  assert.equal(INITIAL_TERRITORY_SYNC_DELAY_MS, 2_000);
  assert.equal(INITIAL_TERRITORY_REVEAL_STEP_MS, 100);
  assert.equal(INITIAL_TERRITORY_REVEAL_COUNT, 42);
  assert.equal(INITIAL_TERRITORY_REVEAL_DURATION_MS, 4_200);
  assert.equal(INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS, 2_000);
  assert.equal(INITIAL_TERRITORY_PRESENTATION_MS, 6_200);
});

test("apresentação inicial só termina após revelação e destaque", () => {
  const startedAt = "2026-08-26T12:00:02.000Z";
  const startMs = Date.parse(startedAt);

  assert.equal(
    isInitialTerritoryPresentationDue(
      startedAt,
      startMs + INITIAL_TERRITORY_PRESENTATION_MS - 1,
    ),
    false,
  );
  assert.equal(
    isInitialTerritoryPresentationDue(
      startedAt,
      startMs + INITIAL_TERRITORY_PRESENTATION_MS,
    ),
    true,
  );
});

test("sorteio só avança quando todos rolaram e dois segundos passaram", () => {
  const lastRollAt = new Date("2026-08-26T12:00:00.000Z");
  const before = lastRollAt.getTime() + ORDER_ROLL_PRESENTATION_MS - 1;
  const atLimit = lastRollAt.getTime() + ORDER_ROLL_PRESENTATION_MS;

  assert.equal(isOrderRollPresentationDue(false, lastRollAt, atLimit), false);
  assert.equal(isOrderRollPresentationDue(true, null, atLimit), false);
  assert.equal(isOrderRollPresentationDue(true, lastRollAt, before), false);
  assert.equal(isOrderRollPresentationDue(true, lastRollAt, atLimit), true);
});
