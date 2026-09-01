import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

const sectionFiles = [
  ["01", "Prepare o Brasil", "guide-setup-section.tsx"],
  ["02", "Defina a ordem", "guide-order-section.tsx"],
  ["03", "Leia seu objetivo", "guide-objective-section.tsx"],
  ["04", "Siga seu turno", "guide-turn-section.tsx"],
  ["05", "Reforce seus territórios", "guide-reinforcement-section.tsx"],
  ["06", "Escolha seu ataque", "guide-attack-section.tsx"],
  ["07", "Role os dados", "guide-combat-section.tsx"],
  ["08", "Cruze Barreiras", "guide-barrier-section.tsx"],
  ["09", "Tome o território", "guide-conquest-section.tsx"],
  ["10", "Elimine jogadores", "guide-elimination-section.tsx"],
  ["11", "Transforme cartas em tropas", "guide-cards-section.tsx"],
  ["12", "Reposicione suas tropas", "guide-maneuver-section.tsx"],
  ["13", "Leia o mapa", "guide-map-section.tsx"],
  ["14", "Adapte-se às Anomalias", "guide-anomaly-section.tsx"],
];

test("apresentação do manual expõe os dados necessários sem regra visual paralela", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(guide.territoryCount, 42);
  assert.equal(guide.regionCount, 5);
  assert.equal(guide.setup.initialTroopsPerTerritory, 1);
  assert.equal(guide.regions.length, 5);
  assert.equal(guide.attack.normalDiceBands.length, 3);
  assert.equal(guide.attack.barrierDiceBands.length, 3);
  assert.equal(guide.defense.diceBands.length, 3);
  assert.equal(guide.cards.tradeValues.length, 6);
  assert.ok(guide.maneuver.example.movableBeforeReceiving > guide.maneuver.example.movableAfterReceiving);
});

test("home usa brasão e leva ao Manual de Campo", () => {
  const page = source("src/app/page.tsx");
  assert.match(page, /src="\/icone\.png"/);
  assert.match(page, /href="#manual"/);
  assert.match(page, /<GameQuickGuide \/>/);
});

test("GameQuickGuide orquestra as quinze seções na ordem planejada", () => {
  const main = source("src/components/game-guide/game-quick-guide.tsx");
  const expected = [
    "<GuideSetupSection guide={guide} />",
    "<GuideOrderSection />",
    "<GuideObjectiveSection />",
    "<GuideTurnSection />",
    "<GuideReinforcementSection guide={guide} />",
    "<GuideAttackSection guide={guide} />",
    "<GuideCombatSection guide={guide} />",
    "<GuideBarrierSection guide={guide} />",
    "<GuideConquestSection guide={guide} />",
    "<GuideEliminationSection />",
    "<GuideCardsSection guide={guide} />",
    "<GuideManeuverSection guide={guide} />",
    "<GuideMapSection />",
    "<GuideAnomalySection guide={guide} />",
    "<GuideVictorySection />",
  ];

  let previous = -1;
  for (const marker of expected) {
    const index = main.indexOf(marker);
    assert.ok(index > previous, `${marker} precisa manter a ordem do fluxo`);
    previous = index;
  }

  assert.doesNotMatch(main, /GuideHeading|MapReadingExample|TerritoryCardArtwork|GameDie/);
});

test("seções mantêm numeração, títulos de ação e foco educativo", () => {
  for (const [number, title, file] of sectionFiles) {
    const section = source(`src/components/game-guide/sections/${file}`);
    assert.match(section, new RegExp(`number="${number}" title="${title}"`));
  }

  const setup = source("src/components/game-guide/sections/guide-setup-section.tsx");
  const order = source("src/components/game-guide/sections/guide-order-section.tsx");
  const turn = source("src/components/game-guide/sections/guide-turn-section.tsx");
  const victory = source("src/components/game-guide/sections/guide-victory-section.tsx");

  assert.match(setup, /2 a 6 jogadores/);
  assert.match(order, /GameDie/);
  assert.match(order, /Empate/);
  assert.doesNotMatch(order, /<strong>Turno|<strong>Rodada/);
  assert.match(turn, /GuideFlow/);
  assert.doesNotMatch(turn, /GameDie|Domínio regional|wb-guide-rule-grid/);
  assert.match(victory, /15 · Vitória/);
  assert.match(victory, /<h2>Cumpra seu objetivo\.<\/h2>/);
});

test("núcleo usa auxílios visuais específicos em vez de parágrafos repetidos", () => {
  const reinforcement = source("src/components/game-guide/sections/guide-reinforcement-section.tsx");
  const attack = source("src/components/game-guide/sections/guide-attack-section.tsx");
  const combat = source("src/components/game-guide/sections/guide-combat-section.tsx");
  const barrier = source("src/components/game-guide/sections/guide-barrier-section.tsx");
  const conquest = source("src/components/game-guide/sections/guide-conquest-section.tsx");
  const elimination = source("src/components/game-guide/sections/guide-elimination-section.tsx");

  assert.match(reinforcement, /GuideRuleScale/);
  assert.match(reinforcement, /GuideStateChange/);
  assert.match(attack, /GuideConnection/);
  assert.match(attack, /Antes da primeira rolagem/);
  assert.doesNotMatch(attack, /wb-guide-attack-checks|wb-guide-attack-blockers/);
  assert.match(combat, /GuideDiceComparison/);
  assert.match(combat, /Empates favorecem a defesa/);
  assert.doesNotMatch(combat, /wb-guide-combat-rule/);
  assert.match(barrier, /GeographicBarrierMapExample/);
  assert.match(barrier, /caveira-vermelha\.svg/);
  assert.match(barrier, /alcapao-saida\.svg/);
  assert.doesNotMatch(barrier, /wb-guide-notes/);
  assert.match(conquest, /GuideStateChange/);
  assert.match(conquest, /nenhum novo ataque/);
  assert.match(elimination, /GuideFlow/);
  assert.match(elimination, /TerritoryCardArtwork/);
});

