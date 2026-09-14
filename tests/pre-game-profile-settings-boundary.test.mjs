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
