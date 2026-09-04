import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("oferta e contraoferta usam descritores públicos e alvo obrigatório", () => {
  const service = source("src/lib/server/game-player-trade-service.ts");
  const migration = source(
    "src/lib/db/migrations/022-complete-player-trade-negotiation.sql",
  );

  assert.match(service, /isTradeCardDescriptor\(input\.offered\)/);
  assert.match(service, /isTradeCardDescriptor\(input\.requested\)/);
  assert.match(service, /numericId\(input\.targetPlayerId, "Jogador alvo"\)/);
  assert.doesNotMatch(service, /input\.offeredCardId/);
  assert.match(service, /counter_offered_kind/);
  assert.match(service, /counter_requested_kind/);
  assert.match(migration, /ALTER COLUMN target_player_id SET NOT NULL/);
  assert.match(migration, /DROP COLUMN IF EXISTS offered_card_id/);
  assert.match(migration, /DROP COLUMN IF EXISTS counter_card_id/);
  assert.match(migration, /DROP COLUMN IF EXISTS accepted_card_id/);
});

test("aceite resolve carta concreta somente depois dos termos serem aceitos", () => {
  const service = source("src/lib/server/game-player-trade-service.ts");

  assert.match(service, /accepted_pending_selection/);
  assert.match(
    service,
    /descriptor\.kind === "symbol" && matches\.length > 1[\s\S]*return null/,
  );
  assert.match(service, /case "selectCard":/);
  assert.match(service, /proposer_selected_card_id/);
  assert.match(service, /responder_selected_card_id/);
  assert.match(service, /A carta selecionada não corresponde ao símbolo negociado/);
});

test("troca concluída permanece em trade até resolver a terceira oferta", () => {
  const service = source("src/lib/server/game-player-trade-service.ts");

  assert.match(service, /trade_offers_used < PLAYER_TRADE_OFFER_LIMIT/);
  assert.match(
    service,
    /if \(current\.trade_offers_used < PLAYER_TRADE_OFFER_LIMIT\) return false;[\s\S]*beginReinforcementForPlayer/,
  );
  assert.match(service, /const advanced = await finishIfOfferBudgetEnded/);

  const acceptStart = service.indexOf("async function acceptOffer");
  const counterStart = service.indexOf("async function counterOffer");
  const acceptBody = service.slice(acceptStart, counterStart);
  assert.doesNotMatch(acceptBody, /beginReinforcementForPlayer/);
});

test("finishTrade não abandona negociação pendente", () => {
  const service = source("src/lib/server/game-player-trade-service.ts");
  const command = source("src/lib/server/game-command-service.ts");

  assert.match(
    service,
    /if \(await activeOffer\(client, room\.id\)\)[\s\S]*Resolva ou cancele a negociação pendente/,
  );
  assert.match(
    command,
    /executePlayerTradeAction\(client, roomId, player\.id, \{ action: "finish" \}\)/,
  );
});

test("sinalização aceita território, símbolo ou coringa sem persistir conteúdo", () => {
  const service = source("src/lib/server/game-player-trade-service.ts");
  const publisher = source("src/lib/server/game-realtime-publisher.ts");

  const signalStart = service.indexOf("export async function signalPlayerTradeCard");
  const signalBody = service.slice(signalStart);
  const publishStart = publisher.indexOf("export async function publishGameTradeSignal");
  const publishEnd = publisher.indexOf("export async function publishGameChange");
  const signalPublisher = publisher.slice(publishStart, publishEnd);

  assert.match(signalBody, /isTradeCardDescriptor\(input\.card\)/);
  assert.match(signalBody, /requireDescriptorAvailable/);
  assert.doesNotMatch(signalBody, /activeOwnsTerritory/);
  assert.doesNotMatch(signalBody, /Apenas cartas de território podem ser sinalizadas/);
  assert.match(signalBody, /trade_signals_used=\$3/);
  assert.match(signalPublisher, /eventType: "trade\.signal"/);
  assert.doesNotMatch(signalPublisher, /revision:/);
});

test("endpoint de sinal não consome cota quando realtime está desativado", () => {
  const route = source("src/app/api/games/[roomId]/trade/signal/route.ts");
  const publisher = source("src/lib/server/game-realtime-publisher.ts");

  assert.match(route, /GAME_REALTIME_ENABLED !== "true"/);
  assert.match(route, /canal realtime não está ativo/);
  assert.match(publisher, /if \(!gameRealtimeEnabled\(\)\) return false/);
});

test("recusa publica resultado efêmero sem gravar novo histórico", () => {
  const route = source("src/app/api/games/[roomId]/trade/route.ts");
  const notifier = source("src/lib/server/game-trade-resolution-notifier.ts");
  const publisher = source("src/lib/server/game-realtime-publisher.ts");

  assert.match(route, /body\.action === "decline"/);
  assert.match(route, /publishTradeDeclineResolution/);
  assert.match(notifier, /o\.status='declined'/);
  assert.match(notifier, /outcome: "declined"/);
  assert.match(notifier, /outcome: "counter_declined"/);
  assert.match(publisher, /eventType: "trade\.resolution"/);
  assert.doesNotMatch(notifier, /INSERT INTO|UPDATE game_player_trade_offers/);
});

test("snapshot revela termos públicos e apenas a própria seleção pendente", () => {
  const contract = source("src/lib/shared/game-contract.ts");
  const snapshot = source("src/lib/server/game-snapshot-service.ts");

  assert.match(contract, /original: GameTradeTerms/);
  assert.match(contract, /terms: GameTradeTerms/);
  assert.match(contract, /myPendingSelection/);
  assert.match(snapshot, /pendingTradeSelection\(tradeOffer, me\.id\)/);
  assert.match(snapshot, /accepted_pending_selection/);
  assert.doesNotMatch(contract, /proposerSelectedCardId|responderSelectedCardId/);
});
