import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

const nextConfig = readFileSync("next.config.ts", "utf8");
const openNextConfig = readFileSync("open-next.config.ts", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");
const headers = readFileSync("public/_headers", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");

test("Cloudflare usa o bundle OpenNext como entrypoint do Worker", () => {
  assert.match(wrangler, /"main": "\.open-next\/worker\.js"/);
  assert.match(wrangler, /"directory": "\.open-next\/assets"/);
  assert.match(wrangler, /"binding": "ASSETS"/);
  assert.match(openNextConfig, /defineCloudflareConfig/);
});

test("deploy valida secrets essenciais antes do runtime", () => {
  for (const name of [
    "DATABASE_URL",
    "DATABASE_HYPERDRIVE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "AUTH_EMAIL_FROM",
    "EMAIL_TRANSPORT_SECRET",
    "ASSET_STORAGE_URL",
    "ASSET_STORAGE_ACCESS_KEY_ID",
    "ASSET_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    assert.ok(wrangler.includes(`"${name}"`), `secret obrigatório ausente: ${name}`);
  }
});

test("Hyperdrive mantém URL de origem direta como secret e binding separado", () => {
  assert.match(wrangler, /"DATABASE_HYPERDRIVE_URL"/);
  assert.match(
    wrangler,
    /DATABASE_HYPERDRIVE itself is a Cloudflare resource binding/,
  );
  assert.doesNotMatch(wrangler, /"DATABASE_HYPERDRIVE"\s*:\s*"postgres/i);
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

test("Workers Builds usa OpenNext e Wrangler pinados pelo lockfile", () => {
  assert.equal(pkg.dependencies["@opennextjs/cloudflare"], "1.20.6");
  assert.equal(pkg.devDependencies.wrangler, "4.135.0");
  assert.equal(lock.packages[""].dependencies["@opennextjs/cloudflare"], "1.20.6");
  assert.equal(lock.packages[""].devDependencies.wrangler, "4.135.0");
  assert.equal(lock.packages["node_modules/@opennextjs/cloudflare"].version, "1.20.6");
  assert.equal(lock.packages["node_modules/wrangler"].version, "4.135.0");
  assert.equal(pkg.scripts["cloudflare:prepare"], undefined);
  assert.match(pkg.scripts["cloudflare:build"], /cloudflare:patch-next/);
  assert.doesNotMatch(pkg.scripts["cloudflare:build"], /npm install|cloudflare:prepare/);
  assert.equal(
    pkg.scripts["cloudflare:patch-next"],
    "node scripts/patch-next-cloudflare-middleware-manifest.mjs",
  );
  assert.equal(
    pkg.scripts["cloudflare:check-next-patch"],
    "node scripts/patch-next-cloudflare-middleware-manifest.mjs --check",
  );
  assert.equal(pkg.scripts["cloudflare:deploy"], "opennextjs-cloudflare deploy");
  assert.equal(pkg.scripts["cloudflare:upload"], "opennextjs-cloudflare upload");
  assert.equal(pkg.scripts["cloudflare:smoke"], "node scripts/cloudflare-smoke.mjs");
  assert.doesNotMatch(pkg.scripts["cloudflare:deploy"], /npm install|cloudflare:prepare/);
});


test("external Node services permanecem desligados no runtime e Workers Builds respeita variáveis configuradas", () => {
  assert.match(wrangler, /"GAME_REALTIME_ENABLED": "false"/);
  assert.match(wrangler, /"GAME_AUTOMATION_WORKER_MODE": "off"/);
  assert.match(wrangler, /"ASSET_STORAGE_BUCKET": "war-brasil-assets-prod"/);
  assert.doesNotMatch(pkg.scripts["cloudflare:build"], /NEXT_PUBLIC_GAME_REALTIME_MODE=/);
  assert.doesNotMatch(pkg.scripts["cloudflare:build"], /GAME_REALTIME_ENABLED=/);
  assert.doesNotMatch(pkg.scripts["cloudflare:preview"], /NEXT_PUBLIC_GAME_REALTIME_MODE=/);
  assert.match(pkg.scripts["cloudflare:build"], /opennextjs-cloudflare build/);
});


test("segredos locais do Wrangler não entram no Git", () => {
  assert.match(gitignore, /^\.dev\.vars\*$/m);
  assert.match(gitignore, /^\.env\*$/m);
});
