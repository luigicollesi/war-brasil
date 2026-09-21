import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Profile production snapshot derives authenticated identity without local fixtures", () => {
  const page = read("src/app/profile/page.tsx");
  const snapshot = read("src/lib/server/profile/profile-command-snapshot-service.ts");

  assert.match(page, /server\/profile\/profile-command-snapshot-service/);
  assert.match(snapshot, /auth\.api\.getSession/);
  assert.match(snapshot, /session\.user\.id/);
  assert.match(snapshot, /getOwnCommanderProfile\(session\.user\.id\)/);
  assert.doesNotMatch(snapshot, /LOCAL_PROFILE_COMMAND_SNAPSHOT|searchLocalCommanders/);
});

test("Profile snapshot bounds live presence and degrades secondary sources instead of suspending indefinitely", () => {
  const snapshot = read("src/lib/server/profile/profile-command-snapshot-service.ts");

  assert.match(snapshot, /PROFILE_SNAPSHOT_PRESENCE_TIMEOUT_MS = 350/);
  assert.match(snapshot, /renewOwnPresence\(session\.user\.id,\s*\{[\s\S]*timeoutMs:/);
  assert.match(snapshot, /Falha ao carregar atividade no Profile/);
  assert.match(snapshot, /Falha ao carregar histórico no Profile/);
  assert.match(snapshot, /Falha ao carregar rede social no Profile/);
  assert.match(snapshot, /Falha ao carregar economia no Profile/);
  assert.match(snapshot, /state: hasPartialData \? "partial-data" : "loaded"/);
});

test("presence and activity remain separate and Redis absence is unavailable", () => {
  const contract = read("src/lib/profile/profile-command-contract.ts");
  const service = read("src/lib/server/profile/profile-service.ts");

  assert.match(contract, /PlayerPresenceState = "online" \| "offline" \| "unavailable"/);
  assert.match(contract, /PlayerActivityState = "idle" \| "lobby" \| "match" \| "unavailable"/);
  assert.match(contract, /presence: CommanderPresence/);
  assert.match(contract, /activity: CommanderActivity/);
  assert.match(service, /presence:\s*\{\s*state: "unavailable"/);
  assert.doesNotMatch(contract, /"in-lobby"|"in-match"/);
});

test("activity is derived only from persistent game seat and room state", () => {
  const activity = read("src/lib/server/profile/activity-service.ts");

  assert.match(activity, /FROM game\.players player/);
  assert.match(activity, /JOIN game\.rooms room ON room\.id=player\.room_id/);
  assert.match(activity, /player\.user_id=\$1::uuid/);
  assert.match(activity, /room\.status IN \('waiting','order_roll','playing'\)/);
  assert.match(activity, /active\.status === "playing"/);
  assert.match(activity, /state: "match"/);
  assert.match(activity, /state: "lobby"/);
  assert.match(activity, /state: "idle"/);
  assert.doesNotMatch(activity, /localStorage|sessionStorage|window\.|document\./);
});

test("match history uses durable per-match snapshots and keyset pagination", () => {
  const repository = read("src/lib/server/profile/history-repository.ts");
  const service = read("src/lib/server/profile/history-service.ts");
  const dice = read("src/lib/server/game-dice-balance-service.ts");
  const migration = read("src/lib/db/migrations/managed/036-match-history-snapshots.sql");

  assert.match(repository, /FROM game\.match_participants self/);
  assert.match(repository, /JOIN game\.matches match ON match\.id=self\.match_id/);
  assert.match(repository, /\(match\.finished_at, match\.id\) < \(\$2::timestamptz, \$3::bigint\)/);
  assert.match(repository, /LIMIT \$4/);
  assert.doesNotMatch(repository, /\bOFFSET\b/i);
  assert.match(service, /nextCursor/);
  assert.match(service, /base64url/);
  assert.match(dice, /match_mode_snapshot/);
  assert.match(dice, /snapshotMatchParticipants/);
  assert.match(dice, /COALESCE\(NULLIF\(btrim\(player\.display_name_snapshot\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS game\.match_participants/);
  assert.match(migration, /ON DELETE SET NULL/);
});
