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
  assert.deepEqual(guide.attack.barrierDiceBands, [
    { minimumTroops: 4, maximumTroops: 6, diceCount: 1 },
    { minimumTroops: 7, maximumTroops: 9, diceCount: 2 },
    { minimumTroops: 10, maximumTroops: null, diceCount: 3 },
  ]);
  assert.equal(guide.maneuver.barrierLoss, 1);
  assert.equal(guide.maneuver.barrierMinimumTroops, 2);
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
    "Barreiras Geográficas",
    "Desvantagem Geográfica",
    "Travessia Geográfica",
    "Leia o mapa",
    "Estradas",
    "Tropas",
    "Anomalia",
    "Coringa",
    "Túnel Jurássico",
    "objetivo secreto",
  ]) {
    assert.match(source, new RegExp(term, "i"));
  }

  assert.match(source, /number="03" title="Barreiras Geográficas"/);
  assert.match(source, /number="04" title="Leia o mapa"/);
  assert.match(source, /number="05" title="Use suas cartas"/);
  assert.match(source, /number="06" title="Sobreviva às Anomalias"/);
  assert.match(source, /07 · Vitória/);
  assert.match(source, /caveira-vermelha\.svg/);
  assert.match(source, /alcapao-saida\.svg/);
  assert.match(source, /GeographicBarrierMapExample/);
  assert.match(source, /MapReadingExample/);
  assert.match(source, /TerritoryCardArtwork/);
  assert.match(source, /TemporalAnomalyEffectList/);
  assert.match(source, /GameDie/);
  assert.doesNotMatch(source, /<button/);

  const anomalyStart = source.indexOf(
    'number="06" title="Sobreviva às Anomalias"',
  );
  const anomalyEnd = source.indexOf("07 · Vitória");
  assert.ok(anomalyStart >= 0 && anomalyEnd > anomalyStart);
  assert.doesNotMatch(source.slice(anomalyStart, anomalyEnd), /Túnel Jurássico/);
});

test("exemplo geográfico copia os paths reais do Pará e reutiliza a curva das estradas", () => {
  const source = readFileSync(
    "src/components/game-guide/guide-map-examples.tsx",
    "utf8",
  );

  assert.match(source, /createRoadCurve/);
  assert.match(source, /Pará Oeste/);
  assert.match(source, /Pará Sudeste/);
  assert.match(source, /Pará Atlântico/);
  assert.match(source, /id: 6/);
  assert.match(source, /id: 9/);
  assert.match(source, /id: 11/);

  // Inícios dos mesmos paths presentes em war-brasil-42.production.svg.
  assert.match(source, /M 639\.0 462\.5 L 623\.0 459\.5/);
  assert.match(source, /M 723\.0 467\.5 L 703\.0 466\.5/);
  assert.match(source, /M 784\.0 313\.5 L 779\.0 309\.5/);
  assert.match(source, /GEOGRAPHIC_BARRIER_BOUNDARY/);
  assert.match(source, /wb-guide-map-road-shadow/);
  assert.match(source, /wb-guide-map-road-surface/);
  assert.match(source, /wb-guide-map-road-center/);
  assert.match(source, /Túnel Jurássico/);
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
