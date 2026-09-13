import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const auth = readFileSync("src/lib/server/auth/auth.ts", "utf8");
const environment = readFileSync("src/lib/server/auth/environment.ts", "utf8");
const authPool = readFileSync("src/lib/server/auth/auth-pool.ts", "utf8");
const authGuard = readFileSync("src/lib/server/auth/auth-guard.ts", "utf8");
const commandAccess = readFileSync(
  "src/lib/server/auth/command-access.ts",
  "utf8",
);
const commandAccessRoute = readFileSync(
  "src/app/api/auth/command-access/route.ts",
  "utf8",
);
const authClient = readFileSync("src/lib/client/auth-client.ts", "utf8");
const authRoute = readFileSync("src/app/api/auth/[...all]/route.ts", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const email = readFileSync("src/lib/server/auth/email.ts", "utf8");
const appleSecret = readFileSync("src/lib/server/auth/apple-client-secret.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const onboarding = readFileSync(
  "src/components/auth/command-onboarding-modal.tsx",
  "utf8",
);

const authSources = [
  auth,
  environment,
  authPool,
  authGuard,
  commandAccess,
  commandAccessRoute,
  authClient,
  authRoute,
  proxy,
  email,
  appleSecret,
].join("\n");

test("auth fixa Better Auth e dependências criptográficas em versões exatas", () => {
  assert.equal(pkg.dependencies["better-auth"], "1.7.4");
  assert.equal(pkg.dependencies.jose, "6.2.12");
  assert.equal(pkg.dependencies["server-only"], "0.0.1");
});

test("auth de servidor permanece server-only e usa schema PostgreSQL dedicado", () => {
  assert.match(auth, /^import "server-only";/m);
  assert.match(environment, /^import "server-only";/m);
  assert.match(authPool, /^import "server-only";/m);
  assert.match(authGuard, /^import "server-only";/m);
  assert.match(commandAccess, /^import "server-only";/m);
  assert.match(authPool, /options: "-c search_path=auth"/);
  assert.match(auth, /database: authPool/);
  assert.match(auth, /generateId: "uuid"/);
  assert.match(auth, /joins: true/);
});

test("launch auth possui somente Google, Apple, Discord e credentials", () => {
  assert.match(auth, /google:/);
  assert.match(auth, /apple:/);
  assert.match(auth, /discord:/);
  assert.match(auth, /emailAndPassword:/);
  assert.doesNotMatch(auth, /github|microsoft|twitch|steam|epic|passkey/i);
});

test("credentials exige email verificado e nunca auto-autentica cadastro/verificação", () => {
  assert.match(auth, /requireEmailVerification: true/);
  assert.match(auth, /emailAndPassword:[\s\S]*autoSignIn: false/);
  assert.match(auth, /sendOnSignUp: true/);
  assert.match(auth, /sendOnSignIn: false/);
  assert.match(auth, /autoSignInAfterVerification: false/);
  assert.match(auth, /AUTH_TOKEN_TTL_SECONDS = 60 \* 60/);
  assert.match(auth, /resetPasswordTokenExpiresIn: AUTH_TOKEN_TTL_SECONDS/);
  assert.match(auth, /revokeSessionsOnPasswordReset: true/);
});

test("linking é explícito e não confia em coincidência de email", () => {
  assert.match(auth, /disableImplicitLinking: true/);
  assert.match(auth, /allowDifferentEmails: true/);
  assert.match(auth, /trustedProviders: \[\]/);
  assert.match(auth, /updateUserInfoOnLink: false/);
  assert.match(auth, /allowUnlinkingAll: false/);
});

test("Discord e Apple possuem fallback estável e não-entregável quando email falta", () => {
  assert.match(auth, /\$\{profile\.id\}@discord\.placeholder\.invalid/);
  assert.match(auth, /\$\{profile\.sub\}@apple\.placeholder\.invalid/);
  assert.match(auth, /scope: \["identify", "email"\]/);
});

test("Apple client secret é assinado no servidor e não armazenado como JWT estático", () => {
  assert.match(appleSecret, /importPKCS8/);
  assert.match(appleSecret, /SignJWT/);
  assert.match(appleSecret, /"ES256"/);
  assert.match(appleSecret, /https:\/\/appleid\.apple\.com/);
  assert.match(appleSecret, /180 \* 24 \* 60 \* 60/);
});

test("cookies/sessão têm cache curto, mas backend sensível força validação no banco", () => {
  assert.match(auth, /SESSION_MAX_AGE_SECONDS = 30 \* 24 \* 60 \* 60/);
  assert.match(auth, /SESSION_COOKIE_CACHE_SECONDS = 5 \* 60/);
  assert.match(auth, /cookiePrefix: "war-brasil"/);
  assert.match(authGuard, /disableCookieCache: true/);
  assert.match(authGuard, /authenticationRequiredResponse/);
  assert.match(authGuard, /status: 401/);
  assert.match(authGuard, /forbiddenResponse/);
  assert.match(authGuard, /status: 403/);
});

test("Proxy deixa apenas Home pública e não substitui backend auth", () => {
  assert.match(proxy, /pathname === "\/"/);
  assert.match(proxy, /api\/auth/);
  assert.match(proxy, /api\/internal/);
  assert.match(proxy, /auth\.api\.getSession/);
  assert.match(proxy, /authentication_required/);
  assert.match(proxy, /status: 401/);
  assert.match(proxy, /authentication_unavailable/);
  assert.match(proxy, /status: 503/);
  assert.match(proxy, /NextResponse\.redirect\(new URL\("\/", request\.url\)\)/);
  assert.match(authGuard, /withAuthenticatedApi/);
});

test("handler e client usam integrações oficiais Better Auth para Next e React", () => {
  assert.match(authRoute, /toNextJsHandler/);
  assert.match(authRoute, /export const \{ GET, POST \}/);
  assert.match(authClient, /createAuthClient/);
  assert.match(authClient, /useSession/);
  assert.match(authClient, /signIn/);
  assert.match(authClient, /signOut/);
  assert.match(authClient, /signUp/);
});

test("nenhuma variável auth server-only é publicada com NEXT_PUBLIC", () => {
  assert.doesNotMatch(
    authSources,
    /NEXT_PUBLIC_(?:BETTER_AUTH|GOOGLE|APPLE|DISCORD|DATABASE)/,
  );
  assert.doesNotMatch(
    envExample,
    /^NEXT_PUBLIC_(?:BETTER_AUTH|GOOGLE|APPLE|DISCORD|DATABASE)[A-Z0-9_]*=/m,
  );
  assert.match(envExample, /BETTER_AUTH_SECRET=/);
  assert.match(envExample, /GOOGLE_CLIENT_SECRET=/);
  assert.match(envExample, /APPLE_PRIVATE_KEY=/);
  assert.match(envExample, /DISCORD_CLIENT_SECRET=/);
});

test("emails auth não geram token próprio nem registram URL/token", () => {
  assert.match(email, /buildVerificationEmail/);
  assert.match(email, /buildPasswordResetEmail/);
  assert.match(email, /VERIFICAR EMAIL/);
  assert.match(email, /O link é válido por 1 hora/);
  assert.doesNotMatch(email, /randomBytes|createHash|token_hash|verification_tokens/);
  assert.doesNotMatch(email, /console\.(?:log|info|error)\([^)]*url/i);
});

test("validador de produção exige segredo forte e configuração dos três OAuth providers", () => {
  assert.match(environment, /BETTER_AUTH_SECRET\(>=\$\{AUTH_SECRET_MIN_LENGTH\} chars\)/);
  assert.match(environment, /GOOGLE_CLIENT_ID/);
  assert.match(environment, /GOOGLE_CLIENT_SECRET/);
  assert.match(environment, /APPLE_CLIENT_ID/);
  assert.match(environment, /APPLE_TEAM_ID/);
  assert.match(environment, /APPLE_KEY_ID/);
  assert.match(environment, /APPLE_PRIVATE_KEY/);
  assert.match(environment, /DISCORD_CLIENT_ID/);
  assert.match(environment, /DISCORD_CLIENT_SECRET/);
});

test("completude do Comando é lida de profile.commanders no servidor", () => {
  assert.match(commandAccess, /FROM profile\.commanders/);
  assert.match(commandAccess, /session\.user\.id/);
  assert.match(commandAccess, /profileComplete: Boolean\(handle && displayName\)/);
  assert.match(commandAccessRoute, /getAuthenticatedSession\(request\)/);
  assert.match(commandAccessRoute, /getCommandAccessState\(session\)/);
  assert.match(commandAccessRoute, /authenticationRequiredResponse/);
});

test("onboarding grava somente para a conta da sessão e trata handle concorrente", () => {
  assert.match(commandAccess, /INSERT INTO profile\.commanders\(user_id, handle, display_name\)/);
  assert.match(commandAccess, /\[session\.user\.id, handle, displayName\]/);
  assert.match(commandAccess, /error\.code === "23505"/);
  assert.match(commandAccessRoute, /validateCommanderIdentity\(input\)/);
  assert.match(commandAccessRoute, /status: 409/);
  assert.doesNotMatch(commandAccessRoute, /body\?\.userId|body\?\.user_id/);
});

test("Home nunca abre o Comando apenas pela sessão client; sempre consulta o gate server-side", () => {
  assert.match(home, /"onboarding"/);
  assert.match(home, /fetch\("\/api\/auth\/command-access"/);
  assert.match(home, /applyCommandAccess/);
  assert.match(home, /payload\.profileComplete/);
  assert.match(home, /setOnboardingOpen\(true\)/);
  assert.doesNotMatch(home, /authClient\.getSession/);
  assert.doesNotMatch(home, /if \(authSession\) \{\s*setCommandOpen\(true\)/);
});

test("onboarding coleta somente identidade pública e conclui pelo endpoint autenticado", () => {
  assert.match(onboarding, /name="displayName"/);
  assert.match(onboarding, /name="handle"/);
  assert.match(onboarding, /fetch\("\/api\/auth\/command-access"/);
  assert.match(onboarding, /method: "PUT"/);
  assert.doesNotMatch(onboarding, /name="email"|name="userId"|name="user_id"/);
  assert.match(onboarding, /aria-modal="true"/);
});
