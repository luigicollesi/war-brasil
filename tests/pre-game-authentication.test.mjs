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
const authClient = readFileSync("src/lib/client/auth-client.ts", "utf8");
const authRoute = readFileSync("src/app/api/auth/[...all]/route.ts", "utf8");
const registerRoute = readFileSync("src/app/api/auth/register/route.ts", "utf8");
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
  authClient,
  authRoute,
  registerRoute,
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
});

test("launch auth possui somente Google, Discord e credentials", () => {
  assert.match(auth, /google:/);
  assert.match(auth, /discord:/);
  assert.match(auth, /emailAndPassword:/);
  assert.doesNotMatch(auth, /apple|github|microsoft|twitch|steam|epic|passkey/i);
  assert.doesNotMatch(authModal, /apple|Continuar com Apple/i);
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

test("emails auth não geram token próprio nem registram URL/token", () => {
  assert.match(email, /buildVerificationEmail/);
  assert.match(email, /buildPasswordResetEmail/);
  assert.match(email, /CONFIRMAR EMAIL/);
  assert.match(email, /O link é válido por 1 hora/);
  assert.doesNotMatch(email, /randomBytes|createHash|token_hash|verification_tokens/);
  assert.doesNotMatch(email, /console\.(?:log|info|error)\([^)]*url/i);
});

test("validador de produção exige segredo forte e configuração dos dois OAuth providers", () => {
  assert.match(environment, /BETTER_AUTH_SECRET\(>=\$\{AUTH_SECRET_MIN_LENGTH\} chars\)/);
  assert.match(environment, /GOOGLE_CLIENT_ID/);
  assert.match(environment, /GOOGLE_CLIENT_SECRET/);
  assert.match(environment, /DISCORD_CLIENT_ID/);
  assert.match(environment, /DISCORD_CLIENT_SECRET/);
  assert.doesNotMatch(environment, /APPLE_/);
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

test("Lobby E2E usa sessão Better Auth real e não bypass de CI", () => {
  assert.match(lobbyE2e, /\/api\/auth\/register/);
  assert.match(lobbyE2e, /UPDATE auth\."user"/);
  assert.match(lobbyE2e, /\/api\/auth\/sign-in\/email/);
  assert.match(lobbyE2e, /\/api\/auth\/command-access/);
  assert.match(lobbyE2e, /profileComplete/);
  assert.doesNotMatch(lobbyE2e, /AUTH_BYPASS|SKIP_AUTH|DISABLE_AUTH/);
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

test("email de verificação usa identidade visual de comando e CTA dominante", () => {
  assert.match(email, /IDENTIDADE DE COMANDO/);
  assert.match(email, /CONFIRMAR EMAIL/);
  assert.match(email, /Bem-vindo ao Comando/);
  assert.match(email, /background:#d0aa57/);
  assert.match(email, /display:inline-block/);
  assert.match(email, /padding:16px 28px/);
  assert.match(email, /Se o botão não funcionar/);
});


test("registro customizado dispara exatamente o fluxo automático de verificação inclusive para conta pendente existente", () => {
  assert.match(auth, /sendOnSignUp:\s*false/);
  assert.doesNotMatch(auth, /sendOnSignUp:\s*true/);

  assert.match(registerRoute, /const VERIFICATION_CALLBACK_URL = "\/\?emailVerified=success&continue=command"/);
  assert.match(
    registerRoute,
    /if \(response\.ok\) \{[\s\S]*await auth\.api\.sendVerificationEmail\(\{[\s\S]*body:\s*\{[\s\S]*email,[\s\S]*callbackURL:\s*VERIFICATION_CALLBACK_URL/,
  );
  assert.match(
    registerRoute,
    /await auth\.api\.sendVerificationEmail[\s\S]*return genericRegistrationResponse\(\)/,
  );
});

test("registro não informa sucesso de envio se nem remetente nem Resend estiverem configurados parcialmente", () => {
  assert.match(environment, /AUTH_EMAIL_FROM/);
  assert.match(environment, /EMAIL_TRANSPORT_SECRET/);
  assert.match(
    environment,
    /if \(Boolean\(environment\.email\.from\) !== Boolean\(environment\.email\.transportSecret\)\)/,
  );
  assert.match(environment, /Configuração parcial de email de autenticação/);
});
