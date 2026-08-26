import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLE_PRESENTATION_MS,
  ORDER_ROLL_PRESENTATION_MS,
  isOrderRollPresentationDue,
  nextBattlePresentationTransition,
} from "../.test-build/game-transitions.js";

test("batalha só avança após a janela visual", () => {
  const startedAt = "2026-08-26T12:00:00.000Z";
  const before = Date.parse(startedAt) + BATTLE_PRESENTATION_MS - 1;
  const atLimit = Date.parse(startedAt) + BATTLE_PRESENTATION_MS;

  assert.equal(
    nextBattlePresentationTransition("show_attacker_result", startedAt, before),
    null,
  );
  assert.equal(
    nextBattlePresentationTransition("show_attacker_result", startedAt, atLimit),
    "await_defender_roll",
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

test("pipeline visual de combate produz transições determinísticas", () => {
  const startedAt = "2026-08-26T12:00:00.000Z";
  const now = Date.parse(startedAt) + BATTLE_PRESENTATION_MS;

  assert.equal(
    nextBattlePresentationTransition("show_defender_result", startedAt, now),
    "show_comparison",
  );
  assert.equal(
    nextBattlePresentationTransition("show_comparison", startedAt, now),
    "resolve_battle",
  );
  assert.equal(
    nextBattlePresentationTransition("show_battle_result", startedAt, now),
    "clear_battle",
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
