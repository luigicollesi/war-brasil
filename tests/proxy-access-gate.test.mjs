import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  getRedirectUrl,
  unstable_doesProxyMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";

const proxyPath = "src/proxy.ts";

test("Next 16 usa proxy.ts como único access gate de navegação", () => {
  assert.equal(existsSync(proxyPath), true);
  assert.equal(existsSync("src/middleware.ts"), false);

  const source = readFileSync(proxyPath, "utf8");
  assert.match(source, /export function proxy\(request: NextRequest\)/);
  assert.match(source, /getSessionCookie/);
  assert.match(source, /cookiePrefix:\s*"war-brasil"/);
  assert.doesNotMatch(source, /request\.cookies[\s\S]*getAll\(\)/);
  assert.doesNotMatch(source, /auth\.api\.getSession|betterAuth\(|DATABASE_URL|authPool|\bpg\b/);
});

test("matcher oficial preserva rotas públicas e exclui infraestrutura técnica", async () => {
  const { config } = await import("../src/proxy.ts");

  for (const url of ["/", "/terms", "/privacy", "/profile", "/matchmaking", "/api/rooms"]) {
    assert.equal(
      unstable_doesProxyMatch({ config, nextConfig: {}, url }),
      true,
      `Proxy deveria avaliar ${url}`,
    );
  }

  for (const url of [
    "/api/auth/get-session",
    "/api/health",
    "/api/internal/lobby/cleanup",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/icone.png",
  ]) {
    assert.equal(
      unstable_doesProxyMatch({ config, nextConfig: {}, url }),
      false,
      `Proxy não deveria avaliar ${url}`,
    );
  }
});

test("proxy redireciona página protegida sem cookie e responde API protegida com 401", async () => {
  const { proxy } = await import("../src/proxy.ts");

  const pageResponse = await proxy(
    new NextRequest("https://bellumcivile.com/profile"),
  );
  assert.equal(getRedirectUrl(pageResponse), "https://bellumcivile.com/");

  const apiResponse = await proxy(
    new NextRequest("https://bellumcivile.com/api/rooms"),
  );
  assert.equal(apiResponse.status, 401);
  assert.deepEqual(await apiResponse.json(), {
    error: "authentication_required",
    message: "Autenticação necessária para acessar este recurso.",
  });
});

test("proxy libera landing e reconhece cookie Better Auth com prefixo configurado", async () => {
  const { proxy } = await import("../src/proxy.ts");

  const landingResponse = await proxy(
    new NextRequest("https://bellumcivile.com/"),
  );
  assert.equal(landingResponse.headers.get("x-middleware-next"), "1");

  const authenticatedResponse = await proxy(
    new NextRequest("https://bellumcivile.com/profile", {
      headers: {
        cookie: "war-brasil.session_token=test-session-token",
      },
    }),
  );
  assert.equal(authenticatedResponse.headers.get("x-middleware-next"), "1");
});
