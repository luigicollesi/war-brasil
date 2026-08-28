import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("modal recebe modelo de apresentação e não interpreta efeitos mecânicos", () => {
  const source = readFileSync(
    "src/components/temporal-anomaly-modal.tsx",
    "utf8",
  );

  assert.match(source, /TemporalAnomalyPresentation/);
  assert.match(source, /GameModal/);
  assert.doesNotMatch(
    source,
    /ADD_TROOPS|REMOVE_TROOPS|BLOCK_ATTACK|OPEN_CONNECTIONS|BLOCK_CONNECTIONS|RANDOM_/,
  );
});

test("controller visual deriva abertura pela chave atual sem setState em effect", () => {
  const source = readFileSync("src/hooks/use-temporal-anomaly.ts", "utf8");

  assert.match(source, /presentation\.key/);
  assert.match(source, /dismissedKey/);
  assert.match(source, /dismissedKey !== activeKey/);
  assert.match(source, /setDismissedKey\(activeKey\)/);
  assert.match(source, /setDismissedKey\(null\)/);
  assert.doesNotMatch(source, /useEffect|lastPresentedKey|setOpenKey/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
});

test("cliente oferece reabertura persistente e monta modal controlado", () => {
  const source = readFileSync("src/components/game-client-v2.tsx", "utf8");

  assert.match(source, /useTemporalAnomaly\(snapshot\)/);
  assert.match(source, />\s*Anomalia Temporal\s*</);
  assert.match(source, /onClick=\{anomaly\.open\}/);
  assert.match(source, /anomaly\.isOpen/);
  assert.match(source, /TemporalAnomalyModal/);
});

test("snapshot usa read model do evento com catálogo e falha rápido em playing sem evento", () => {
  const source = readFileSync("src/lib/game-snapshot-service.ts", "utf8");
  const repository = readFileSync("src/lib/events/event-repository.ts", "utf8");

  assert.match(source, /getRoomRoundEventDetails/);
  assert.match(source, /room\.status === "playing" && !roundEvent/);
  assert.match(source, /name: roundEvent\.name/);
  assert.match(source, /description: roundEvent\.description/);
  assert.match(source, /appliedTroopChanges: roundEvent\.appliedTroopChanges/);
  assert.match(repository, /JOIN events e ON e\.id=gre\.event_id/);
});

test("resultado factual é persistido sem alterar resolved_effects", () => {
  const migration = readFileSync(
    "src/lib/db/migrations/009-event-presentation-outcomes.sql",
    "utf8",
  );
  const roundService = readFileSync("src/lib/game-round-service.ts", "utf8");
  const effectsService = readFileSync(
    "src/lib/events/event-effects-service.ts",
    "utf8",
  );

  assert.match(migration, /applied_troop_changes JSONB/);
  assert.match(migration, /jsonb_typeof\(applied_troop_changes\) = 'array'/);
  assert.match(roundService, /recordRoundEvent[\s\S]*applyPermanentEventEffectsWithChanges/);
  assert.match(roundService, /setRoundEventAppliedTroopChanges/);
  assert.match(effectsService, /beforeTroops/);
  assert.match(effectsService, /afterTroops/);
  assert.match(effectsService, /delta: after\.troops - before\.troops/);
});
