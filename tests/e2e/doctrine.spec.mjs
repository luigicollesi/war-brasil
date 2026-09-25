import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const EVIDENCE_DIR = process.env.DOCTRINE_EVIDENCE_DIR ?? "test-results/doctrine-evidence";
const AUTH_STORAGE_STATE = process.env.DOCTRINE_AUTH_STORAGE_STATE;

if (!AUTH_STORAGE_STATE) {
  throw new Error("DOCTRINE_AUTH_STORAGE_STATE é obrigatório para o Doctrine E2E autenticado.");
}

test.use({ storageState: AUTH_STORAGE_STATE });

const CHAPTERS = [
  "preparacao",
  "objetivos",
  "turno",
  "trocas",
  "reforcos",
  "ataque",
  "conquista",
  "movimentacao",
  "barreiras-conexoes",
  "cartas",
  "anomalias",
  "vitoria",
];

const VISUAL_CHAPTERS = [
  "preparacao",
  "objetivos",
  "trocas",
  "ataque",
  "cartas",
  "barreiras-conexoes",
];

function chapterUrl(slug) {
  return `${BASE_URL}/rules?chapter=${slug}`;
}

function chapterLink(page, slug) {
  return page.locator(
    `nav[aria-label="Capítulos da Doutrina"] a[href="/rules?chapter=${slug}"]`,
  );
}

function doctrineIndex(page) {
  return page.locator('aside[aria-labelledby="doctrine-index-title"]');
}

