import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const contract = readFileSync("src/lib/profile/profile-command-contract.ts", "utf8");
const domain = readFileSync("src/lib/server/profile/profile-domain.ts", "utf8");
const repository = readFileSync("src/lib/server/profile/profile-repository.ts", "utf8");
const profileService = readFileSync("src/lib/server/profile/profile-service.ts", "utf8");
const socialRepository = readFileSync(
  "src/lib/server/profile/social-read-repository.ts",
  "utf8",
);
const socialService = readFileSync(
  "src/lib/server/profile/social-read-service.ts",
  "utf8",
);
const searchRoute = readFileSync(
  "src/app/api/profile/commanders/search/route.ts",
  "utf8",
);
const ownProfile = readFileSync(
  "src/components/profile/command-quarters/profile-command-hub.tsx",
  "utf8",
);
const ownProfileCss = readFileSync(
  "src/components/profile/command-quarters/profile-command-hub.module.css",
  "utf8",
);
const publicProfile = readFileSync(
  "src/components/profile/public-commander-profile.tsx",
  "utf8",
);
const publicProfileCss = readFileSync(
  "src/components/profile/public-commander-profile.module.css",
  "utf8",
);
const nextConfig = readFileSync("next.config.ts", "utf8");

test("PROFILE não possui contrato ou DTO de imagem de perfil", () => {
  for (const [label, source] of [
    ["contract", contract],
    ["domain", domain],
    ["profile service", profileService],
    ["social service", socialService],
    ["search route", searchRoute],
  ]) {
    assert.doesNotMatch(
      source,
      /CommanderPortrait|portrait\s*:|portrait_ref|portrait_source|auth_image/i,
      label,
    );
  }
});

test("repositories PROFILE não leem imagem OAuth nem colunas de retrato", () => {
  assert.doesNotMatch(
    repository,
    /auth\."user"|auth_user\.image|portrait_ref|portrait_source/i,
  );
  assert.doesNotMatch(
    socialRepository,
    /auth\."user"|auth_user\.image|portrait_ref|portrait_source/i,
  );
});

test("UI PROFILE usa identidade textual e nunca imagem de comandante", () => {
  assert.doesNotMatch(
    ownProfile,
    /next\/image|identity\.portrait|<Image\b|\bPortrait\b/,
  );
  assert.doesNotMatch(
    publicProfile,
    /next\/image|identity\.portrait|<Image\b|\bPortrait\b/,
  );
  assert.match(ownProfile, /IdentityMark/);
  assert.match(publicProfile, /SIGILO/);
});

test("layout PROFILE não reserva slot visual legado para retrato", () => {
  assert.doesNotMatch(ownProfileCss, /\.portrait\b/i);
  assert.doesNotMatch(publicProfileCss, /\.portrait\b/i);
  assert.doesNotMatch(publicProfileCss, /portrait\s+img/i);
});

test("configuração exclusiva de imagem remota de perfil foi removida", () => {
  assert.doesNotMatch(nextConfig, /PROFILE_REMOTE_PORTRAIT_HOSTS|remotePatterns/);
  assert.equal(existsSync("src/lib/profile/profile-portrait-policy.ts"), false);
});
