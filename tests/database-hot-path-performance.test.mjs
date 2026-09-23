import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const startGame = readFileSync("src/lib/server/start-game-service.ts", "utf8");
const objectiveAssignment = readFileSync(
  "src/lib/server/objectives/objective-assignment-service.ts",
  "utf8",
);
const snapshot = readFileSync(
  "src/lib/server/game-snapshot-service.ts",
  "utf8",
);
const command = readFileSync(
  "src/lib/server/game-command-service.ts",
  "utf8",
);
const schema = readFileSync("src/lib/db/schema.sql", "utf8");
const migration = readFileSync(
  "src/lib/db/migrations/managed/062-game-hot-path-indexes.sql",
  "utf8",
);

test("waiting-room heartbeat avoids the room mutex and transaction round trips", () => {
  const start = rooms.indexOf("export async function heartbeatWaitingRoom");
  const end = rooms.indexOf("async function deleteRoomIfNoHumans", start);
  const heartbeat = rooms.slice(start, end);

  assert.match(heartbeat, /WITH target_room AS/);
  assert.match(heartbeat, /UPDATE game\.players player/);
  assert.match(heartbeat, /FROM target_room room/);
  assert.match(heartbeat, /room\.status='waiting'/);
  assert.match(heartbeat, /LEFT JOIN refreshed ON TRUE/);
  assert.match(heartbeat, /pool\.query/);
  assert.doesNotMatch(
    heartbeat,
    /withTransaction|findRoomForUpdate|FOR UPDATE|BEGIN|COMMIT|ROLLBACK/,
  );
});

test("game start inserts the complete deck with one batched INSERT", () => {
  const start = startGame.indexOf("async function createDeck");
  const end = startGame.indexOf("async function transitionRoomToOrderRoll", start);
  const createDeck = startGame.slice(start, end);

  assert.match(createDeck, /const cardValues: string\[\] = \[\]/);
  assert.match(createDeck, /const parameters: Array<string \| number> = \[\]/);
  assert.equal((createDeck.match(/INSERT INTO game\.cards/g) ?? []).length, 1);
  assert.match(createDeck, /VALUES \$\{cardValues\.join\(","\)\}/);
  assert.match(
    createDeck,
    /\(\$\$\{offset \+ 1\},\$\$\{offset \+ 2\},\$\$\{offset \+ 3\},FALSE,\$\$\{offset \+ 4\}\)/,
  );
  assert.match(
    createDeck,
    /\(\$\$\{offset \+ 1\},NULL,NULL,TRUE,\$\$\{offset \+ 2\}\)/,
  );
});

test("balanced objective assignment batches persistence after resolving every player", () => {
  const start = objectiveAssignment.indexOf("async function assignBalancedObjectives");
  const end = objectiveAssignment.indexOf("async function assignLegacyObjectives", start);
  const assignment = objectiveAssignment.slice(start, end);

  assert.match(assignment, /const objectiveValues: string\[\] = \[\]/);
  assert.equal(
    (assignment.match(/INSERT INTO game\.player_objectives/g) ?? []).length,
    1,
  );
  assert.match(
    assignment,
    /\(\$\$\{offset \+ 1\},\$\$\{offset \+ 2\},\$\$\{offset \+ 3\},\$\$\{offset \+ 4\},\$\$\{offset \+ 5\},\$\$\{offset \+ 6\}::jsonb\)/,
  );
  assert.match(assignment, /JSON\.stringify\(resolvedParams\)/);
});

test("unchanged snapshot checks revision before opening the repeatable-read boundary", () => {
  const helper = snapshot.indexOf("async function readSnapshotRevisionFastPath");
  const entry = snapshot.indexOf("export async function getGameSnapshotQuery");
  const transaction = snapshot.indexOf("return gameQuery", entry);

  assert.ok(helper >= 0);
  assert.ok(entry > helper);
  assert.ok(transaction > entry);
  const beforeTransaction = snapshot.slice(entry, transaction);

  assert.match(beforeTransaction, /readSnapshotRevisionFastPath/);
  assert.match(beforeTransaction, /revision === knownRevision/);
  assert.match(beforeTransaction, /snapshot: null/);
  assert.match(snapshot.slice(helper, entry), /pool\.query/);
  assert.match(snapshot.slice(helper, entry), /access_player\.user_id=\$3/);
  assert.match(snapshot.slice(helper, entry), /access_player\.left_at IS NULL/);
});

test("discard reshuffle persists the new order with one set-based update", () => {
  const start = command.indexOf("async function drawCard");
  const end = command.indexOf("async function evaluateRoundTroopWinners", start);
  const drawCard = command.slice(start, end);

  assert.match(drawCard, /FROM unnest\(\$2::bigint\[\],\$3::int\[\]\)/);
  assert.match(drawCard, /card\.id=ordering\.id/);
  assert.equal(
    (drawCard.match(/SET zone='deck',deck_order=/g) ?? []).length,
    1,
  );
});

test("canonical schema and managed migration expose card hot-path indexes", () => {
  for (const source of [schema, migration]) {
    assert.match(
      source,
      /cards_room_zone_idx[\s\S]*game\.cards\(room_id, zone, deck_order\)/,
    );
    assert.match(
      source,
      /cards_hand_idx[\s\S]*game\.cards\(room_id, owner_player_id\)[\s\S]*WHERE zone='hand'/,
    );
  }
});
