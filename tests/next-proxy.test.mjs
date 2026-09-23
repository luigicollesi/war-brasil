import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
// Next 16.3.4 ainda publica o helper experimental de matcher sob o nome
// legado. A implementação é a mesma utility oficial usada para validar
// a config de Middleware/Proxy nessa versão.
const { unstable_doesMiddlewareMatch } = require(
  "next/experimental/testing/server",
);

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
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

  assert.equal(matches("/profile"), true);
  assert.equal(matches("/api/rooms"), true);
  assert.equal(matches("/api/auth/get-session"), false);
  assert.equal(matches("/api/health"), false);
  assert.equal(matches("/api/internal/lobby/cleanup"), false);
  assert.equal(matches("/_next/static/chunks/app.js"), false);
  assert.equal(matches("/_next/image?url=%2Ficone.png&w=64&q=75"), false);
  assert.equal(matches("/icone.png"), false);
});

test("Proxy preserva allowlist pública, 401 de API e redirect de página protegida", () => {
  assert.match(
    proxySource,
    /pathname === "\/"[\s\S]*pathname === "\/terms"[\s\S]*pathname === "\/privacy"/,
  );
  assert.match(
    proxySource,
    /NextResponse\.json\([\s\S]*authentication_required[\s\S]*status: 401/,
  );
  assert.match(
    proxySource,
    /NextResponse\.redirect\(new URL\("\/", request\.url\)\)/,
  );
});