test("cartas mostram apenas combinações alcançáveis e limites relevantes", () => {
  const cards = source("src/components/game-guide/sections/guide-cards-section.tsx");

  assert.match(cards, /Conquistou ≥ 1/);
  assert.match(cards, /3 símbolos iguais/);
  assert.match(cards, /1 de cada símbolo/);
  assert.match(cards, /Coringa substitui símbolo/);
  assert.doesNotMatch(cards, /Três Coringas/);
  assert.match(cards, /guide\.cards\.tradeValues\.map/);
  assert.match(cards, /A progressão é <strong>individual<\/strong>/);
  assert.match(cards, /guide\.cards\.ownedTerritoryBonus/);
  assert.match(cards, /guide\.cards\.mandatoryTradeHandSize/);
  assert.match(cards, /ou mais cartas/);
});

test("manobra, mapa, Anomalia e vitória mantêm as limitações essenciais", () => {
  const maneuver = source("src/components/game-guide/sections/guide-maneuver-section.tsx");
  const map = source("src/components/game-guide/sections/guide-map-section.tsx");
  const anomaly = source("src/components/game-guide/sections/guide-anomaly-section.tsx");
  const victory = source("src/components/game-guide/sections/guide-victory-section.tsx");

  assert.match(maneuver, /cadeia própria/);
  assert.match(maneuver, /não podem sair novamente/i);
  assert.match(maneuver, /seção 08/);
  assert.doesNotMatch(maneuver, /GuideRuleScale|wb-guide-maneuver-barriers/);
  assert.match(map, /variant="normal"/);
  assert.match(map, /variant="barrier"/);
  assert.match(map, /variant="tunnel"/);
  assert.match(map, /Túnel conta como conexão normal/);
  assert.doesNotMatch(map, /topologia efetiva/);
  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.match(anomaly, /minimumTroopsAfterRemoval/);
  assert.match(anomaly, /evento de abertura não adiciona outra/i);
  assert.match(victory, /Condição cumprida/);
  assert.match(victory, /partida termina/);
});

test("polimento editorial mantém detalhes subordinados à regra principal", () => {
  const order = source("src/components/game-guide/sections/guide-order-section.tsx");
  const objective = source("src/components/game-guide/sections/guide-objective-section.tsx");
  const combat = source("src/components/game-guide/sections/guide-combat-section.tsx");
  const barrier = source("src/components/game-guide/sections/guide-barrier-section.tsx");
  const maneuver = source("src/components/game-guide/sections/guide-maneuver-section.tsx");

  assert.doesNotMatch(order, /wb-guide-notes/);
  assert.doesNotMatch(objective, /wb-guide-notes/);
  assert.doesNotMatch(combat, /Se o ataque for maior/);
  assert.doesNotMatch(barrier, /A comparação não muda/);
  assert.doesNotMatch(maneuver, /0 barreiras|rota bloqueada/);
});

test("texto do manual permanece voltado ao jogo e não à implementação da interface", () => {
  const sections = [
    ...sectionFiles.map(([, , file]) => source(`src/components/game-guide/sections/${file}`)),
    source("src/components/game-guide/sections/guide-victory-section.tsx"),
  ].join("\n");

  assert.doesNotMatch(
    sections,
    /\bmodal\b|pressione|clique|componente|topologia efetiva|o sistema verifica/i,
  );
});

test("primitivas permanecem desacopladas das regras e reutilizam componentes reais", () => {
  const flow = source("src/components/game-guide/guide-flow.tsx");
  const scale = source("src/components/game-guide/guide-rule-scale.tsx");
  const stateChange = source("src/components/game-guide/guide-state-change.tsx");
  const territory = source("src/components/game-guide/guide-territory-node.tsx");
  const connection = source("src/components/game-guide/guide-connection.tsx");
  const dice = source("src/components/game-guide/guide-dice-comparison.tsx");
  const layout = source("src/app/layout.tsx");

  assert.match(flow, /<ol/);
  assert.match(scale, /<dl/);
  assert.match(stateChange, /<figure/);
  assert.match(connection, /role="img"/);
  assert.match(dice, /GameDie/);

  for (const component of [flow, scale, stateChange, territory, connection, dice]) {
    assert.doesNotMatch(
      component,
      /game-rules|game-barrier-rules|reinforcementBase|attackProfile|tradeValue|resolveBattle/,
    );
  }

  assert.match(layout, /war-guide-primitives\.css/);
  assert.match(layout, /war-guide-sections\.css/);
  assert.match(layout, /war-guide-final-sections\.css/);
  assert.match(layout, /war-guide-responsive\.css/);
});
