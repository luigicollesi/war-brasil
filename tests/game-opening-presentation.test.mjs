import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("abertura usa título transparente sincronizado pelo startedAt do backend", () => {
  const client = readFileSync("src/components/game-client-v2.tsx", "utf8");
  const presentation = readFileSync(
    "src/components/initial-territory-draw-presentation.tsx",
    "utf8",
  );
  const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");

  assert.match(client, /presentationStartedAt=\{initialPresentationStartedAt\}/);
  assert.match(presentation, /Sorteio de Territórios/);
  assert.match(presentation, /tick < startedAtMs/);
  assert.match(presentation, /border-transparent bg-transparent/);
  assert.match(presentation, /pointer-events-none absolute inset-0/);
  assert.match(rooms, /INITIAL_TERRITORY_SYNC_DELAY_MS/);
  assert.match(
    rooms,
    /NOW\(\) \+ \(\$2::int \* INTERVAL '1 millisecond'\)/,
  );
});

test("revelação continua local mas segue a ordem round-robin persistida pelo backend", () => {
  const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
  const snapshot = readFileSync(
    "src/lib/server/game-snapshot-service.ts",
    "utf8",
  );
  const client = readFileSync("src/components/game-client-v2.tsx", "utf8");

  assert.match(rooms, /players\[index % players\.length\]\.id/);
  assert.match(rooms, /initial_draw_order/);
  assert.match(snapshot, /initial_draw_order/);
  assert.match(snapshot, /territoryDrawOrder/);
  assert.match(client, /INITIAL_TERRITORY_REVEAL_STEP_MS/);
  assert.match(client, /territoryIds\.slice/);
});

test("cinematic de ordem usa o mesmo contrato temporal do backend", () => {
  const cinematic = readFileSync(
    "src/components/dice-3d/order-dice-cinematic.tsx",
    "utf8",
  );
  const command = readFileSync(
    "src/lib/server/game-command-service.ts",
    "utf8",
  );

  assert.match(cinematic, /ORDER_ROLL_DICE_ANIMATION_MS/);
  assert.match(cinematic, /ORDER_ROLL_RESULT_HOLD_MS/);
  assert.match(command, /SELECT player_id,roll_round,value,rolled_at/);
  assert.match(command, /isOrderRollActorAvailable\(lastRollAt\)/);
  assert.match(
    command,
    /Aguarde a animação do dado anterior terminar antes de rolar/,
  );
});

test("bot só inicia reação depois da janela visual do roll anterior", () => {
  const scheduler = readFileSync(
    "src/lib/server/automation/game-automation-schedule.ts",
    "utf8",
  );
  const runner = readFileSync("src/lib/server/bots/bot-runner.ts", "utf8");

  for (const source of [scheduler, runner]) {
    assert.match(source, /orderRollActorAvailableAt/);
    assert.match(source, /pickBotDelayMs/);
  }

  assert.match(scheduler, /actionBaseTimeMs \+ pickBotDelayMs\(actionType\)/);
  assert.match(runner, /actionBaseTimeMs \+ pickBotDelayMs\(delayAction\)/);
});
