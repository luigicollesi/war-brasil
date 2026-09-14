import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const policy = readFileSync("src/lib/profile/profile-portrait-policy.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const profileService = readFileSync(
  "src/lib/server/profile/profile-service.ts",
  "utf8",
);
const socialReadService = readFileSync(
  "src/lib/server/profile/social-read-service.ts",
  "utf8",
);

test("portrait policy permite somente HTTPS de hosts OAuth aprovados ou paths locais", () => {
  assert.match(policy, /lh3\.googleusercontent\.com/);
  assert.match(policy, /cdn\.discordapp\.com/);
  assert.match(policy, /url\.protocol !== "https:"/);
  assert.match(policy, /url\.username \|\|/);
  assert.match(policy, /url\.password \|\|/);
  assert.match(policy, /url\.port \|\|/);
  assert.match(policy, /REMOTE_HOSTS\.has/);
  assert.match(policy, /startsWith\("\/"\)/);
  assert.doesNotMatch(policy, /http:"/);
});

test("next/image reutiliza exatamente a allowlist do domínio", () => {
  assert.match(nextConfig, /PROFILE_REMOTE_PORTRAIT_HOSTS/);
  assert.match(nextConfig, /remotePatterns/);
  assert.match(nextConfig, /protocol: "https"/);
  assert.match(nextConfig, /pathname: "\/\*\*"/);
});

test("perfil próprio, público, busca e roster aplicam a mesma sanitização", () => {
  assert.match(profileService, /safeProfilePortraitSrc/);
  assert.match(socialReadService, /safeProfilePortraitSrc/);
  assert.doesNotMatch(profileService, /url\.protocol === "http:"/);
  assert.doesNotMatch(socialReadService, /url\.protocol === "http:"/);
});
