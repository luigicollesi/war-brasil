import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";

test("guia rápido deriva números das regras reais", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(guide.territoryCount, 42);
  assert.equal(guide.regionCount, 5);
  assert.equal(guide.reinforcement.minimum, 3);
  assert.equal(guide.reinforcement.baseExample, 6);
  assert.equal(guide.attack.barrierMinimumTroops, 4);
  assert.equal(guide.attack.barrierLossPerComparison, 3);
  assert.equal(guide.maneuver.barrierLoss, 1);
  assert.equal(guide.maneuver.blockedBarrierCount, 2);
  assert.equal(guide.cards.firstTradeValue, 4);
});

test("home usa brasão e leva ao Manual de Campo", () => {
  const source = readFileSync("src/app/page.tsx", "utf8");

  assert.match(source, /src="\/icone\.png"/);
  assert.match(source, /loading="eager"/);
  assert.match(source, /href="#manual"/);
  assert.match(source, /<GameQuickGuide \/>/);
});

test("manual cobre o fluxo e os elementos essenciais da partida", () => {
  const source = readFileSync(
    "src/components/game-guide/game-quick-guide.tsx",
    "utf8",
  );

  for (const term of [
    "Prepare o Brasil",
    "Cartas",
    "Reforçar",
    "Atacar",
    "Manobrar",
    "Estradas",
    "Tropas",
    "Anomalia",
    "Barreiras",
    "Coringa",
    "Túnel Jurássico",
    "objetivo secreto",
  ]) {
    assert.match(source, new RegExp(term, "i"));
  }

  assert.match(source, /TerritoryCardArtwork/);
  assert.match(source, /TemporalAnomalyEffectList/);
  assert.match(source, /GameDie/);
  assert.doesNotMatch(source, /<button/);
});

test("manual reutiliza arte e ícones reais em vez de duplicar componentes", () => {
  const utility = readFileSync("src/components/game-utility-bar.tsx", "utf8");
  const cards = readFileSync("src/components/territory-card.tsx", "utf8");
  const battle = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const anomaly = readFileSync("src/components/temporal-anomaly-modal.tsx", "utf8");

  assert.match(utility, /game-utility-icons/);
  assert.doesNotMatch(utility, /function RoadsIcon/);

  assert.match(cards, /TerritoryCardArtwork/);
  assert.doesNotMatch(cards, /card-template\.png/);

  assert.match(battle, /GameDie/);
  assert.doesNotMatch(battle, /pipPositions|function BattleDie/);

  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.doesNotMatch(anomaly, /effectMarker/);
});
