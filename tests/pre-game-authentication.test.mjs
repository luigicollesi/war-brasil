import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const auth = readFileSync("src/lib/server/auth/auth.ts", "utf8");
const environment = readFileSync("src/lib/server/auth/environment.ts", "utf8");
const authPool = readFileSync("src/lib/server/auth/auth-pool.ts", "utf8");
const authGuard = readFileSync("src/lib/server/auth/auth-guard.ts", "utf8");
const requestOrigin = readFileSync("src/lib/server/auth/request-origin.ts", "utf8");
const commandAccess = readFileSync(
  "src/lib/server/auth/command-access.ts",
  "utf8",
);
const commandAccessRoute = readFileSync(
  "src/app/api/auth/command-access/route.ts",
  "utf8",
);
const commandAccessAgeRoute = readFileSync(
  "src/app/api/auth/command-access/age/route.ts",
  "utf8",
);
const authClient = readFileSync("src/lib/client/auth-client.ts", "utf8");
const authRoute = readFileSync("src/app/api/auth/[...all]/route.ts", "utf8");
const registerRoute = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const verifyRegistrationRoute = readFileSync(
  "src/app/api/auth/register/verify/route.ts",
  "utf8",
);
const resendRegistrationRoute = readFileSync(
  "src/app/api/auth/register/resend/route.ts",
  "utf8",
);
const pendingRegistration = readFileSync(
  "src/lib/server/auth/pending-registration.ts",
  "utf8",
);
const pendingRegistrationMigration = readFileSync(
  "src/lib/db/migrations/managed/049-pending-email-registration.sql",
  "utf8",
);
const ageEligibilityMigration = readFileSync(
  "src/lib/db/migrations/managed/057-auth-age-eligibility.sql",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");
const email = readFileSync("src/lib/server/auth/email.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const authModal = readFileSync(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);
const onboarding = readFileSync(
  "src/components/auth/command-onboarding-modal.tsx",
  "utf8",
);
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const createRoomRoute = readFileSync("src/app/api/rooms/route.ts", "utf8");
const joinRoomRoute = readFileSync("src/app/api/rooms/join/route.ts", "utf8");
const lobbyE2e = readFileSync("scripts/e2e/lobby-e2e.mjs", "utf8");

const authSources = [
  auth,
  environment,
  authPool,
  authGuard,
  requestOrigin,
  commandAccess,
  commandAccessRoute,
  commandAccessAgeRoute,
  authClient,
  authRoute,
  registerRoute,
  verifyRegistrationRoute,
  resendRegistrationRoute,
  pendingRegistration,
  proxy,
  email,
].join("\n");

test("auth fixa Better Auth e dependências server-only em versões exatas", () => {
  assert.equal(pkg.dependencies["better-auth"], "1.7.4");
  assert.equal(pkg.dependencies["server-only"], "0.0.1");
});

test("auth de servidor permanece server-only e usa schema PostgreSQL dedicado", () => {
  assert.match(auth, /^import "server-only";/m);
  assert.match(environment, /^import "server-only";/m);
  assert.match(authPool, /^import "server-only";/m);
  assert.match(authGuard, /^import "server-only";/m);
  assert.match(requestOrigin, /^import "server-only";/m);
  assert.match(commandAccess, /^import "server-only";/m);
  assert.match(authPool, /options: "-c search_path=auth"/);
  assert.match(auth, /database: authPool/);
  assert.match(auth, /generateId: "uuid"/);
  assert.match(auth, /joins: true/);
  assert.match(
    authPool,
    /process\.env\["NEXT_PHASE"\] === "phase-production-build"/,
  );
  assert.match(
    authPool,
    /AUTH_DATABASE_URL ou DATABASE_URL não está configurada para autenticação/,
  );
});

test("launch auth possui somente Google, Discord e credentials", () => {
  assert.match(auth, /google:/);
  assert.match(auth, /discord:/);
  assert.match(auth, /emailAndPassword:/);
  assert.doesNotMatch(auth, /apple|github|microsoft|twitch|steam|epic|passkey/i);
  assert.doesNotMatch(authModal, /apple|Continuar com Apple/i);
});

test("credentials só cria conta após OTP e bloqueia signup direto do Better Auth", () => {
  assert.match(auth, /requireEmailVerification: true/);
  assert.match(auth, /emailAndPassword:[\s\S]*disableSignUp: true/);
  assert.match(auth, /emailAndPassword:[\s\S]*autoSignIn: false/);
  assert.match(auth, /hash: hashPassword/);
  assert.match(auth, /verify: verifyPassword/);
  assert.match(auth, /AUTH_TOKEN_TTL_SECONDS = 60 \* 60/);
  assert.match(auth, /resetPasswordTokenExpiresIn: AUTH_TOKEN_TTL_SECONDS/);
  assert.match(auth, /revokeSessionsOnPasswordReset: true/);
  assert.doesNotMatch(auth, /sendOnSignUp|sendVerificationEmail/);
});

test("linking é explícito e não confia em coincidência de email", () => {
  assert.match(auth, /disableImplicitLinking: true/);
  assert.match(auth, /allowDifferentEmails: true/);
  assert.match(auth, /trustedProviders: \[\]/);
  assert.match(auth, /updateUserInfoOnLink: false/);
  assert.match(auth, /allowUnlinkingAll: false/);
});

test("Discord possui fallback estável e não-entregável quando email falta", () => {
  assert.match(auth, /\$\{profile\.id\}@discord\.placeholder\.invalid/);
  assert.match(auth, /scope: \["identify", "email"\]/);
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

test("Proxy mantém navegação protegida sem carregar Better Auth/PostgreSQL", () => {
  assert.match(proxy, /pathname === "\/"/);
  assert.match(proxy, /pathname === "\/terms"/);
  assert.match(proxy, /pathname === "\/privacy"/);
  assert.match(proxy, /api\/auth/);
  assert.match(proxy, /api\/internal/);
  assert.match(proxy, /SESSION_COOKIE_SUFFIX = "war-brasil\.session_token"/);
  assert.match(proxy, /request\.cookies[\s\S]*getAll\(\)/);
  assert.match(proxy, /authentication_required/);
  assert.match(proxy, /status: 401/);
  assert.match(proxy, /NextResponse\.redirect\(new URL\("\/", request\.url\)\)/);
  assert.doesNotMatch(proxy, /from ["'].*auth["']/);
  assert.doesNotMatch(proxy, /auth\.api\.getSession|\bpg\b|authPool|DATABASE_URL/);
  assert.match(authGuard, /withAuthenticatedApi/);
});

test("handler e client usam integrações oficiais Better Auth para Next e React", () => {
  assert.match(authRoute, /toNextJsHandler/);
  assert.match(authRoute, /export const GET = handlers\.GET/);
  assert.match(authRoute, /export async function POST/);
  assert.match(authRoute, /rejectUntrustedAuthMutationOrigin\(request\)/);
  assert.match(authClient, /createAuthClient/);
  assert.match(authClient, /useSession/);
  assert.match(authClient, /signIn/);
  assert.match(authClient, /signOut/);
  assert.match(authClient, /signUp/);
});

test("mutações auth browser por POST exigem origem first-party", () => {
  assert.match(requestOrigin, /request\.method !== "POST"/);
  assert.match(requestOrigin, /headers\.get\("origin"\)/);
  assert.match(requestOrigin, /headers\.get\("referer"\)/);
  assert.match(requestOrigin, /environment\.baseUrl/);
  assert.match(requestOrigin, /status: 403/);
  assert.match(registerRoute, /rejectUntrustedAuthMutationOrigin\(request\)/);
  assert.match(verifyRegistrationRoute, /rejectUntrustedAuthMutationOrigin\(request\)/);
  assert.match(resendRegistrationRoute, /rejectUntrustedAuthMutationOrigin\(request\)/);
  assert.doesNotMatch(requestOrigin, /EXTERNAL_POST_CALLBACK_PREFIX|isExternalAuthProviderCallback/);
  assert.doesNotMatch(requestOrigin, /trustedProxyHeaders|x-forwarded-host|x-forwarded-proto/i);
});

test("nenhuma variável auth server-only é publicada com NEXT_PUBLIC", () => {
  assert.doesNotMatch(
    authSources,
    /NEXT_PUBLIC_(?:BETTER_AUTH|GOOGLE|DISCORD|DATABASE)/,
  );
  assert.doesNotMatch(
    envExample,
    /^NEXT_PUBLIC_(?:BETTER_AUTH|GOOGLE|DISCORD|DATABASE)[A-Z0-9_]*=/m,
  );
  assert.match(envExample, /BETTER_AUTH_SECRET=/);
  assert.match(envExample, /GOOGLE_CLIENT_SECRET=/);
  assert.match(envExample, /DISCORD_CLIENT_SECRET=/);
  assert.doesNotMatch(envExample, /APPLE_/);
});

test("cadastro usa OTP próprio temporário sem persistir código ou senha em texto puro", () => {
  assert.match(email, /buildRegistrationCodeEmail/);
  assert.match(email, /código é válido por 10 minutos/i);
  assert.match(pendingRegistration, /randomInt/);
  assert.match(pendingRegistration, /createHmac\("sha256"/);
  assert.match(pendingRegistration, /aes-256-gcm/);
  assert.match(pendingRegistration, /hashPassword\(password\)/);
  assert.match(pendingRegistrationMigration, /password_ciphertext TEXT NOT NULL/);
  assert.match(pendingRegistrationMigration, /verification_code_hash TEXT NOT NULL/);
  assert.doesNotMatch(pendingRegistrationMigration, /\bpassword\s+TEXT|verification_code\s+TEXT/i);
  assert.doesNotMatch(email, /console\.(?:log|info|error)\([^)]*code/i);
});

test("validador de produção exige segredo forte e configuração dos dois OAuth providers", () => {
  assert.match(environment, /BETTER_AUTH_SECRET\(>=\$\{AUTH_SECRET_MIN_LENGTH\} chars\)/);
  assert.match(environment, /GOOGLE_CLIENT_ID/);
  assert.match(environment, /GOOGLE_CLIENT_SECRET/);
  assert.match(environment, /DISCORD_CLIENT_ID/);
  assert.match(environment, /DISCORD_CLIENT_SECRET/);
  assert.doesNotMatch(environment, /APPLE_/);
});

test("completude do Comando exige idade verificada e identidade pública", () => {
  assert.match(commandAccess, /FROM profile\.commanders/);
  assert.match(commandAccess, /auth\.user_age_eligibility/);
  assert.match(commandAccess, /session\.user\.id/);
  assert.match(commandAccess, /identityComplete = Boolean\(handle && displayName\)/);
  assert.match(commandAccess, /profileComplete: ageGateComplete && identityComplete/);
  assert.match(commandAccessRoute, /getAuthenticatedSession\(request\)/);
  assert.match(commandAccessRoute, /getCommandAccessState\(session\)/);
  assert.match(commandAccessRoute, /authenticationRequiredResponse/);
});

test("onboarding grava somente para a conta da sessão, exige idade e trata handle concorrente", () => {
  assert.match(commandAccess, /INSERT INTO profile\.commanders\(user_id, handle, display_name\)/);
  assert.match(commandAccess, /\[session\.user\.id, handle, displayName\]/);
  assert.match(commandAccess, /CommanderAgeGateRequiredError/);
  assert.match(commandAccess, /error\.code === "23505"/);
  assert.match(commandAccessRoute, /validateCommanderIdentity\(input\)/);
  assert.match(commandAccessRoute, /age_gate_required/);
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

test("onboarding coleta nascimento antes da identidade pública e exclui conta abaixo da idade mínima", () => {
  assert.match(onboarding, /name="birthDate"/);
  assert.match(onboarding, /fetch\("\/api\/auth\/command-access\/age"/);
  assert.match(onboarding, /name="displayName"/);
  assert.match(onboarding, /name="handle"/);
  assert.match(onboarding, /fetch\("\/api\/auth\/command-access"/);
  assert.match(onboarding, /method: "PUT"/);
  assert.match(commandAccessAgeRoute, /validateCommanderBirthDate/);
  assert.match(commandAccessAgeRoute, /minimum_age_not_met/);
  assert.match(commandAccess, /DELETE FROM auth\."user"/);
  assert.match(commandAccess, /COMMAND_MINIMUM_AGE = 10/);
  assert.match(ageEligibilityMigration, /CREATE TABLE IF NOT EXISTS auth\.user_age_eligibility/);
  assert.match(ageEligibilityMigration, /birth_date DATE NOT NULL/);
  assert.doesNotMatch(onboarding, /name="email"|name="userId"|name="user_id"/);
  assert.match(onboarding, /aria-modal="true"/);
});

test("create/join vinculam conta e snapshot público ao assento na transação", () => {
  assert.match(rooms, /type AuthenticatedPlayerIdentity/);
  assert.match(rooms, /user_id,\s*display_name_snapshot,\s*handle_snapshot/);
  assert.match(rooms, /identity\?\.userId \?\? null/);
  assert.match(rooms, /attachIdentityToExistingSeat/);
  assert.match(rooms, /existingBySession\.user_id !== identity\.userId/);
  assert.match(rooms, /SET player_session = \$1/);

  for (const route of [createRoomRoute, joinRoomRoute]) {
    assert.match(route, /getAuthenticatedSession\(request\)/);
    assert.match(route, /getCommandAccessState\(accountSession\)/);
    assert.match(route, /profileComplete/);
    assert.match(route, /userId: accountSession\.user\.id/);
    assert.match(route, /displayName: access\.profile\.displayName/);
    assert.match(route, /handle: access\.profile\.handle/);
  }
});

test("Lobby E2E usa promoção OTP e sessão Better Auth real sem bypass de CI", () => {
  assert.match(lobbyE2e, /\/api\/auth\/register/);
  assert.match(lobbyE2e, /waitForRegistrationCode/);
  assert.match(lobbyE2e, /\/api\/auth\/register\/verify/);
  assert.match(lobbyE2e, /authenticated/);
  assert.match(lobbyE2e, /\/api\/auth\/command-access/);
  assert.match(lobbyE2e, /profileComplete/);
  assert.doesNotMatch(lobbyE2e, /UPDATE auth\."user"|AUTH_BYPASS|SKIP_AUTH|DISABLE_AUTH/);
});


test("email auth usa somente Resend sem seletor de transportador", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(environment, /EMAIL_TRANSPORT_SECRET/);
  assert.match(environment, /AUTH_EMAIL_FROM/);
  assert.doesNotMatch(email, /gmail\.googleapis\.com|oauth2\.googleapis\.com/);
  assert.doesNotMatch(environment, /AUTH_EMAIL_TRANSPORT|AUTH_EMAIL_GOOGLE_/);
  assert.doesNotMatch(envExample, /AUTH_EMAIL_TRANSPORT|AUTH_EMAIL_GOOGLE_/);
});

test("email configurado entrega via Resend também em desenvolvimento", () => {
  assert.match(email, /resolveResendTransport/);
  assert.match(
    email,
    /if \(transport\) \{[\s\S]*await deliverWithResend\(message, transport\)/,
  );
  assert.match(
    email,
    /process\.env\.NODE_ENV === "production"[\s\S]*Transportador de email de autenticação não configurado/,
  );
});

test("email de cadastro apresenta OTP na identidade visual de comando", () => {
  assert.match(email, /IDENTIDADE DE COMANDO/);
  assert.match(email, /Seu código de confirmação/);
  assert.match(email, /Confirme seu email/);
  assert.match(email, /letter-spacing:10px/);
  assert.match(email, /10 minutos/);
});


test("registro permanece temporário até confirmação e promoção é atômica", () => {
  assert.match(registerRoute, /beginPendingRegistration\(\{ email, password \}\)/);
  assert.match(registerRoute, /buildRegistrationCodeEmail\(pending\.code\)/);
  assert.doesNotMatch(registerRoute, /sign-up\/email|sendVerificationEmail/);

  assert.match(verifyRegistrationRoute, /verifyPendingRegistration\(email, code\)/);
  assert.match(verifyRegistrationRoute, /auth\.api\.signInEmail/);
  assert.match(verifyRegistrationRoute, /next: "onboarding"/);

  assert.match(pendingRegistration, /INSERT INTO auth\."user"/);
  assert.match(pendingRegistration, /"emailVerified"/);
  assert.match(pendingRegistration, /VALUES\(\$1, 'Comandante', \$2, TRUE/);
  assert.match(pendingRegistration, /INSERT INTO auth\."account"/);
  assert.match(pendingRegistration, /'credential'/);
  assert.match(pendingRegistration, /DELETE FROM auth\.pending_registration WHERE email = \$1/);
});

test("registro não informa sucesso de envio se nem remetente nem Resend estiverem configurados parcialmente", () => {
  assert.match(environment, /AUTH_EMAIL_FROM/);
  assert.match(environment, /EMAIL_TRANSPORT_SECRET/);
  assert.match(
    environment,
    /if \([\s\S]*Boolean\(environment\.email\.from\) !==[\s\S]*Boolean\(environment\.email\.transportSecret\)[\s\S]*\)/,
  );
  assert.match(environment, /Configuração parcial de email de autenticação/);
});


test("promoção de credencial separa accountId text de userId uuid", () => {
  assert.match(
    pendingRegistration,
    /VALUES\(\$1, \$2, 'credential', \$3, \$4, NOW\(\), NOW\(\)\)/,
  );
  assert.match(
    pendingRegistration,
    /\[randomUUID\(\), userId, userId, passwordHash\]/,
  );
  assert.doesNotMatch(
    pendingRegistration,
    /VALUES\(\$1, \$2, 'credential', \$2, \$3, NOW\(\), NOW\(\)\)/,
  );
});