test("todos os capítulos abrem diretamente no DOM", async ({ page }) => {
  for (const slug of CHAPTERS) {
    await page.goto(chapterUrl(slug), { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-doctrine-chapter="${slug}"]`)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();
    await expect(page.locator("#chapter-title")).not.toBeEmpty();
  }
});

test("Trocas precede Reforços e explica negociação sem confundir com resgate", async ({ page }) => {
  await page.goto(chapterUrl("turno"), { waitUntil: "domcontentloaded" });
  const phases = await page.locator('dl[aria-label^="Dados-chave"] dd').allTextContents();
  expect(phases).toEqual(["Trocas", "Reforços", "Ataque", "Manobra"]);

  await chapterLink(page, "trocas").click();
  await expect(page.locator('[data-doctrine-chapter="trocas"]')).toBeVisible();
  await expect(page.getByText("NEGOCIAÇÃO ≠ RESGATE")).toBeVisible();
  await expect(page.getByText(/Negociação não gera tropas/i)).toBeVisible();
  await expect(
    page.getByRole("figure", { name: "Demonstração da fase de Trocas entre jogadores" }),
  ).toBeVisible();
});

test("navegação por teclado preserva foco, posição e histórico", async ({ page }) => {
  await page.goto(chapterUrl("preparacao"), { waitUntil: "domcontentloaded" });

  const target = chapterLink(page, "objetivos");
  await target.focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await page.keyboard.press("Enter");
  await expect(page.locator('[data-doctrine-chapter="objetivos"]')).toBeVisible();
  await expect(target).toBeFocused();

  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(1);
  expect(new URL(page.url()).searchParams.get("chapter")).toBe("objetivos");

  await page.goBack();
  await expect(page.locator('[data-doctrine-chapter="preparacao"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get("chapter")).toBe("preparacao");

  await page.goForward();
  await expect(page.locator('[data-doctrine-chapter="objetivos"]')).toBeVisible();
});

test("índice desktop permanece fixado à esquerda durante toda a leitura", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(chapterUrl("trocas"), { waitUntil: "domcontentloaded" });

  const index = doctrineIndex(page);
  await expect(index).toBeVisible();
  expect(await index.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");

  const before = await index.boundingBox();
  expect(before).not.toBeNull();
  expect(before.x).toBeGreaterThanOrEqual(-1);
  expect(before.x).toBeLessThanOrEqual(1);

  await page.evaluate(() => {
    window.scrollTo(0, Math.min(650, document.documentElement.scrollHeight - window.innerHeight));
  });
  await expect(index).toBeVisible();

  const after = await index.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(after.y).toBeGreaterThanOrEqual(0);
  expect(after.y + after.height).toBeLessThanOrEqual(901);

  const content = page.locator('[aria-labelledby="chapter-title"]');
  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(contentBox.x).toBeGreaterThanOrEqual(before.x + before.width - 1);

  const active = chapterLink(page, "trocas");
  await expect(active).toHaveAttribute("aria-current", "location");
});

test("botão Voltar permanece disponível no índice e retorna ao comando", async ({ page }) => {
  await page.goto(chapterUrl("trocas"), { waitUntil: "domcontentloaded" });

  const back = page.getByRole("link", { name: "Voltar ao comando" });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/home");

  await back.click();
  await page.waitForURL(`${BASE_URL}/home`);
  expect(new URL(page.url()).pathname).toBe("/home");
});

test("mobile 390x844 mantém navegador e ações fixos no rodapé sem overflow horizontal", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  await page.goto(chapterUrl("preparacao"), { waitUntil: "domcontentloaded" });
  const index = doctrineIndex(page);
  await expect(index).toBeVisible();
  expect(await index.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");

  const before = await index.boundingBox();
  expect(before).not.toBeNull();
  expect(before.y).toBeGreaterThan(700);
  expect(before.y + before.height).toBeLessThanOrEqual(845);

  const actions = page.getByRole("navigation", {
    name: "Navegação entre capítulos",
  });
  await expect(actions).toBeVisible();
  expect(await actions.evaluate((element) => getComputedStyle(element).position)).toBe(
    "fixed",
  );
  const actionsBox = await actions.boundingBox();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(before.y + 1);

  await expect(page.getByRole("link", { name: "Ir ao comando" })).toBeVisible();

  await chapterLink(page, "ataque").tap();
  await expect(page.locator('[data-doctrine-chapter="ataque"]')).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();

  const after = await index.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(after.x).toBeGreaterThanOrEqual(-1);
  expect(after.x + after.width).toBeLessThanOrEqual(391);

  const reflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(reflow.clientWidth).toBe(390);
  expect(reflow.viewportWidth).toBe(390);
  expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);

  const chapterRect = await page.locator('[aria-labelledby="chapter-title"]').boundingBox();
  expect(chapterRect).not.toBeNull();
  expect(chapterRect.x).toBeGreaterThanOrEqual(-1);
  expect(chapterRect.x + chapterRect.width).toBeLessThanOrEqual(391);

  await context.close();
});

test("reduced-motion mantém conteúdo e remove a transição de capítulo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(chapterUrl("cartas"), { waitUntil: "domcontentloaded" });

  await expect(page.locator('[data-doctrine-chapter="cartas"]')).toBeVisible();
  await expect(page.getByRole("figure")).toBeVisible();

  const maxTransitionMs = await chapterLink(page, "ataque").evaluate((element) => {
    const durations = getComputedStyle(element).transitionDuration
      .split(",")
      .map((duration) => duration.trim())
      .map((duration) =>
        duration.endsWith("ms")
          ? Number.parseFloat(duration)
          : Number.parseFloat(duration) * 1000,
      );

    return Math.max(...durations);
  });

  expect(maxTransitionMs).toBeLessThanOrEqual(0.01);

  const viewTransitionName = await page
    .locator('[aria-labelledby="chapter-title"] > div')
    .first()
    .evaluate((element) => getComputedStyle(element).viewTransitionName);
  expect(viewTransitionName).toBe("none");

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await chapterLink(page, "trocas").click();
  await expect(page.locator('[data-doctrine-chapter="trocas"]')).toBeVisible();
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(1);
});

test("conteúdo essencial permanece disponível quando WebGL falha", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        return null;
      }
      return originalGetContext.call(this, type, ...args);
    };
  });

  await page.goto(chapterUrl("barreiras-conexoes"), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-doctrine-chapter="barreiras-conexoes"]')).toBeVisible();
  await expect(page.locator("#chapter-title")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();
  await expect(
    page.getByRole("figure", {
      name: "Demonstração do efeito de uma barreira em uma conexão",
    }),
  ).toBeVisible();
});

test("deep-link continua ensinando com JavaScript desabilitado", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();

  await page.goto(chapterUrl("trocas"), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-doctrine-chapter="trocas"]')).toBeVisible();
  await expect(page.locator("#chapter-title")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao comando" })).toBeVisible();
  await expect(page.getByText("NEGOCIAÇÃO ≠ RESGATE")).toBeVisible();

  await context.close();
});

test("captura evidência visual determinística desktop e mobile", async ({ browser }) => {
  test.setTimeout(90_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  for (const viewport of [
    { name: "desktop-1440x900", width: 1440, height: 900 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_STATE,
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      hasTouch: viewport.width <= 390,
      isMobile: viewport.width <= 390,
    });
    const page = await context.newPage();

    for (const slug of VISUAL_CHAPTERS) {
      await page.goto(chapterUrl(slug), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(`[data-doctrine-chapter="${slug}"]`)).toBeVisible();
      await page.screenshot({
        path: `${EVIDENCE_DIR}/${viewport.name}-${slug}.png`,
        fullPage: false,
        animations: "disabled",
      });
    }

    await context.close();
  }
});