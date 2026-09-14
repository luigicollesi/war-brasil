import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("public commander route uses a dedicated server projection", () => {
  const page = read("src/app/profile/[handle]/page.tsx");
  const snapshot = read("src/lib/server/profile/public-profile-snapshot-service.ts");

  assert.match(page, /getPublicCommanderProfileSnapshot/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /relationship === "self"/);
  assert.match(page, /redirect\("\/profile"\)/);
  assert.doesNotMatch(page, /ProfileCommandSnapshot|profile-command-data/);

  assert.match(snapshot, /auth\.api\.getSession/);
  assert.match(snapshot, /session\.user\.id/);
  assert.match(snapshot, /getPublicCommanderProfile\(session\.user\.id, handle\)/);
  assert.doesNotMatch(snapshot, /LOCAL_PROFILE_COMMAND_SNAPSHOT|email|player_session/i);
});

test("public privacy is applied before DTO construction", () => {
  const service = read("src/lib/server/profile/profile-service.ts");

  assert.match(service, /visibilityAllows/);
  assert.match(service, /row\.presence_visibility/);
  assert.match(service, /row\.activity_visibility/);
  assert.match(service, /row\.history_visibility/);
  assert.match(service, /relationship === "blocked"\) return null/);
  assert.match(service, /presenceVisible/);
  assert.match(service, /activityVisible/);
  assert.match(service, /historyVisible/);
  assert.match(service, /state: "unavailable", lastSeenAt: null/);
  assert.match(service, /state: "unavailable", matchMode: null/);
});

test("public history cannot expose the commander's friendship graph", () => {
  const contract = read("src/lib/profile/profile-command-contract.ts");
  const service = read("src/lib/server/profile/profile-service.ts");

  const publicParticipantStart = contract.indexOf("export type PublicMatchParticipantSummary");
  const publicMatchStart = contract.indexOf("export type PublicMatchSummary", publicParticipantStart);
  assert.ok(publicParticipantStart >= 0);
  assert.ok(publicMatchStart > publicParticipantStart);
  const publicParticipantContract = contract.slice(publicParticipantStart, publicMatchStart);
  assert.doesNotMatch(publicParticipantContract, /isFriend|userId|email|session|provider/i);
  assert.match(service, /publicHistoryFromOwnerHistory/);
  assert.doesNotMatch(
    service.slice(
      service.indexOf("function publicHistoryFromOwnerHistory"),
      service.indexOf("export async function getOwnCommanderProfile"),
    ),
    /isFriend:/,
  );
});

test("dynamic public profiles remain inside the shared profile Foundation scene", () => {
  const routeIntent = read("src/components/pre-game/foundation/pre-game-route-intent.ts");
  const publicView = read("src/components/profile/public-commander-profile.tsx");

  assert.match(routeIntent, /startsWith\("\/profile\/"\).*return "profile"/s);
  assert.match(publicView, /useCommandSceneDirective/);
  assert.doesNotMatch(publicView, /@react-three\/fiber|from "three"|<Canvas|cameraPosition|\bfov\b/i);
});
