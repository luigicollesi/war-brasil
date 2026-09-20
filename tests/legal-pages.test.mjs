import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const terms = readFileSync("src/app/terms/page.tsx", "utf8");
const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
const layout = readFileSync(
  "src/components/legal/legal-document.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/components/legal/legal-document.module.css",
  "utf8",
);
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");

test("Termos e Privacidade são documentos públicos navegáveis", () => {
  assert.match(terms, /title: "Termos de Uso"/);
  assert.match(privacy, /title: "Política de Privacidade"/);
  assert.match(proxy, /pathname === "\/terms"/);
  assert.match(proxy, /pathname === "\/privacy"/);
  assert.match(home, /href="\/terms"/);
  assert.match(home, /href="\/privacy"/);
});

test("layout legal é minimalista e não cria cards com borda", () => {
  assert.match(layout, /LegalDocument/);
  assert.match(styles, /\.shell \{/);
  assert.match(styles, /\.section \{/);
  assert.doesNotMatch(
    styles,
    /\.shell\s*\{[^}]*\bborder\s*:/s,
  );
  assert.doesNotMatch(
    styles,
    /\.section\s*\{[^}]*\bborder\s*:/s,
  );
});

test("documentos registram idade mínima e privacidade da data de nascimento", () => {
  assert.match(terms, /10 anos de idade ou mais/);
  assert.match(terms, /idade inferior a 10 anos/);
  assert.match(terms, /declaração deliberadamente falsa de idade/);
  assert.match(privacy, /Data de nascimento/);
  assert.match(privacy, /não é exibida no perfil público/);
  assert.match(privacy, /idade inferior a 10 anos/);
});
