import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("abertura usa timeline persistida do backend e renderer único do tabuleiro", () => {
  const client = readFileSync("src/components/game-client-v2.tsx", "utf8");
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const presentation = readFileSync(
    "src/lib/client/map/board-presentation.ts",
    "utf8",
  );
  const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");

  assert.match(client, /deriveInitialTerritoryBoardPresentation/);
  assert.match(client, /nextInitialTerritoryPresentationWakeAt/);
  assert.match(client, /presentation=\{boardPresentation\}/);
  assert.doesNotMatch(client, /InitialTerritoryDrawPresentation/);
  assert.doesNotMatch(client, /setInterval\(/);
  assert.match(client, /window\.setTimeout/);
  assert.match(
    client,
    /setPresentationClockMs\(nowMs\);\s*}\s*const wakeAt = nextInitialTerritoryPresentationWakeAt/,
  );
  assert.match(board, /Sorteio de Territórios/);
  assert.match(board, /data-initial-territory-title/);
  assert.match(presentation, /titleVisible/);
  assert.match(rooms, /INITIAL_TERRITORY_SYNC_DELAY_MS/);
  assert.match(
    rooms,
    /NOW\(\) \+ \(\$2::int \* INTERVAL '1 millisecond'\)/,
  );
});

test("apresentação inicial preserva o material 2.5d completo", () => {
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const material = readFileSync(
    "src/lib/client/map/territory-material.ts",
    "utf8",
  );
  const visualState = readFileSync(
    "src/lib/client/map/territory-visual-state.ts",
    "utf8",
  );

  assert.match(board, /neutralTerritoryMaterial/);
  assert.match(board, /applyTerritoryMaterial/);
  assert.match(board, /openingHighlight/);
  assert.match(board, /effectivePresentation/);
  assert.match(material, /NEUTRAL_TERRITORY_MATERIAL/);
  assert.match(visualState, /is-opening-highlight/);
});

test("revelação segue a ordem round-robin persistida pelo backend", () => {
  const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
  const snapshot = readFileSync(
    "src/lib/server/game-snapshot-service.ts",
    "utf8",
  );
  const presentation = readFileSync(
    "src/lib/client/map/board-presentation.ts",
    "utf8",
  );

  assert.match(rooms, /players\[index % players\.length\]\.id/);
  assert.match(rooms, /initial_draw_order/);
  assert.match(snapshot, /initial_draw_order/);
  assert.match(snapshot, /territoryDrawOrder/);
  assert.match(presentation, /territoryIds\.slice\(0, revealedCount\)/);
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