import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const EVIDENCE_DIR = process.env.DOCTRINE_EVIDENCE_DIR ?? "test-results/doctrine-evidence";

const CHAPTERS = [
  "preparacao",
  "objetivos",
  "turno",
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

test("todos os capítulos abrem diretamente no DOM", async ({ page }) => {
  for (const slug of CHAPTERS) {
    await page.goto(chapterUrl(slug), { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-doctrine-chapter="${slug}"]`)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();
    await expect(page.locator("#chapter-title")).not.toBeEmpty();
  }
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

test("mobile 390x844 aceita touch e não cria overflow horizontal da viewport", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  await page.goto(chapterUrl("preparacao"), { waitUntil: "domcontentloaded" });
  await chapterLink(page, "ataque").tap();
  await expect(page.locator('[data-doctrine-chapter="ataque"]')).toBeVisible();

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

test("reduced-motion mantém conteúdo e reduz transições ornamentais", async ({ page }) => {
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
  await expect(page.getByRole("figure")).toBeVisible();
});

test("deep-link continua ensinando com JavaScript desabilitado", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(chapterUrl("ataque"), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-doctrine-chapter="ataque"]')).toBeVisible();
  await expect(page.locator("#chapter-title")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Capítulos da Doutrina" })).toBeVisible();

  await context.close();
});

test("captura evidência visual determinística desktop e mobile", async ({ browser }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  for (const viewport of [
    { name: "desktop-1440x900", width: 1440, height: 900 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
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
