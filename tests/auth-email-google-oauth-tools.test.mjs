import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const authorizePath = "scripts/auth-email-google-authorize.sh";
const exchangePath = "scripts/auth-email-google-exchange.sh";
const callbackRoutePath = "src/app/api/google/callback/route.ts";

test("Google email OAuth tooling stays local/manual and never adds a production callback route", () => {
  assert.equal(existsSync(callbackRoutePath), false);
  assert.equal(existsSync(authorizePath), true);
  assert.equal(existsSync(exchangePath), true);

  const authorize = read(authorizePath);
  assert.match(authorize, /http:\/\/localhost:3000\/api\/google\/callback/);
  assert.match(authorize, /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(authorize, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
  assert.match(authorize, /access_type.*offline/);
  assert.match(authorize, /prompt.*consent/);
  assert.match(authorize, /randomBytes/);
  assert.match(authorize, /xdg-open|wslview|open/);
});

test("authorization helper reads mailer OAuth values from environment files without sourcing them", () => {
  const authorize = read(authorizePath);

  assert.match(authorize, /AUTH_EMAIL_GOOGLE_CLIENT_ID/);
  assert.match(authorize, /AUTH_EMAIL_GOOGLE_REDIRECT_URI/);
  assert.match(authorize, /\.env\.local/);
  assert.match(authorize, /\.env/);
  assert.doesNotMatch(authorize, /source\s+.*\.env|\.\s+.*\.env/);
});

test("exchange helper accepts pasted localhost callback URL and prints refresh-token env output", () => {
  const exchange = read(exchangePath);

  assert.match(exchange, /Uso:.*auth-email-google-exchange\.sh/);
  assert.match(exchange, /new URL/);
  assert.match(exchange, /searchParams\.get\("code"\)/);
  assert.match(exchange, /searchParams\.get\("state"\)/);
  assert.match(exchange, /oauth2\.googleapis\.com\/token/);
  assert.match(exchange, /grant_type.*authorization_code/);
  assert.match(exchange, /AUTH_EMAIL_GOOGLE_REFRESH_TOKEN=/);
  assert.match(exchange, /AUTH_EMAIL_TRANSPORT=gmail-oauth/);
  assert.doesNotMatch(exchange, /AUTH_EMAIL_GOOGLE_CLIENT_SECRET=\$CLIENT_SECRET/);
});

test("package and env example expose the two manual commands and loopback redirect", () => {
  const pkg = JSON.parse(read("package.json"));
  const envExample = read(".env.example");

  assert.equal(
    pkg.scripts["auth:email:google:authorize"],
    "bash scripts/auth-email-google-authorize.sh",
  );
  assert.equal(
    pkg.scripts["auth:email:google:exchange"],
    "bash scripts/auth-email-google-exchange.sh",
  );
  assert.match(
    envExample,
    /AUTH_EMAIL_GOOGLE_REDIRECT_URI=http:\/\/localhost:3000\/api\/google\/callback/,
  );
  assert.match(envExample, /não existe rota de callback/i);
});
