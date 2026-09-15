import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 exposes three route-backed private surfaces", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");

  assert.match(shell, /href="\/profile"/);
  assert.match(shell, /href="\/profile\/arsenal"/);
  assert.match(shell, /href="\/profile\/store"/);
  assert.match(shell, /aria-current=/);
});

test("PROFILE V4 wallet uses the canonical local coin asset", async () => {
  const shell = await source("src/components/profile/v4/profile-shell.tsx");

  assert.match(shell, /src="\/coin\.svg"/);
  assert.doesNotMatch(shell, /ASSET_STORAGE_URL/);
  assert.doesNotMatch(shell, />◈</);
});

test("PROFILE V4 no longer renders the V3 command table on the private dossier", async () => {
  const page = await source("src/app/profile/page.tsx");
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.doesNotMatch(page, /ProfileCommandHub/);
  assert.doesNotMatch(dossier, /Mesa de Comando Pessoal/);
  assert.doesNotMatch(dossier, /Identidade em foco/);
});

test("PROFILE V4 keeps dossier identity image-free", async () => {
  const dossier = await source("src/components/profile/v4/profile-dossier.tsx");

  assert.doesNotMatch(dossier, /<Image\b/);
  assert.doesNotMatch(dossier, /<img\b/);
  assert.doesNotMatch(dossier, /session\.user\.image/);
  assert.match(dossier, /Ajustar Dossiê/i);
});
