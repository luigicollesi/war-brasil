import assert from "node:assert/strict";

function baseUrlFromInput() {
  const raw =
    process.argv[2]?.trim() ||
    process.env.CLOUDFLARE_SMOKE_BASE_URL?.trim();

  if (!raw) {
    throw new Error(
      "Informe a URL do Worker: npm run cloudflare:smoke -- https://seu-dominio.example",
    );
  }

  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Smoke test remoto exige HTTPS.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function request(baseUrl, pathname, init = {}) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    ...init,
  });

  return response;
}

async function expectStatus(baseUrl, pathname, expected) {
  const response = await request(baseUrl, pathname);
  assert.equal(
    response.status,
    expected,
    `${pathname}: esperado HTTP ${expected}, recebido ${response.status}`,
  );
  return response;
}

async function main() {
  const baseUrl = baseUrlFromInput();

  for (const pathname of ["/", "/terms", "/privacy"]) {
    await expectStatus(baseUrl, pathname, 200);
    console.log(`PASS ${pathname} -> 200`);
  }

  const protectedPage = await request(baseUrl, "/profile");
  assert.ok(
    [301, 302, 303, 307, 308].includes(protectedPage.status),
    `/profile: esperado redirect sem sessão, recebido HTTP ${protectedPage.status}`,
  );
  const location = protectedPage.headers.get("location");
  assert.ok(location, "/profile: redirect sem header Location");
  assert.equal(
    new URL(location, baseUrl).pathname,
    "/",
    `/profile: esperado redirect para /, recebido ${location}`,
  );
  console.log(`PASS /profile -> ${protectedPage.status} /`);

  const protectedApi = await expectStatus(baseUrl, "/api/rooms", 401);
  const protectedApiPayload = await protectedApi.json().catch(() => null);
  assert.equal(
    protectedApiPayload?.error,
    "authentication_required",
    "/api/rooms: resposta 401 não usa o contrato authentication_required",
  );
  console.log("PASS /api/rooms -> 401 authentication_required");

  const session = await expectStatus(baseUrl, "/api/auth/get-session", 200);
  const sessionPayload = await session.json().catch(() => undefined);
  assert.notEqual(
    sessionPayload,
    undefined,
    "/api/auth/get-session: resposta não é JSON válido",
  );
  console.log("PASS /api/auth/get-session -> 200 JSON");

  console.log(`Cloudflare smoke concluído para ${baseUrl.origin}`);
}

await main();
