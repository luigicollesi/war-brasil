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
    /allowedKeys\s*=\s*new Set\(\["displayName", "privacy"\]\)/,
  );
  assert.doesNotMatch(service, /BIO_MAX_LENGTH|cleanBio|INVALID_BIO/);
  assert.doesNotMatch(service, /allowedKeys[^;]*userId/is);
  assert.doesNotMatch(service, /allowedKeys[^;]*handle/is);
});

test("Profile settings keeps biography, handle, portrait and title outside the editable payload", () => {
  const service = read("src/lib/server/profile/profile-settings-service.ts");

  assert.match(service, /UNSUPPORTED_PROFILE_FIELD/);
  assert.doesNotMatch(service, /allowedKeys[^;]*portrait/is);
  assert.doesNotMatch(service, /allowedKeys[^;]*title/is);
  assert.match(service, /validateCommanderDisplayNameDraft/);
  assert.match(service, /assertCommanderDisplayNameAllowed/);
  assert.doesNotMatch(service, /allowedKeys[^;]*bio/is);
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

  assert.match(route, /readBoundedJsonBody\(request\)/);
  assert.match(route, /BoundedJsonBodyError/);
  assert.match(boundary, /rejectUntrustedMutationOrigin\(request\)/);
  assert.match(boundary, /getAuthenticatedSession\(request\)/);
});

test("authenticated Profile snapshot projects privacy without biography", () => {
  const snapshotService = read(
    "src/lib/server/profile/profile-command-snapshot-service.ts",
  );
  const contract = read("src/lib/profile/profile-command-contract.ts");

  assert.doesNotMatch(snapshotService, /bio:\s*profile\.identity\.bio/);
  assert.doesNotMatch(contract, /bio:\s*string \| null/);
  assert.match(snapshotService, /privacy:[\s\S]*source:\s*"authenticated-user"/);
  assert.match(snapshotService, /data:\s*profile\.privacy/);
  assert.match(contract, /privacy:\s*ProfileCommandSection<ProfilePrivacySettings \| null>/);
});

test("settings panel sends only changed fields and refreshes the server snapshot without navigation", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );
  const dossier = read("src/components/profile/v4/profile-dossier.tsx");

  assert.match(panel, /fetch\("\/api\/profile\/settings"/);
  assert.match(panel, /method:\s*"PATCH"/);
  assert.match(panel, /Object\.keys\(privacyUpdate\)\.length > 0/);
  assert.match(panel, /router\.refresh\(\)/);
  assert.doesNotMatch(panel, /router\.push\(/);
  assert.doesNotMatch(panel, /userId/);
  assert.match(dossier, /const privacy = snapshot\.privacy\.data/);
  assert.match(dossier, /privacy && !snapshot\.isEvaluationFixture/);
  assert.match(dossier, /<ProfileSettingsPanel identity=\{identity\} privacy=\{privacy\} \/>/);
});


test("Profile dossier and settings expose no biography surface", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );
  const dossier = read("src/components/profile/v4/profile-dossier.tsx");
  const contract = read("src/lib/profile/profile-command-contract.ts");
  const migration = read(
    "src/lib/db/migrations/managed/068-remove-profile-biography.sql",
  );

  assert.doesNotMatch(panel, /Biografia|<textarea|\bbio\b/i);
  assert.doesNotMatch(dossier, /biografia|\bbio\b/i);
  assert.doesNotMatch(contract, /\bbio\s*:/i);
  assert.match(migration, /DROP COLUMN IF EXISTS bio/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS commanders_bio_not_blank_check/);
});


test("settings panel validates display name before issuing PATCH and server repeats policy", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );
  const service = read("src/lib/server/profile/profile-settings-service.ts");

  assert.match(panel, /validateCommanderDisplayNameDraft\(displayName\)/);
  assert.match(panel, /if \(!displayNameValidation\.ok\)/);
  assert.match(service, /validateCommanderDisplayNameDraft\(value\)/);
  assert.match(service, /assertCommanderDisplayNameAllowed\(safeDisplayName\)/);
  assert.match(service, /INVALID_DISPLAY_NAME/);
});
