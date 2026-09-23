import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";

const proxyPath = "src/proxy.ts";
const middlewarePath = "src/middleware.ts";
const proxySource = existsSync(proxyPath) ? readFileSync(proxyPath, "utf8") : "";

function sourceConfig() {
  const match = proxySource.match(
    /matcher:\s*\[\s*("(?:\\.|[^"\\])*")\s*,?\s*\]/s,
  );
  assert.ok(match, "proxy.ts deve manter matcher literal analisável pelo Next.js");
  return { matcher: [JSON.parse(match[1])] };
}

test("Next 16 usa proxy.ts com helper oficial de cookie do Better Auth", () => {
  assert.equal(existsSync(proxyPath), true, "src/proxy.ts deve existir");
  assert.equal(existsSync(middlewarePath), false, "src/middleware.ts deve ser removido");
  assert.match(proxySource, /export function proxy\(request: NextRequest\)/);
  assert.match(proxySource, /from "better-auth\/cookies"/);
  assert.match(proxySource, /getSessionCookie\(request,\s*\{[\s\S]*cookiePrefix: "war-brasil"/);
  assert.doesNotMatch(proxySource, /SESSION_COOKIE_SUFFIX|request\.cookies[\s\S]*getAll\(\)/);
  assert.doesNotMatch(proxySource, /auth\.api\.getSession|better-auth["']|\bpg\b|authPool|DATABASE_URL/);
});

test("matcher real do Proxy inclui negócio e exclui auth, health, internal e assets", () => {
  const config = sourceConfig();
  const matches = (url) =>
    unstable_doesProxyMatch({ config, nextConfig: {}, url });

  assert.equal(matches("/profile"), true);
  assert.equal(matches("/api/rooms"), true);
  assert.equal(matches("/api/auth/get-session"), false);
  assert.equal(matches("/api/health"), false);
  assert.equal(matches("/api/internal/lobby/cleanup"), false);
  assert.equal(matches("/_next/static/chunks/app.js"), false);
  assert.equal(matches("/_next/image?url=%2Ficone.png&w=64&q=75"), false);
  assert.equal(matches("/icone.png"), false);
});

test("Proxy mantém allowlist pública, redirect de página e 401 de API", async () => {
  assert.equal(existsSync(proxyPath), true, "src/proxy.ts deve existir antes do teste funcional");
  const moduleUrl = pathToFileURL(proxyPath).href;
  const { proxy } = await import(moduleUrl);

  const publicResponse = await proxy(new NextRequest("http://localhost/terms"));
  assert.equal(publicResponse.headers.get("x-middleware-next"), "1");

  const protectedResponse = await proxy(
    new NextRequest("http://localhost/profile"),
  );
  assert.equal(protectedResponse.status, 307);
  assert.equal(protectedResponse.headers.get("location"), "http://localhost/");

  const apiResponse = await proxy(
    new NextRequest("http://localhost/api/rooms"),
  );
  assert.equal(apiResponse.status, 401);
  assert.deepEqual(await apiResponse.json(), {
    error: "authentication_required",
    message: "Autenticação necessária para acessar este recurso.",
  });

  const authenticatedResponse = await proxy(
    new NextRequest("http://localhost/profile", {
      headers: {
        cookie: "war-brasil.session_token=opaque-session-token",
      },
    }),
  );
  assert.equal(authenticatedResponse.headers.get("x-middleware-next"), "1");
});
