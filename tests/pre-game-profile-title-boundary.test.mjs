import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("title API derives the actor from session and never accepts browser userId", () => {
  const route = read("src/app/api/profile/titles/route.ts");
  const service = read("src/lib/server/profile/profile-title-service.ts");

  assert.match(route, /getAuthenticatedSessionForRead\(request\)/);
  assert.match(route, /listOwnedCommanderTitles\(session\.user\.id\)/);
  assert.match(route, /requireProfileMutationActor\(request\)/);
  assert.match(route, /equipOwnedCommanderTitle\(actor\.userId, titleId\)/);
  assert.doesNotMatch(route, /payload\.userId/);
  assert.doesNotMatch(service, /input\.userId/);
});

test("title selection accepts only titleId and supports explicit unequip", () => {
  const service = read("src/lib/server/profile/profile-title-service.ts");

  assert.match(service, /keys\.length !== 1 \|\| keys\[0\] !== "titleId"/);
  assert.match(service, /if \(input\.titleId === null\) return null/);
  assert.match(service, /TITLE_ID_MAX_LENGTH = 128/);
});

test("equip checks active ownership before updating the authenticated commander", () => {
  const service = read("src/lib/server/profile/profile-title-service.ts");
  const migration = read(
    "src/lib/db/migrations/managed/034-profile-v3-foundation.sql",
  );

  assert.match(
    service,
    /FROM profile\.commander_titles owned[\s\S]*JOIN catalog\.commander_titles title[\s\S]*owned\.user_id=\$1::uuid[\s\S]*owned\.title_id=\$2[\s\S]*title\.is_active=TRUE/,
  );
  assert.match(
    service,
    /UPDATE profile\.commanders[\s\S]*SET equipped_title_id=\$2[\s\S]*WHERE user_id=\$1::uuid/,
  );
  assert.match(migration, /commanders_equipped_title_owned_fkey/);
  assert.match(
    migration,
    /FOREIGN KEY \(user_id, equipped_title_id\)[\s\S]*REFERENCES profile\.commander_titles\(user_id, title_id\)/,
  );
});

test("settings UI loads owned appearance on demand and mutates title through the unified appearance API", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );

  assert.match(panel, /fetch\("\/api\/profile\/appearance"/);
  assert.match(panel, /void loadAppearance\(\)/);
  assert.match(panel, /method: "PATCH"/);
  assert.match(panel, /payload\.titleId = selectedTitleId/);
  assert.match(panel, /appearanceView === "titles"/);
  assert.match(panel, /ProfileTitleRenderer/);
  assert.doesNotMatch(panel, /\/api\/profile\/titles/);
  assert.doesNotMatch(panel, /const .*TITLES.*=\s*\[/i);
});
