import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const mutationRoutes = [
  "src/app/api/profile/friends/requests/route.ts",
  "src/app/api/profile/friends/requests/[requestId]/accept/route.ts",
  "src/app/api/profile/friends/requests/[requestId]/reject/route.ts",
  "src/app/api/profile/friends/requests/[requestId]/route.ts",
  "src/app/api/profile/friends/[handle]/route.ts",
  "src/app/api/profile/blocks/route.ts",
  "src/app/api/profile/blocks/[handle]/route.ts",
];

test("Profile social mutations derive actor from authenticated boundary", () => {
  for (const path of mutationRoutes) {
    const source = read(path);
    assert.match(source, /requireProfileMutationActor\(request\)/, path);
    assert.doesNotMatch(source, /payload\s*\.\s*userId/i, path);
    assert.doesNotMatch(source, /searchParams\.get\(["']userId["']\)/i, path);
  }
});

test("Profile social mutation boundary rejects untrusted browser origins", () => {
  const source = read("src/lib/server/profile/social-http.ts");
  assert.match(source, /rejectUntrustedMutationOrigin\(request\)/);

  const originGuard = read("src/lib/server/auth/request-origin.ts");
  assert.match(originGuard, /\["GET", "HEAD", "OPTIONS"\]/);
  assert.match(originGuard, /rejectUntrustedOriginEvidence\(request\)/);
});

test("commander search uses authenticated real DAL and returns only semantic relationship state", () => {
  const source = read("src/app/api/profile/commanders/search/route.ts");
  assert.match(source, /getAuthenticatedSession\(request\)/);
  assert.match(source, /searchCommanderDirectory\(session\.user\.id, query\)/);
  assert.match(source, /relationship:\s*commander\.relationship/);
  assert.doesNotMatch(source, /searchProfileCommanders/);
  assert.doesNotMatch(source, /LOCAL_PROFILE_COMMAND_SNAPSHOT/);
  assert.doesNotMatch(source, /userId:\s*commander/);
  assert.doesNotMatch(source, /email:\s*commander/i);
});

test("Profile public DTO contracts do not expose internal account identifiers", () => {
  const source = read("src/lib/server/profile/profile-domain.ts");
  assert.doesNotMatch(source, /\buserId\b/);
  assert.doesNotMatch(source, /\bemail\b/i);
  assert.match(source, /CommanderPresenceState/);
  assert.match(source, /CommanderActivityState/);
});

test("private social snapshot carries request capabilities without exposing account ids", () => {
  const contract = read("src/lib/profile/profile-command-contract.ts");
  const service = read("src/lib/server/profile/social-read-service.ts");

  assert.match(
    contract,
    /type CommanderFriendRequest = Readonly<\{[\s\S]*requestId: string;[\s\S]*handle: string;/,
  );
  assert.match(
    contract,
    /type CommanderOutgoingFriendRequest = Readonly<\{[\s\S]*requestId: string;[\s\S]*handle: string;/,
  );
  assert.match(contract, /blockedCommanders: ReadonlyArray<CommanderBlockedContact>/);
  assert.match(service, /incomingRequests/);
  assert.match(service, /outgoingRequests/);
  assert.match(service, /blockedCommanders/);
  assert.doesNotMatch(service, /requester_id:\s*row\.requester_id/);
  assert.doesNotMatch(service, /recipient_id:\s*row\.recipient_id/);
  assert.doesNotMatch(service, /blocked_id:\s*row\.blocked_id/);
});

test("Command Network exposes durable management for friends requests and blocks", () => {
  const station = read(
    "src/components/profile/command-quarters/profile-network-station.tsx",
  );
  const styles = read(
    "src/components/profile/command-quarters/profile-command-refinements.module.css",
  );

  assert.match(station, /\/api\/profile\/friends\/requests/);
  assert.match(
    station,
    /`\/api\/profile\/friends\/requests\/\$\{requestId\}\/\$\{action\}`/,
  );
  assert.match(station, /`\/api\/profile\/friends\/requests\/\$\{requestId\}`/);
  assert.match(station, /`\/api\/profile\/friends\/\$\{encodeURIComponent\(handle\)\}`/);
  assert.match(station, /\/api\/profile\/blocks/);
  assert.match(station, /`\/api\/profile\/blocks\/\$\{encodeURIComponent\(handle\)\}`/);
  assert.match(station, /social\.outgoingRequests\.map/);
  assert.match(station, /social\.blockedCommanders\.map/);
  assert.match(station, /Gerenciar Rede de Comando/);
  assert.match(station, /href=\{`\/profile\/\$\{encodeURIComponent\(handle\)\}`\}/);
  assert.match(styles, /\.networkManagerBody[\s\S]*overflow-y: auto/);
  assert.match(station, /router\.refresh\(\)/);
  assert.match(station, /!snapshot\.isEvaluationFixture/);
});

test("social service serializes pair mutations and keeps accept idempotent", () => {
  const source = read("src/lib/server/profile/social-service.ts");
  assert.match(source, /async function lockAccountPair/);
  assert.match(source, /ORDER BY id\s+FOR UPDATE/);
  assert.match(source, /alreadyResolved: true/);
  assert.match(source, /cancelPendingRequestsBetween/);
});

test("social E2E includes simultaneous accept and accept versus block races", () => {
  const flow = read("scripts/e2e/profile-social-flow.mjs");
  assert.match(flow, /concurrentApiJson/);
  assert.match(flow, /simultaneousAccepts/);
  assert.match(flow, /acceptBlockRace/);
  assert.match(flow, /friendshipCount/);
  assert.match(flow, /blockCount/);
  assert.match(flow, /assert\.notEqual\(await requestState[\s\S]*"pending"/);
});
