import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL;
const ARTIFACT_DIR = path.resolve(
  process.env.LOBBY_E2E_ARTIFACT_DIR ?? "test-results/lobby-eval",
);

if (!DATABASE_URL) {
  throw new Error("LOBBY_E2E_DATABASE_URL é obrigatória.");
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

const failures = [];
const foundationDeprecations = [];

async function step(name, callback) {
  process.stdout.write(`\n[lobby-e2e] ${name} ... `);
  try {
    await callback();
    console.log("ok");
  } catch (error) {
    failures.push({ name, error });
    console.log("falhou");
    console.error(error);
  }
}

async function createActor(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    reducedMotion: options.reducedMotion ?? "no-preference",
    permissions: ["clipboard-read", "clipboard-write"],
  });

  if (options.disableWebgl) {
    await context.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
        if (typeof type === "string" && type.toLowerCase().startsWith("webgl")) {
          return null;
        }
        return originalGetContext.call(this, type, ...args);
      };
    });
  }

  const page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
    if (/SVGLoader:\s*createShapes\(\) is deprecated/i.test(text)) {
      foundationDeprecations.push(text);
    }
  });
  await page.goto(`${BASE_URL}/matchmaking`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function apiJson(page, url, init = {}) {
  return page.evaluate(
    async ({ url: requestUrl, init: requestInit }) => {
      const response = await fetch(requestUrl, requestInit);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { url, init },
  );
}

async function createRoom(actor) {
  const response = await apiJson(actor.page, "/api/rooms", { method: "POST" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body?.room?.code ?? "", /^[A-Z0-9]{6}$/);
  return response.body.room;
}

async function joinRoom(actor, code) {
  const response = await apiJson(actor.page, "/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function patchMe(actor, code, body) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function openLobby(actor, code) {
  await actor.page.goto(`${BASE_URL}/lobby/${code}`, { waitUntil: "domcontentloaded" });
  await actor.page.getByRole("heading", { name: "Conselho de operação" }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
}

async function expectOccupied(page, count) {
  await page.getByRole("heading", { name: `${count}/6 postos ocupados` }).waitFor({
    state: "visible",
    timeout: 8_000,
  });
}

function factionInput(page) {
  return page.getByRole("textbox", { name: "Nome da facção", exact: true });
}

async function saveFaction(page, name) {
  const input = factionInput(page);
  await input.fill(name);
  await page.getByRole("button", { name: "Salvar nome da facção", exact: true }).click();
  await page.getByText(name, { exact: true }).first().waitFor({ state: "visible", timeout: 8_000 });
}

function readyButton(page) {
  return page.locator('section[aria-label="Preparação da partida"] button[aria-pressed]');
}

async function setReady(page, value) {
  const button = readyButton(page);
  const current = (await button.getAttribute("aria-pressed")) === "true";
  if (current === value) return;
  await button.click();
  await page.waitForFunction(
    ({ expected }) => {
      const candidate = document.querySelector(
        'section[aria-label="Preparação da partida"] button[aria-pressed]',
      );
      return candidate?.getAttribute("aria-pressed") === String(expected);
    },
    { expected: value },
    { timeout: 8_000 },
  );
}

async function sessionCookie(actor) {
  const cookies = await actor.context.cookies(BASE_URL);
  const cookie = cookies.find((item) => item.name === "war_brasil_player");
  assert.ok(cookie?.value, "cookie war_brasil_player ausente");
  return cookie.value;
}

async function stabilizeVisual(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .wb-code-value {
        font-size: 0 !important;
      }
      .wb-code-value::after {
        content: "ABC123";
        font-size: 1.35rem;
        letter-spacing: .18em;
      }
    `,
  });
}

async function capture(page, name, viewport) {
  await page.setViewportSize(viewport);
  await stabilizeVisual(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}-${viewport.width}x${viewport.height}.png`),
    animations: "disabled",
    fullPage: false,
  });
}

async function captureDesktopMobile(page, name) {
  await capture(page, name, { width: 1440, height: 900 });
  await capture(page, name, { width: 390, height: 844 });
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function waitForText(locator, text) {
  await locator.getByText(text, { exact: false }).waitFor({ state: "visible", timeout: 8_000 });
}

async function roomPlayerNames(db, code) {
  const result = await db.query(
    `SELECT p.faction_name
       FROM game.players p
       JOIN game.rooms r ON r.id = p.room_id
      WHERE r.code = $1
      ORDER BY p.joined_at ASC, p.id ASC`,
    [code],
  );
  return result.rows.map((row) => row.faction_name);
}

async function assertPersistentScene(page, mode, probe = "foundation-persistent-scene") {
  const shell = page.locator(`[data-command-scene-mode="${mode}"]`);
  await shell.waitFor({ state: "attached", timeout: 10_000 });

  const sceneHost = shell.locator("[data-webgl]").first();
  await sceneHost.waitFor({ state: "attached", timeout: 10_000 });

  const canvasCount = await shell.locator("canvas.command-foundation-canvas").count();
  assert.ok(canvasCount <= 1, `mais de um Canvas da Foundation em ${mode}`);

  const marker = await sceneHost.getAttribute("data-foundation-persistence-probe");
  const initialized = await page.evaluate(() =>
    sessionStorage.getItem("foundation-persistence-probe-initialized") === "1",
  );

  if (!initialized) {
    assert.equal(marker, null, "probe de persistência já existia antes da inicialização");
    await sceneHost.evaluate((element, value) => {
      element.setAttribute("data-foundation-persistence-probe", value);
      sessionStorage.setItem("foundation-persistence-probe-initialized", "1");
    }, probe);
    return;
  }

  assert.equal(marker, probe, `host da cena ${mode} foi remontado`);
}

async function roomStartState(db, code) {
  const result = await db.query(
    `SELECT r.status, r.current_match_id, COUNT(m.id)::int AS match_count
       FROM game.rooms r
       LEFT JOIN game.matches m ON m.room_id = r.id
      WHERE r.code = $1
      GROUP BY r.id`,
    [code],
  );
  return result.rows[0];
}

async function waitForStartedRoom(db, code) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const state = await roomStartState(db, code);
    if (state?.status !== "waiting" && state?.current_match_id) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return roomStartState(db, code);
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    await step("FND-02/13 host da cena persiste entre Operations, Lobby, Home, Doctrine e Profile", async () => {
      const actor = await createActor(browser);
      try {
        await assertPersistentScene(actor.page, "operations");

        await actor.page.getByRole("button", { name: "Autorizar nova operação", exact: true }).click();
        await actor.page.waitForURL(/\/lobby\/[A-Z0-9]{6}$/, { timeout: 10_000 });
        await assertPersistentScene(actor.page, "lobby");

        await actor.page.getByRole("link", { name: /Operações/ }).first().click();
        await actor.page.waitForURL(/\/matchmaking$/, { timeout: 10_000 });
        await assertPersistentScene(actor.page, "operations");

        await actor.page.getByRole("link", { name: /Início/ }).first().click();
        await actor.page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
        await assertPersistentScene(actor.page, "entrance");

        await actor.page.getByRole("button", { name: "ENTRAR NO COMANDO", exact: true }).click();
        await actor.page.getByRole("link", { name: /DOUTRINA/ }).click();
        await actor.page.waitForURL(/\/rules(?:\?|$)/, { timeout: 10_000 });
        await assertPersistentScene(actor.page, "doctrine");

        await actor.page.goBack();
        await actor.page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
        await assertPersistentScene(actor.page, "entrance");

        await actor.page.getByRole("button", { name: "ENTRAR NO COMANDO", exact: true }).click();
        await actor.page.getByRole("link", { name: /COMANDO/ }).click();
        await actor.page.waitForURL(/\/profile$/, { timeout: 10_000 });
        await assertPersistentScene(actor.page, "profile");

        await actor.page.getByRole("link", { name: /Início/ }).first().click();
        await actor.page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
        await assertPersistentScene(actor.page, "entrance");
      } finally {
        await actor.context.close();
      }
    });

    await step("LOB-01/02/03/05/06/09 sincronização, regras, reconnect e copy", async () => {
      const host = await createActor(browser);
      const guest = await createActor(browser);
      try {
        const room = await createRoom(host);
        await joinRoom(guest, room.code);
        await openLobby(host, room.code);
        await openLobby(guest, room.code);
        await Promise.all([expectOccupied(host.page, 2), expectOccupied(guest.page, 2)]);

        await saveFaction(host.page, "Comando Verde");
        await saveFaction(guest.page, "Comando Azul");
        await waitForText(host.page.locator('li[data-slot="2"]'), "Comando Azul");

        const guestColor = await guest.page
          .locator('.wb-color-choice[data-selected="true"]')
          .getAttribute("aria-label");
        assert.ok(guestColor, "cor atual do guest não foi exposta");
        const guestColorLabel = guestColor.replace(", selecionado", "");
        const colorOnHost = host.page.getByRole("button", {
          name: `${guestColorLabel}, indisponível`,
          exact: true,
        });
        assert.equal(await colorOnHost.isDisabled(), true, "cor ocupada deveria estar indisponível");

        await setReady(guest.page, true);
        await waitForText(host.page.locator('li[data-slot="2"]'), "Pronto");
        await captureDesktopMobile(host.page, "2-players-one-ready");

        await setReady(guest.page, false);
        await waitForText(host.page.locator('li[data-slot="2"]'), "Configurando");
        await saveFaction(guest.page, "Comando Azul II");
        const guestStation = host.page.locator('li[data-slot="2"]');
        await waitForText(guestStation, "Comando Azul II");

        await setReady(host.page, true);
        await saveFaction(host.page, "Comando Verde II");
        await host.page.waitForFunction(() => {
          const button = document.querySelector(
            'section[aria-label="Preparação da partida"] button[aria-pressed]',
          );
          return button?.getAttribute("aria-pressed") === "false";
        });

        await host.page.getByRole("button", { name: /Copiar código da sala/ }).click();
        await host.page.getByText("Copiado", { exact: true }).waitFor({
          state: "visible",
          timeout: 3_000,
        });

        const roomEndpoint = `${BASE_URL}/api/rooms/${room.code}`;
        await host.page.route(roomEndpoint, (route) => route.abort());
        await factionInput(host.page).fill("Comando Verde Offline");
        await host.page.getByRole("button", { name: "Salvar nome da facção", exact: true }).click();
        await host.page.getByText("Reconectando ao comando", { exact: true }).waitFor({
          state: "visible",
          timeout: 8_000,
        });
        await captureDesktopMobile(host.page, "reconnecting");
        await host.page.unroute(roomEndpoint);

        const synced = host.page.getByText("Sala sincronizada", { exact: true });
        const retry = host.page.getByRole("button", { name: "Sincronizar agora" });
        if (!(await synced.isVisible().catch(() => false)) && await retry.isVisible().catch(() => false)) {
          await retry.click({ timeout: 2_000 }).catch(() => undefined);
        }
        await synced.waitFor({
          state: "visible",
          timeout: 8_000,
        });
        await waitForText(host.page.locator('li[data-slot="1"]'), "Comando Verde Offline");

        const guestSession = await sessionCookie(guest);
        await db.query(
          `DELETE FROM game.players
            WHERE player_session = $1
              AND room_id = (SELECT id FROM game.rooms WHERE code = $2)`,
          [guestSession, room.code],
        );
        await expectOccupied(host.page, 1);
        await waitForText(host.page.locator('li[data-slot="2"]'), "Aguardando jogador");
        await captureDesktopMobile(host.page, "1-player");
      } finally {
        await host.context.close();
        await guest.context.close();
      }
    });

    await step("LOB-07 seis jogadores permanecem representáveis e estáveis", async () => {
      const actors = [];
      try {
        const host = await createActor(browser);
        actors.push(host);
        const room = await createRoom(host);
        await patchMe(host, room.code, { factionName: "Comando 01" });

        for (let index = 2; index <= 6; index += 1) {
          const actor = await createActor(browser);
          actors.push(actor);
          await joinRoom(actor, room.code);
          await patchMe(actor, room.code, { factionName: `Comando ${String(index).padStart(2, "0")}` });
        }

        const expectedSet = Array.from(
          { length: 6 },
          (_, index) => `Comando ${String(index + 1).padStart(2, "0")}`,
        );
        const authoritativeOrder = await roomPlayerNames(db, room.code);
        assert.equal(authoritativeOrder.length, 6, "banco deveria conter seis jogadores");
        assert.deepEqual(
          [...authoritativeOrder].sort(),
          [...expectedSet].sort(),
          "nomes persistidos no banco divergiram dos seis comandos configurados",
        );

        await openLobby(host, room.code);
        const snapshotResponse = await apiJson(host.page, `/api/rooms/${room.code}`);
        assert.equal(snapshotResponse.status, 200, JSON.stringify(snapshotResponse.body));
        assert.deepEqual(
          snapshotResponse.body?.players?.map((player) => player.factionName),
          authoritativeOrder,
          "snapshot da API divergiu da ordem autoritativa da sala",
        );

        await expectOccupied(host.page, 6);
        for (const [index, factionName] of authoritativeOrder.entries()) {
          await waitForText(
            host.page.locator(`li[data-slot="${index + 1}"]`),
            factionName,
          );
        }

        const initialStations = await host.page.locator('li[data-slot]').allTextContents();
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        const stableStations = await host.page.locator('li[data-slot]').allTextContents();
        assert.deepEqual(
          stableStations,
          initialStations,
          "postos mudaram de posição sem alteração de membership",
        );

        await captureDesktopMobile(host.page, "6-players");
      } finally {
        await Promise.all(actors.map((actor) => actor.context.close()));
      }
    });

    await step("LOB-04/11 todos prontos iniciam uma única partida sem espera cerimonial", async () => {
      const host = await createActor(browser);
      const guest = await createActor(browser);
      try {
        const room = await createRoom(host);
        await joinRoom(guest, room.code);
        await patchMe(host, room.code, { factionName: "Start Host" });
        await patchMe(guest, room.code, { factionName: "Start Guest" });
        await openLobby(host, room.code);
        await openLobby(guest, room.code);

        await setReady(host.page, true);
        await waitForText(guest.page.locator('li[data-slot="1"]'), "Pronto");
        await readyButton(guest.page).click();

        const state = await waitForStartedRoom(db, room.code);
        assert.equal(state?.match_count, 1, "mais de uma partida foi criada");
        assert.ok(state?.current_match_id, "current_match_id não foi definido");
        assert.notEqual(state?.status, "waiting", "sala permaneceu waiting após start");

        await Promise.all([
          host.page.waitForURL(/\/game\/\d+$/, { timeout: 15_000, waitUntil: "domcontentloaded" }),
          guest.page.waitForURL(/\/game\/\d+$/, { timeout: 15_000, waitUntil: "domcontentloaded" }),
        ]);

        assert.equal(
          new URL(host.page.url()).pathname,
          new URL(guest.page.url()).pathname,
          "clientes divergiram para partidas diferentes",
        );
      } finally {
        await host.context.close();
        await guest.context.close();
      }
    });

    await step("LOB-10/12 reduced-motion mantém configuração, copy e ready funcionais", async () => {
      const actor = await createActor(browser, { reducedMotion: "reduce" });
      try {
        const room = await createRoom(actor);
        await openLobby(actor, room.code);
        assert.equal(
          await actor.page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
          true,
        );
        await saveFaction(actor.page, "Comando Estavel");
        await actor.page.getByRole("button", { name: /Copiar código da sala/ }).click();
        await setReady(actor.page, true);
        await captureDesktopMobile(actor.page, "reduced-motion");
      } finally {
        await actor.context.close();
      }
    });

    await step("LOB-12 fallback sem WebGL não bloqueia controles", async () => {
      const actor = await createActor(browser, { disableWebgl: true });
      try {
        const room = await createRoom(actor);
        await openLobby(actor, room.code);
        const sceneHost = actor.page.locator('[data-webgl]');
        if ((await sceneHost.count()) > 0) {
          await actor.page.locator('[data-webgl="fallback"]').waitFor({ state: "visible", timeout: 8_000 });
        }
        await saveFaction(actor.page, "Comando Fallback");
        await setReady(actor.page, true);
        await captureDesktopMobile(actor.page, "fallback");
      } finally {
        await actor.context.close();
      }
    });

    await step("LOB-05 estado fatal é textual e recuperável", async () => {
      const actor = await createActor(browser);
      try {
        await actor.page.goto(`${BASE_URL}/lobby/ABCDEF`, { waitUntil: "domcontentloaded" });
        await actor.page.getByRole("heading", { name: "Briefing interrompido" }).waitFor({
          state: "visible",
          timeout: 8_000,
        });
        await actor.page.getByRole("button", { name: "Tentar novamente" }).waitFor({ state: "visible" });
        await captureDesktopMobile(actor.page, "error");
      } finally {
        await actor.context.close();
      }
    });

    await step("LOB-13 ações críticas permanecem dentro da viewport mobile", async () => {
      const actor = await createActor(browser, { viewport: { width: 390, height: 844 } });
      try {
        const room = await createRoom(actor);
        await openLobby(actor, room.code);
        const ready = readyButton(actor.page);
        const box = await ready.boundingBox();
        assert.ok(box, "CTA de ready sem bounding box");
        assert.ok(box.y >= 0, "CTA de ready acima da viewport");
        assert.ok(box.y + box.height <= 844, "CTA de ready abaixo da viewport");
        await factionInput(actor.page).waitFor({ state: "visible" });
        await actor.page.getByRole("button", { name: /Copiar código da sala/ }).waitFor({ state: "visible" });
      } finally {
        await actor.context.close();
      }
    });
  } finally {
    await browser.close();
    await db.end();
  }

  if (foundationDeprecations.length > 0) {
    failures.push({
      name: "Foundation não emite APIs depreciadas no browser",
      error: new Error([...new Set(foundationDeprecations)].join("\n")),
    });
  }

  if (failures.length > 0) {
    console.error("\n[lobby-e2e] falhas:");
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.error?.message ?? failure.error}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\n[lobby-e2e] todos os cenários executados com sucesso.");
  }
}

main().catch((error) => {
  console.error("[lobby-e2e] falha fatal:", error);
  process.exitCode = 1;
});
