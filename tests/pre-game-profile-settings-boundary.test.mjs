import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Profile settings derives mutation actor only from authenticated session boundary", () => {
  const route = read("src/app/api/profile/settings/route.ts");
  const service = read("src/lib/server/profile/profile-settings-service.ts");

  assert.match(route, /requireProfileMutationActor\(request\)/);
  assert.match(route, /updateOwnProfileSettings\(actor\.userId, update\)/);
  assert.doesNotMatch(route, /payload\s*\.\s*userId/i);
  assert.doesNotMatch(route, /searchParams\.get\(["']userId["']\)/i);

  assert.match(
    service,
    /allowedKeys\s*=\s*new Set\(\["displayName", "bio", "privacy"\]\)/,
  );
  assert.doesNotMatch(service, /allowedKeys[^;]*userId/is);
  assert.doesNotMatch(service, /allowedKeys[^;]*handle/is);
});

test("Profile settings keeps handle, portrait and title outside the editable payload", () => {
  const service = read("src/lib/server/profile/profile-settings-service.ts");

  assert.match(service, /UNSUPPORTED_PROFILE_FIELD/);
  assert.doesNotMatch(service, /allowedKeys[^;]*portrait/is);
  assert.doesNotMatch(service, /allowedKeys[^;]*title/is);
  assert.match(service, /DISPLAY_NAME_MAX_LENGTH\s*=\s*48/);
  assert.match(service, /BIO_MAX_LENGTH\s*=\s*240/);
});

test("partial privacy updates preserve every omitted persisted policy", () => {
  const service = read("src/lib/server/profile/profile-settings-service.ts");

  assert.match(
    service,
    /INSERT INTO profile\.privacy_settings\(user_id\)[\s\S]*ON CONFLICT \(user_id\) DO NOTHING/,
  );
  assert.match(
    service,
    /presence_visibility=COALESCE\(\$2::varchar\(16\),presence_visibility\)/,
  );
  assert.match(
    service,
    /activity_visibility=COALESCE\(\$3::varchar\(16\),activity_visibility\)/,
  );
  assert.match(
    service,
    /history_visibility=COALESCE\(\$4::varchar\(16\),history_visibility\)/,
  );
  assert.match(
    service,
    /friend_request_policy=COALESCE\(\$5::varchar\(24\),friend_request_policy\)/,
  );
  assert.doesNotMatch(service, /COALESCE\(\$2\s*,\s*['"]friends['"]\)/);
  assert.doesNotMatch(service, /COALESCE\(\$5\s*,\s*['"]everyone['"]\)/);
});

test("Profile settings route rejects malformed JSON and mutation boundary owns origin validation", () => {
  const route = read("src/app/api/profile/settings/route.ts");
  const boundary = read("src/lib/server/profile/social-http.ts");

  assert.match(route, /request\.json\(\)/);
  assert.match(route, /INVALID_JSON/);
  assert.match(boundary, /rejectUntrustedMutationOrigin\(request\)/);
  assert.match(boundary, /getAuthenticatedSession\(request\)/);
});

test("authenticated Profile snapshot projects persisted bio and privacy instead of local defaults", () => {
  const snapshotService = read(
    "src/lib/server/profile/profile-command-snapshot-service.ts",
  );
  const contract = read("src/lib/profile/profile-command-contract.ts");

  assert.match(snapshotService, /bio:\s*profile\.identity\.bio/);
  assert.match(snapshotService, /privacy:[\s\S]*source:\s*"authenticated-user"/);
  assert.match(snapshotService, /data:\s*profile\.privacy/);
  assert.match(contract, /privacy:\s*ProfileCommandSection<ProfilePrivacySettings \| null>/);
});

test("settings panel sends only changed fields and refreshes the server snapshot without navigation", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );
  const page = read("src/app/profile/page.tsx");

  assert.match(panel, /fetch\("\/api\/profile\/settings"/);
  assert.match(panel, /method:\s*"PATCH"/);
  assert.match(panel, /Object\.keys\(privacyUpdate\)\.length > 0/);
  assert.match(panel, /router\.refresh\(\)/);
  assert.doesNotMatch(panel, /router\.push\(/);
  assert.doesNotMatch(panel, /userId/);
  assert.match(page, /!snapshot\.isEvaluationFixture/);
  assert.match(page, /snapshot\.privacy\.availability === "available"/);
});
