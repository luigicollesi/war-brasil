import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("public commander route uses a dedicated server projection and supports self display", () => {
  const page = read("src/app/profile/[handle]/page.tsx");
  const snapshot = read("src/lib/server/profile/public-profile-snapshot-service.ts");

  assert.match(page, /getPublicCommanderProfileSnapshot/);
  assert.match(page, /notFound\(\)/);
  assert.doesNotMatch(page, /redirect\("\/profile"\)/);
  assert.match(page, /snapshot\.relationship === "incoming-request"/);
  assert.match(page, /incomingRequests\.find/);
  assert.doesNotMatch(page, /ProfileCommandSnapshot|profile-command-data/);

  assert.match(snapshot, /auth\.api\.getSession/);
  assert.match(snapshot, /session\.user\.id/);
  assert.match(snapshot, /getPublicCommanderProfile\(session\.user\.id, handle\)/);
  assert.match(snapshot, /getPublicProfileAppearance/);
  assert.match(snapshot, /listEquippedProfileCosmetics/);
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

test("public commander display actions are relationship-driven and use public handle only", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");

  assert.match(publicView, /snapshot\.relationship === "none"/);
  assert.match(publicView, /snapshot\.relationship === "friend"/);
  assert.match(publicView, /snapshot\.relationship === "incoming-request"/);
  assert.match(publicView, /snapshot\.relationship === "outgoing-request"/);
  assert.match(publicView, /"\/api\/profile\/friends\/requests"/);
  assert.match(
    publicView,
    /\/api\/profile\/commanders\/\$\{encodeURIComponent\(identity\.handle\)\}\/game-invitations/,
  );
  assert.match(publicView, /JSON\.stringify\(\{ handle: identity\.handle \}\)/);
  assert.match(publicView, /router\.refresh\(\)/);
  assert.match(publicView, /router\.push\(\`\/lobby\//);
  assert.doesNotMatch(publicView, /userId/);
  assert.doesNotMatch(publicView, /session\.user/);
});

test("pending relationships are actionable without exposing request ids in public DTO", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");
  const contract = read("src/lib/profile/profile-command-contract.ts");
  const page = read("src/app/profile/[handle]/page.tsx");

  assert.match(publicView, /SOLICITAÇÃO ENVIADA/);
  assert.match(publicView, /ACEITAR AMIZADE/);
  assert.match(page, /incomingRequestId/);

  const publicProfileStart = contract.indexOf("export type PublicCommanderProfileSnapshot");
  const stationStart = contract.indexOf("export type ProfileCommandStation", publicProfileStart);
  const publicProfileContract = contract.slice(publicProfileStart, stationStart);
  assert.doesNotMatch(publicProfileContract, /requestId|userId|email|session|provider/i);
});

test("cinematic public display intentionally prioritizes appearance and arsenal over history cards", () => {
  const publicView = read("src/components/profile/public-commander-profile.tsx");
  const snapshot = read("src/lib/server/profile/public-profile-snapshot-service.ts");

  assert.match(publicView, /snapshot\.appearance\.background\.assetRef/);
  assert.match(publicView, /ProfileTitleRenderer/);
  assert.match(publicView, /ProfileDisplayStage/);
  assert.doesNotMatch(publicView, /Carregar mais registros|loadMoreHistory|history\.matches/);
  assert.match(snapshot, /history:/);
});

test("dynamic public profiles own a standalone viewport outside the shared Foundation scene", () => {
  const routeIntent = read("src/components/pre-game/foundation/pre-game-route-intent.ts");
  const runtime = read("src/components/pre-game/foundation/pre-game-command-runtime.tsx");
  const publicView = read("src/components/profile/public-commander-profile.tsx");
  const stage = read("src/components/profile/profile-display-stage.tsx");

  assert.match(routeIntent, /isStandalonePublicProfileRoute/);
  assert.match(runtime, /standalonePublicProfile/);
  assert.match(runtime, /profileOwnsSurface/);
  assert.doesNotMatch(publicView, /useCommandSceneDirective/);
  assert.match(stage, /@react-three\/fiber/);
  assert.match(stage, /<Canvas/);
});
