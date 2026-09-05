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
  assert.match(runtime, /<TradeResponseModal/);
  assert.match(runtime, /<TradeResolutionModal/);
  assert.match(runtime, /<TradeSignalToast/);
});

test("destinatário recebe oferta aberta em modal de resposta", () => {
  const response = source("src/components/trade/trade-response-modal.tsx");

  assert.match(response, /offer\.status === "open"/);
  assert.match(response, /offer\.targetPlayerId === me\.id/);
  assert.match(response, /cardsMatchingTradeDescriptor/);
  assert.match(response, /eyebrow="Oferta recebida"/);
  assert.match(response, />\s*Aceitar\s*</);
  assert.match(response, />\s*Contraofertar\s*</);
  assert.match(response, />\s*Recusar\s*</);
  assert.match(response, /mode="counter"/);
  assert.doesNotMatch(response, /não possui|nao possui/i);
});

test("contraoferta abre modal para o proponente original sem contra-contraoferta", () => {
  const response = source("src/components/trade/trade-response-modal.tsx");

  assert.match(response, /offer\.status === "countered"/);
  assert.match(response, /offer\.proposerPlayerId === me\.id/);
  assert.match(response, /eyebrow="Contraoferta recebida"/);
  assert.match(response, /action: "acceptCounter"/);
  assert.match(response, /action: "decline"/);
  assert.match(response, /Aceitar contraoferta/);
  assert.match(response, /Contraoferta recebida/);
});

test("painel cobre oferta, contraoferta, aceite e seleção vinculante", () => {
  const panel = source("src/components/trade/trade-phase-panel.tsx");
  const builder = source("src/components/trade/trade-builder-modal.tsx");
  const selection = source("src/components/trade/trade-card-selection-modal.tsx");

  assert.match(builder, /action: "offer"/);
  assert.match(builder, /action: "counter"/);
  assert.match(panel, /action: "accept"/);
  assert.match(panel, /action: "acceptCounter"/);
  assert.match(panel, /action: "decline"/);
  assert.match(panel, /action: "cancel"/);
  assert.match(panel, /action: "finish"/);
  assert.match(selection, /action: "selectCard"/);
  assert.match(selection, /cardsMatchingTradeDescriptor/);
  assert.match(selection, /myPendingSelection/);
  assert.match(selection, /<GameModal[\s\S]*Troca aceita/);
  assert.match(panel, /<TradeCardSelectionModal/);
});

test("oferta mostra só posse própria e pedido continua aberto ao catálogo", () => {
  const builder = source("src/components/trade/trade-builder-modal.tsx");
  const picker = source("src/components/trade/trade-descriptor-picker.tsx");

  assert.match(picker, /mode: "owned" \| "request"/);
  assert.match(builder, /<TradeDescriptorPicker[\s\S]*mode="owned"/);
  assert.match(builder, /<TradeDescriptorPicker[\s\S]*mode="request"/);
  assert.match(picker, /snapshot\.myCards/);
  assert.match(picker, /Object\.keys\(TERRITORY_METADATA\)/);
  assert.match(picker, /Buscar território/);
  assert.match(picker, /Seus territórios/);
  assert.match(picker, /você possui/);
});

test("sinalização fica acessível globalmente a humano fora da vez", () => {
  const mount = source("src/components/trade/trade-phase-mount.tsx");
  const action = source("src/components/trade/trade-signal-action.tsx");

  assert.match(mount, /<TradeSignalAction/);
  assert.match(action, /snapshot\.room\.currentPlayerId !== me\.id/);
  assert.match(action, /!me\.isBot/);
  assert.match(action, /snapshot\.myCards\.length > 0/);
  assert.match(action, /data-trade-signal-action/);
  assert.match(action, /<TradeSignalModal/);
  assert.match(action, /sendTradeSignal/);
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

test("sinal de posse abre modal global e não descarta broadcast por snapshot atrasado", () => {
  const runtime = source("src/components/mandatory-card-trade-modal.tsx");
  const mount = source("src/components/trade/trade-phase-mount.tsx");
  const modal = source("src/components/trade/trade-signal-toast.tsx");

  assert.match(runtime, /<TradeSignalToast/);
  assert.doesNotMatch(mount, /<TradeSignalToast/);
  assert.match(modal, /useRef\(snapshot\.room\.turnNumber\)/);
  assert.match(modal, /nextEvent\.payload\.turnNumber < currentTurnRef\.current/);
  assert.doesNotMatch(modal, /snapshot\.room\.phase !== "trade"/);
  assert.match(modal, /<GameModal/);
  assert.match(modal, /eyebrow="Notificação de posse"/);
  assert.match(modal, /Carta disponível para troca/);
  assert.match(modal, />\s*Entendi\s*</);
  assert.doesNotMatch(modal, /window\.setTimeout/);
  assert.doesNotMatch(modal, /localStorage|sessionStorage|history|indexedDB/);
});

test("recusa gera feedback efêmero em modal para o destinatário correto", () => {
  const sync = source("src/hooks/use-game-sync.ts");
  const bus = source("src/lib/client/game-realtime-ephemeral-bus.ts");
  const modal = source("src/components/trade/trade-resolution-modal.tsx");

  assert.match(sync, /event\.type === "trade\.resolution"/);
  assert.match(sync, /dispatchTradeResolution\(roomId, event\)/);
  assert.match(bus, /subscribeTradeResolution/);
  assert.match(modal, /recipientPlayerId !== meId/);
  assert.match(modal, /Oferta recusada/);
  assert.match(modal, /Contraoferta recusada/);
  assert.match(modal, />\s*Entendi\s*</);
});

test("guia apresenta Troca como primeira etapa do turno", () => {
  const guide = source("src/components/game-guide/sections/guide-turn-section.tsx");

  assert.match(guide, /key: "trade"/);
  assert.match(guide, /label: "Troca"/);
  assert.match(guide, /só aparece quando o jogador da vez possui cartas/);
});
