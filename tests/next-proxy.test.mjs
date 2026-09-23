import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
const { unstable_doesProxyMatch } = require("next/experimental/testing/server");

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

test("Proxy retorna redirect de página protegida e 401 de API sem sessão", async () => {
  assert.equal(existsSync(proxyPath), true, "src/proxy.ts deve existir antes do teste funcional");

  const runtimePath = `.proxy-runtime-${process.pid}.ts`;
  writeFileSync(
    runtimePath,
    proxySource.replaceAll('"next/server"', '"next/server.js"'),
    "utf8",
  );

  try {
    const moduleUrl = `${pathToFileURL(runtimePath).href}?pid=${process.pid}`;
    const { proxy } = await import(moduleUrl);

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
  } finally {
    unlinkSync(runtimePath);
  }
});
