import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const generalTest = readFileSync(".github/workflows/test.yml", "utf8");
const cloudflareBuild = readFileSync(".github/workflows/cloudflare-build.yml", "utf8");

test("workflow geral não repete validação específica do OpenNext", () => {
  assert.doesNotMatch(generalTest, /cloudflare:check-next-patch/);
  assert.doesNotMatch(
    generalTest,
    /Validate Cloudflare Next middleware patch compatibility/,
  );
});

test("Cloudflare Build ignora mudanças puramente documentais sem perder execução manual", () => {
  assert.match(
    cloudflareBuild,
    /pull_request:[\s\S]*branches:[\s\S]*- dev[\s\S]*paths-ignore:[\s\S]*- "docs\/\*\*"[\s\S]*- "README\.md"/,
  );
  assert.match(
    cloudflareBuild,
    /push:[\s\S]*branches:[\s\S]*- dev[\s\S]*paths-ignore:[\s\S]*- "docs\/\*\*"[\s\S]*- "README\.md"/,
  );
  assert.match(cloudflareBuild, /workflow_dispatch:/);
});

test("workflows de validação usam GITHUB_TOKEN somente para leitura", () => {
  for (const workflow of [generalTest, cloudflareBuild]) {
    assert.match(workflow, /permissions:\s*\n\s*contents: read/);
    assert.doesNotMatch(workflow, /contents: write|pull-requests: write|deployments: write/);
  }
});

test("Cloudflare Build mantém todos os gates dos Workers e do OpenNext existentes", () => {
  assert.match(cloudflareBuild, /Run Cloudflare deployment contract tests/);
  assert.match(cloudflareBuild, /npm run cloudflare:realtime:build/);
  assert.match(cloudflareBuild, /npm run cloudflare:automation:build/);
  assert.match(cloudflareBuild, /npm run cloudflare:check-next-patch/);
  assert.match(cloudflareBuild, /npm run cloudflare:build/);
});
