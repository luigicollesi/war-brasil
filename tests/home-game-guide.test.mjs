import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";

test("guia rápido deriva números das regras reais", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(guide.territoryCount, 42);
  assert.equal(guide.regionCount, 5);
  assert.deepEqual(guide.regions, [
    { key: "nordeste", label: "Nordeste", territoryCount: 13, bonus: 6 },
    { key: "norte", label: "Norte", territoryCount: 10, bonus: 5 },
    { key: "sudeste", label: "Sudeste", territoryCount: 8, bonus: 4 },
    { key: "centro-oeste", label: "Centro-Oeste", territoryCount: 5, bonus: 4 },
    { key: "sul", label: "Sul", territoryCount: 6, bonus: 2 },
  ]);
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

test("manual compõe as quatro etapas iniciais e preserva as regras existentes", () => {
  const main = readFileSync(
    "src/components/game-guide/game-quick-guide.tsx",
    "utf8",
  );
  const setup = readFileSync(
    "src/components/game-guide/sections/guide-setup-section.tsx",
    "utf8",
  );
  const order = readFileSync(
    "src/components/game-guide/sections/guide-order-section.tsx",
    "utf8",
  );
  const objective = readFileSync(
    "src/components/game-guide/sections/guide-objective-section.tsx",
    "utf8",
  );
  const turn = readFileSync(
    "src/components/game-guide/sections/guide-turn-section.tsx",
    "utf8",
  );
  const source = [main, setup, order, objective, turn].join("\n");

  for (const term of [
    "Prepare o Brasil",
    "Defina a ordem",
    "Leia sua missão",
    "Siga seu turno",
    "Cartas",
    "Reforços",
    "Ataques",
    "Manobra",
    "Domínio regional",
    "Leitura estratégica",
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

  assert.match(main, /<GuideSetupSection guide=\{guide\} \/>/);
  assert.match(main, /<GuideOrderSection \/>/);
  assert.match(main, /<GuideObjectiveSection \/>/);
  assert.match(main, /<GuideTurnSection guide=\{guide\} \/>/);

  assert.match(setup, /number="01" title="Prepare o Brasil"/);
  assert.match(order, /number="02" title="Defina a ordem"/);
  assert.match(objective, /number="03" title="Leia sua missão"/);
  assert.match(turn, /number="04" title="Siga seu turno"/);
  assert.match(main, /number="05" title="Barreiras Geográficas"/);
  assert.match(main, /number="06" title="Leia o mapa"/);
  assert.match(main, /number="07" title="Use suas cartas"/);
  assert.match(main, /number="08" title="Sobreviva às Anomalias"/);
  assert.match(main, /09 · Vitória/);

  assert.match(turn, /guide\.regions\.map/);
  assert.match(turn, /regionalStrategy\[region\.key\]/);
  assert.match(turn, /poucos pontos de entrada/);
  assert.match(turn, /quantidade de pontos de entrada/);
  assert.match(turn, /O bônus é adicional ao reforço normal/);
  assert.match(turn, /O tamanho não é o único fator/);

  assert.match(main, /caveira-vermelha\.svg/);
  assert.match(main, /alcapao-saida\.svg/);
  assert.match(main, /GeographicBarrierMapExample/);
  assert.match(main, /MapReadingExample/);
  assert.match(main, /TerritoryCardArtwork/);
  assert.match(main, /TemporalAnomalyEffectList/);
  assert.match(main, /GameDie/);
  assert.doesNotMatch(source, /<button/);

  const anomalyStart = main.indexOf(
    'number="08" title="Sobreviva às Anomalias"',
  );
  const anomalyEnd = main.indexOf("09 · Vitória");
  assert.ok(anomalyStart >= 0 && anomalyEnd > anomalyStart);
  assert.doesNotMatch(main.slice(anomalyStart, anomalyEnd), /Túnel Jurássico/);
});

test("quatro etapas iniciais usam auxílio visual com função educativa", () => {
  const setup = readFileSync(
    "src/components/game-guide/sections/guide-setup-section.tsx",
    "utf8",
  );
  const order = readFileSync(
    "src/components/game-guide/sections/guide-order-section.tsx",
    "utf8",
  );
  const objective = readFileSync(
    "src/components/game-guide/sections/guide-objective-section.tsx",
    "utf8",
  );
  const turn = readFileSync(
    "src/components/game-guide/sections/guide-turn-section.tsx",
    "utf8",
  );
  const styles = readFileSync("src/app/war-guide-sections.css", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");

  assert.match(setup, /war-brasil-42\.production\.svg/);
  assert.match(setup, /GuideFlow/);
  assert.match(setup, /Preparação dos territórios/);
  assert.match(setup, /distribuídos/);

  assert.match(order, /GameDie/);
  assert.match(order, /GuideFlow/);
  assert.match(order, /Turno\./);
  assert.match(order, /Rodada\./);
  assert.match(order, /empatados/);

  assert.match(objective, /objectiveFamilies/);
  assert.match(objective, /Domínio/);
  assert.match(objective, /Expansão/);
  assert.match(objective, /Fortificação/);
  assert.match(objective, /Eliminação/);
  assert.match(objective, /condição alternativa/);

  assert.match(turn, /GuideFlow/);
  assert.ok(turn.indexOf('key: "cards"') < turn.indexOf('key: "reinforcement"'));
  assert.ok(turn.indexOf('key: "reinforcement"') < turn.indexOf('key: "attack"'));
  assert.ok(turn.indexOf('key: "attack"') < turn.indexOf('key: "maneuver"'));
  assert.match(turn, /wb-guide-turn-reference/);

  for (const selector of [
    "wb-guide-setup-stage",
    "wb-guide-order-dice",
    "wb-guide-mission-card",
    "wb-guide-main-turn-flow",
    "wb-guide-turn-reference",
  ]) {
    assert.match(styles, new RegExp(`\\.${selector}`));
  }

  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.wb-guide-mission-families \{\s*grid-template-columns: 1fr;/);
  assert.match(layout, /import "\.\/war-guide-sections\.css";/);
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

test("primitivas visuais do manual têm contratos semânticos e responsivos", () => {
  const flow = readFileSync("src/components/game-guide/guide-flow.tsx", "utf8");
  const scale = readFileSync("src/components/game-guide/guide-rule-scale.tsx", "utf8");
  const stateChange = readFileSync(
    "src/components/game-guide/guide-state-change.tsx",
    "utf8",
  );
  const territory = readFileSync(
    "src/components/game-guide/guide-territory-node.tsx",
    "utf8",
  );
  const connection = readFileSync(
    "src/components/game-guide/guide-connection.tsx",
    "utf8",
  );
  const dice = readFileSync(
    "src/components/game-guide/guide-dice-comparison.tsx",
    "utf8",
  );
  const styles = readFileSync("src/app/war-guide-primitives.css", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");

  assert.match(flow, /<ol/);
  assert.match(flow, /aria-label=\{ariaLabel\}/);
  assert.match(flow, /--wb-guide-flow-count/);

  assert.match(scale, /<dl/);
  assert.match(scale, /<dt>/);
  assert.match(scale, /<dd>/);

  assert.match(stateChange, /<figure/);
  assert.match(stateChange, /Antes/);
  assert.match(stateChange, /Depois/);
  assert.match(stateChange, /<figcaption>/);

  assert.match(territory, /Math\.min\(safeTroops, 5\)/);
  assert.match(territory, /aria-label=\{`\$\{name\}: \$\{troopLabel\(safeTroops\)\}`\}/);
  assert.match(territory, /data-tone=\{tone\}/);

  for (const variant of ["normal", "barrier", "tunnel", "blocked"]) {
    assert.match(connection, new RegExp(`"${variant}"|${variant}:`));
  }
  assert.match(connection, /role="img"/);
  assert.match(connection, /aria-label=\{ariaLabel\}/);

  assert.match(dice, /GameDie/);
  assert.match(dice, /attackColor = "ruby"/);
  assert.match(dice, /defenseColor = "ocean"/);
  assert.match(dice, /Sem comparação/);
  assert.doesNotMatch(dice, /pipPositions|dado-brasil-hq\.svg/);

  for (const selector of [
    "wb-guide-flow",
    "wb-guide-rule-scale",
    "wb-guide-state-change",
    "wb-guide-territory",
    "wb-guide-connection",
    "wb-guide-dice-comparison",
  ]) {
    assert.match(styles, new RegExp(`\\.${selector}`));
  }

  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.wb-guide-flow \{\s*grid-template-columns: 1fr;/);
  assert.match(styles, /\.wb-guide-state-change \{\s*grid-template-columns: 1fr;/);
  assert.match(layout, /import "\.\/war-guide-primitives\.css";/);

  for (const source of [flow, scale, stateChange, territory, connection, dice]) {
    assert.doesNotMatch(
      source,
      /game-rules|game-barrier-rules|reinforcementBase|attackProfile|tradeValue|resolveBattle/,
    );
  }
});
