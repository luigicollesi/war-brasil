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

test("public commander social controls use relationship and public handle only", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");

  assert.match(publicView, /snapshot\.relationship === "none"/);
  assert.match(publicView, /snapshot\.relationship === "friend"/);
  assert.match(publicView, /const canBlock = snapshot\.relationship !== "self"/);
  assert.match(publicView, /"\/api\/profile\/friends\/requests"/);
  assert.match(
    publicView,
    /`\/api\/profile\/friends\/\$\{encodeURIComponent\(identity\.handle\)\}`/,
  );
  assert.match(publicView, /"\/api\/profile\/blocks"/);
  assert.match(publicView, /JSON\.stringify\(\{ handle: identity\.handle \}\)/);
  assert.match(publicView, /router\.refresh\(\)/);
  assert.match(publicView, /router\.push\("\/profile"\)/);
  assert.doesNotMatch(publicView, /userId/);
  assert.doesNotMatch(publicView, /session\.user/);
});

test("pending public relationships remain informative without inventing request capabilities", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");
  const contract = read("src/lib/profile/profile-command-contract.ts");

  assert.match(publicView, /"outgoing-request": "Solicitação enviada"/);
  assert.match(publicView, /"incoming-request": "Solicitação recebida"/);

  const publicProfileStart = contract.indexOf("export type PublicCommanderProfileSnapshot");
  const stationStart = contract.indexOf("export type ProfileCommandStation", publicProfileStart);
  const publicProfileContract = contract.slice(publicProfileStart, stationStart);
  assert.doesNotMatch(publicProfileContract, /requestId|userId|email|session|provider/i);
});

test("public profile displays public bio and paginates history through reauthorized boundary", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");
  const route = read("src/app/api/profile/commanders/[handle]/history/route.ts");
  const service = read("src/lib/server/profile/profile-service.ts");

  assert.match(publicView, /identity\.bio/);
  assert.match(publicView, /Carregar mais registros/);
  assert.match(
    publicView,
    /\/api\/profile\/commanders\/\$\{encodeURIComponent\(identity\.handle\)\}\/history\?cursor=/,
  );
  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(route, /decodeMatchHistoryCursor/);
  assert.match(route, /getPublicCommanderHistory/);
  assert.match(route, /private, no-store/);
  assert.match(route, /HISTORY_RESTRICTED/);
  assert.match(service, /export async function getPublicCommanderHistory/);
  assert.match(service, /visibilityAllows\(row\.history_visibility, relationship\)/);
  assert.match(service, /relationship === "blocked"\) return null/);
});

test("dynamic public profiles remain inside the shared profile Foundation scene", () => {
  const routeIntent = read("src/components/pre-game/foundation/pre-game-route-intent.ts");
  const publicView = read("src/components/profile/public-commander-profile.tsx");

  assert.match(routeIntent, /startsWith\("\/profile\/"\).*return "profile"/s);
  assert.match(publicView, /useCommandSceneDirective/);
  assert.doesNotMatch(publicView, /@react-three\/fiber|from "three"|<Canvas|cameraPosition|\bfov\b/i);
});
