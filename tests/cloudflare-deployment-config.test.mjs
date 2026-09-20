import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nextConfig = readFileSync("next.config.ts", "utf8");
const openNextConfig = readFileSync("open-next.config.ts", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");
const headers = readFileSync("public/_headers", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");

test("Cloudflare usa o bundle OpenNext como entrypoint do Worker", () => {
  assert.match(wrangler, /"main": "\.open-next\/worker\.js"/);
  assert.match(wrangler, /"directory": "\.open-next\/assets"/);
  assert.match(wrangler, /"binding": "ASSETS"/);
  assert.match(openNextConfig, /defineCloudflareConfig/);
});

test("deploy valida secrets essenciais antes do runtime", () => {
  for (const name of [
    "DATABASE_URL",
    "AUTH_DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "DISCORD_CLIENT_SECRET",
    "EMAIL_TRANSPORT_SECRET",
    "ASSET_STORAGE_ACCESS_KEY_ID",
    "ASSET_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    assert.ok(wrangler.includes(`"${name}"`), `secret obrigatório ausente: ${name}`);
  }
});

test("Cloudflare não depende de Images para assets WebP/SVG já otimizados", () => {
  assert.match(nextConfig, /images:[\s\S]*unoptimized: true/);
  assert.doesNotMatch(wrangler, /"binding": "IMAGES"/);
});

test("chunks estáticos do Next recebem cache imutável", () => {
  assert.match(headers, /\/_next\/static\/\*/);
  assert.match(headers, /max-age=31536000/);
  assert.match(headers, /immutable/);
});

test("Middleware Edge não carrega Better Auth, pg ou DATABASE_URL", () => {
  assert.doesNotMatch(middleware, /auth\.api|better-auth|\bpg\b|DATABASE_URL|authPool/);
  assert.match(middleware, /war-brasil\.session_token/);
  assert.match(middleware, /export function middleware/);
});
