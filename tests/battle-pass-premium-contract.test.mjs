import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Campanha ativa compra Elite exclusivamente pelo pipeline de purchase da Economy V2", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );
  const snapshot = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );

  assert.match(page, /purchaseShowcaseOffer/);
  assert.match(page, /expectedPrice: snapshot\.premium\.price/);
  assert.match(page, /:\s*"ATIVAR"\}/);
  assert.match(page, /CONFIRMAR · 3\.000 CR/);
  assert.doesNotMatch(page, /Ative a trilha paga sem perder o progresso/);
  assert.match(snapshot, /entitlement_kind='battle_pass_access'/);
  assert.match(snapshot, /catalog\.battle_pass_pricing/);
  assert.doesNotMatch(page, /UPDATE\s+economy\.wallets|economy\.ledger_entries/);
});

test("entitlement de Passe registra acesso com receipt de compra", () => {
  const repository = read(
    "src/lib/server/economy/entitlement-repository.ts",
  );

  assert.match(repository, /INSERT INTO progression\.battle_pass_access/);
  assert.match(repository, /purchase_id,access_source/);
  assert.match(repository, /'purchase'/);
  assert.match(repository, /battle_pass_season_id/);
});


test("ativação Elite exige confirmação explícita com saldo, preço e retroativos", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );
  const snapshot = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );

  assert.match(page, /premiumConfirmationOpen/);
  assert.match(page, /:\s*"ATIVAR"\}/);
  assert.match(page, /SALDO ATUAL/);
  assert.match(page, /PREÇO/);
  assert.match(page, /APÓS A COMPRA/);
  assert.match(page, /LIBERAÇÃO IMEDIATA/);
  assert.match(page, /CONFIRMAR · 3\.000 CR/);
  assert.match(page, /CANCELAR/);
  assert.match(snapshot, /reward\.state === "premium_locked"/);
  assert.match(snapshot, /retroactiveClaimableCount/);
});
