import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("cliente recebe trade sem remapear para cards", () => {
  const hydration = source("src/lib/shared/game-snapshot-hydration.ts");
  const runtime = source("src/components/mandatory-card-trade-modal.tsx");

  assert.doesNotMatch(hydration, /phase:\s*payload\.room\.phase === "trade"/);
  assert.match(runtime, /snapshot\.room\.phase === "trade"/);
  assert.match(runtime, /<TradePhaseMount/);
});

test("painel cobre oferta, contraoferta, aceite e seleção vinculante", () => {
  const panel = source("src/components/trade/trade-phase-panel.tsx");

  assert.match(panel, /action: "offer"/);
  assert.match(panel, /action: "counter"/);
  assert.match(panel, /action: "accept"/);
  assert.match(panel, /action: "acceptCounter"/);
  assert.match(panel, /action: "decline"/);
  assert.match(panel, /action: "cancel"/);
  assert.match(panel, /action: "finish"/);
  assert.match(panel, /action: "selectCard"/);
  assert.match(panel, /cardsMatchingTradeDescriptor/);
  assert.match(panel, /myPendingSelection/);
  assert.match(panel, /<GameModal[\s\S]*Troca aceita/);
});

test("oferta mostra só posse própria e pedido continua aberto ao catálogo", () => {
  const panel = source("src/components/trade/trade-phase-panel.tsx");

  assert.match(panel, /mode: "owned" \| "request"/);
  assert.match(panel, /snapshot\.myCards/);
  assert.match(panel, /Object\.keys\(TERRITORY_METADATA\)/);
  assert.match(panel, /Buscar território/);
  assert.match(panel, /Seus territórios/);
  assert.match(panel, /você possui/);
});

test("sinalização não usa command revisionado nem retry", () => {
  const signalClient = source("src/lib/client/game-trade-client.ts");
  const sync = source("src/hooks/use-game-sync.ts");
  const bus = source("src/lib/client/game-realtime-ephemeral-bus.ts");

  assert.match(signalClient, /\/trade\/signal/);
  assert.doesNotMatch(signalClient, /runGameCommand|commandId|expectedRevision|for \(let attempt/);
  assert.match(sync, /event\.type === "trade\.signal"/);
  assert.match(sync, /dispatchTradeSignal\(roomId, event\)/);
  assert.match(bus, /new Map<string, Set<TradeSignalListener>>/);
  assert.doesNotMatch(bus, /localStorage|sessionStorage|indexedDB|fetch/);
});

test("toast efêmero ignora sinais de outro turno e não cria histórico", () => {
  const toast = source("src/components/trade/trade-signal-toast.tsx");

  assert.match(toast, /nextEvent\.payload\.turnNumber !== snapshot\.room\.turnNumber/);
  assert.match(toast, /snapshot\.room\.phase !== "trade"/);
  assert.match(toast, /window\.setTimeout/);
  assert.doesNotMatch(toast, /localStorage|sessionStorage|history|indexedDB/);
});

test("guia apresenta Troca como primeira etapa do turno", () => {
  const guide = source("src/components/game-guide/sections/guide-turn-section.tsx");

  assert.match(guide, /key: "trade"/);
  assert.match(guide, /label: "Troca"/);
  assert.match(guide, /só aparece quando o jogador da vez possui cartas/);
});
