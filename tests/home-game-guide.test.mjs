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
  ["03", "Leia sua missão", "guide-objective-section.tsx"],
  ["04", "Siga seu turno", "guide-turn-section.tsx"],
  ["05", "Reforce seus territórios", "guide-reinforcement-section.tsx"],
  ["06", "Escolha seu ataque", "guide-attack-section.tsx"],
  ["07", "Role e compare", "guide-combat-section.tsx"],
  ["08", "Cruze Barreiras Geográficas", "guide-barrier-section.tsx"],
  ["09", "Tome o território", "guide-conquest-section.tsx"],
  ["10", "Elimine um rival", "guide-elimination-section.tsx"],
  ["11", "Transforme cartas em tropas", "guide-cards-section.tsx"],
  ["12", "Reposicione suas tropas", "guide-maneuver-section.tsx"],
  ["13", "Leia as conexões do mapa", "guide-map-section.tsx"],
  ["14", "Adapte-se à Anomalia", "guide-anomaly-section.tsx"],
];

test("apresentação do manual expõe o conjunto completo de dados necessários", () => {
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
  assert.match(page, /loading="eager"/);
  assert.match(page, /href="#manual"/);
  assert.match(page, /<GameQuickGuide \/>/);
});

test("GameQuickGuide orquestra as quinze seções sem reimplementar conteúdo", () => {
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

  assert.doesNotMatch(
    main,
    /GuideHeading|MapReadingExample|TerritoryCardArtwork|TemporalAnomalyEffectList|GameDie/,
  );
});

test("seções 01 a 14 preservam numeração e títulos educativos", () => {
  for (const [number, title, file] of sectionFiles) {
    const section = source(`src/components/game-guide/sections/${file}`);
    const pattern = new RegExp(`number="${number}" title="${title}"`);
    assert.match(section, pattern, `${file} precisa manter ${number} · ${title}`);
  }

  const victory = source("src/components/game-guide/sections/guide-victory-section.tsx");
  assert.match(victory, /15 · Vitória/);
});

test("primeiras seções ensinam preparação, ordem, missão e fluxo sem duplicar mecânicas", () => {
  const setup = source("src/components/game-guide/sections/guide-setup-section.tsx");
  const order = source("src/components/game-guide/sections/guide-order-section.tsx");
  const objective = source("src/components/game-guide/sections/guide-objective-section.tsx");
  const turn = source("src/components/game-guide/sections/guide-turn-section.tsx");

  assert.match(setup, /GuideFlow/);
  assert.match(order, /GameDie/);
  assert.match(order, /Turno/);
  assert.match(order, /Rodada/);
  assert.match(objective, /Domínio/);
  assert.match(objective, /Expansão/);
  assert.match(objective, /Fortificação/);
  assert.match(objective, /Eliminação/);
  assert.match(turn, /GuideFlow/);
  assert.doesNotMatch(turn, /GameDie|Domínio regional|wb-guide-rule-grid/);
});

test("núcleo 05 a 10 usa auxílios visuais específicos para cada decisão", () => {
  const reinforcement = source("src/components/game-guide/sections/guide-reinforcement-section.tsx");
  const attack = source("src/components/game-guide/sections/guide-attack-section.tsx");
  const combat = source("src/components/game-guide/sections/guide-combat-section.tsx");
  const barrier = source("src/components/game-guide/sections/guide-barrier-section.tsx");
  const conquest = source("src/components/game-guide/sections/guide-conquest-section.tsx");
  const elimination = source("src/components/game-guide/sections/guide-elimination-section.tsx");

  assert.match(reinforcement, /GuideRuleScale/);
  assert.match(reinforcement, /GuideStateChange/);
  assert.match(reinforcement, /guide\.regions\.map/);
  assert.match(attack, /GuideConnection/);
  assert.match(attack, /Depois da primeira rolagem/);
  assert.match(combat, /GuideDiceComparison/);
  assert.match(combat, /Empate favorece a defesa/);
  assert.match(barrier, /GeographicBarrierMapExample/);
  assert.match(barrier, /caveira-vermelha\.svg/);
  assert.match(barrier, /alcapao-saida\.svg/);
  assert.match(conquest, /GuideStateChange/);
  assert.match(conquest, /Nenhum novo ataque pode começar/);
  assert.match(elimination, /GuideFlow/);
  assert.match(elimination, /TerritoryCardArtwork/);
});

test("cartas documentam casos de borda e progressão sem números literais duplicados", () => {
  const cards = source("src/components/game-guide/sections/guide-cards-section.tsx");

  assert.match(cards, /Conquistou ≥ 1/);
  assert.match(cards, /3 símbolos iguais/);
  assert.match(cards, /1 de cada símbolo/);
  assert.match(cards, /Coringa substitui símbolo/);
  assert.match(cards, /Três Coringas também formam uma combinação válida/);
  assert.match(cards, /guide\.cards\.tradeValues\.map/);
  assert.match(cards, /progressão é <strong>individual<\/strong>/);
  assert.match(cards, /guide\.cards\.ownedTerritoryBonus/);
  assert.match(cards, /guide\.cards\.mandatoryTradeHandSize/);
  assert.match(cards, /ou mais cartas na mão/);
  assert.doesNotMatch(cards, /\+2 tropas nele|5 cartas na mão/);
});

test("manobra, mapa, Anomalia e vitória preservam limitações essenciais", () => {
  const maneuver = source("src/components/game-guide/sections/guide-maneuver-section.tsx");
  const map = source("src/components/game-guide/sections/guide-map-section.tsx");
  const anomaly = source("src/components/game-guide/sections/guide-anomaly-section.tsx");
  const victory = source("src/components/game-guide/sections/guide-victory-section.tsx");

  assert.match(maneuver, /caminho contínuo/);
  assert.match(maneuver, /não pode ser movida de\s+novo/i);
  assert.match(maneuver, /GuideConnection/);
  assert.match(maneuver, /GuideStateChange/);
  assert.match(maneuver, /0 barreiras/);
  assert.match(maneuver, /rota bloqueada/);

  assert.match(map, /MapReadingExample/);
  assert.match(map, /variant="normal"/);
  assert.match(map, /variant="barrier"/);
  assert.match(map, /variant="tunnel"/);
  assert.match(map, /mesma topologia\s+usada para validar ataques e caminhos de manobra/);

  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.match(anomaly, /minimumTroopsAfterRemoval/);
  assert.match(anomaly, /Mudanças de tropas são aplicadas ao estado do território/);
  assert.match(anomaly, /evento inicial é narrativo/i);

  assert.match(victory, /GuideFlow/);
  assert.match(victory, /Condição cumprida/);
  assert.match(victory, /partida termina/);
});

test("serviços críticos consomem as mesmas fontes ou aplicam os limites descritos", () => {
  const gameRules = source("src/lib/game-rules.ts");
  const troopService = source("src/lib/game-troop-command-service.ts");
  const commandService = source("src/lib/game-command-service.ts");
  const combatService = source("src/lib/game-combat-command-service.ts");
  const conquestService = source("src/lib/game-conquest-command-service.ts");
  const battleService = source("src/lib/game-battle-service.ts");
  const maneuverService = source("src/lib/game-maneuver-command-service.ts");
  const topology = source("src/lib/game-effective-topology-service.ts");
  const roundService = source("src/lib/game-round-service.ts");
  const eventEffects = source("src/lib/events/event-effects-service.ts");
  const objectiveService = source("src/lib/game-objective-service.ts");

  assert.match(gameRules, /export const MIN_TERRITORY_TROOPS = 1/);
  assert.match(gameRules, /export const MANDATORY_TRADE_HAND_SIZE = 5/);
  assert.match(gameRules, /export const OWNED_TERRITORY_CARD_BONUS = 2/);

  assert.match(troopService, />=\s*MANDATORY_TRADE_HAND_SIZE/);
  assert.match(troopService, /OWNED_TERRITORY_CARD_BONUS/);
  assert.match(troopService, /card_trade_count=card_trade_count\+1/);
  assert.match(troopService, /tradeValue\(tradeProgress\.trade_count_before\)/);
  assert.match(commandService, /if \(room\.conquered_this_turn\)/);
  assert.match(commandService, /await drawCard\(client, room, player\.id\)/);
  assert.match(commandService, /advanceGameRound/);

  assert.match(combatService, /attackProfile\(attacker\.troops, attackMode\)/);
  assert.match(combatService, /Math\.min\(3, defender\.troops\)/);
  assert.match(combatService, /não pode mais ser cancelado depois da primeira rolagem/);
  assert.match(conquestService, /source\.troops - MIN_TERRITORY_TROOPS/);
  assert.match(battleService, /SET turn_position=NULL/);
  assert.match(battleService, /zone='hand'/);

  assert.match(maneuverService, /bestTerritoryRoute/);
  assert.match(maneuverService, /maneuverMovableTroops/);
  assert.match(maneuverService, /moved_in_turn=moved_in_turn\+\$3/);
  assert.match(topology, /effectiveGameConnections/);
  assert.match(roundService, /const jurassicTunnelDestinationId = nextTunnel/);
  assert.match(eventEffects, /MIN_TERRITORY_TROOPS/);
  assert.match(objectiveService, /SET status='finished',phase='finished',winner_player_id=\$2/);
});

test("exemplo geográfico usa paths reais e elementos do mapa", () => {
  const mapExample = source("src/components/game-guide/guide-map-examples.tsx");

  assert.match(mapExample, /createRoadCurve/);
  assert.match(mapExample, /Pará Oeste/);
  assert.match(mapExample, /Pará Sudeste/);
  assert.match(mapExample, /Pará Atlântico/);
  assert.match(mapExample, /GEOGRAPHIC_BARRIER_BOUNDARY/);
  assert.match(mapExample, /wb-guide-map-road-shadow/);
  assert.match(mapExample, /wb-guide-map-road-surface/);
  assert.match(mapExample, /wb-guide-map-road-center/);
  assert.match(mapExample, /Túnel Jurássico/);
});

test("manual reutiliza arte e componentes reais", () => {
  const utility = source("src/components/game-utility-bar.tsx");
  const cards = source("src/components/territory-card.tsx");
  const battle = source("src/components/battle-overlay.tsx");
  const anomaly = source("src/components/temporal-anomaly-modal.tsx");
  const combatGuide = source("src/components/game-guide/sections/guide-combat-section.tsx");
  const cardsGuide = source("src/components/game-guide/sections/guide-cards-section.tsx");
  const anomalyGuide = source("src/components/game-guide/sections/guide-anomaly-section.tsx");

  assert.match(utility, /game-utility-icons/);
  assert.match(cards, /TerritoryCardArtwork/);
  assert.match(battle, /GameDie/);
  assert.doesNotMatch(battle, /function BattleDie/);
  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.match(combatGuide, /GameDie/);
  assert.match(combatGuide, /GuideDiceComparison/);
  assert.match(cardsGuide, /TerritoryCardArtwork/);
  assert.match(cardsGuide, /Symbol/);
  assert.match(anomalyGuide, /TemporalAnomalyEffectList/);
});

test("primitivas mantêm semântica e ficam desacopladas das regras", () => {
  const flow = source("src/components/game-guide/guide-flow.tsx");
  const scale = source("src/components/game-guide/guide-rule-scale.tsx");
  const stateChange = source("src/components/game-guide/guide-state-change.tsx");
  const territory = source("src/components/game-guide/guide-territory-node.tsx");
  const connection = source("src/components/game-guide/guide-connection.tsx");
  const dice = source("src/components/game-guide/guide-dice-comparison.tsx");
  const layout = source("src/app/layout.tsx");

  assert.match(flow, /<ol/);
  assert.match(scale, /<dl/);
  assert.match(scale, /<dt>/);
  assert.match(scale, /<dd>/);
  assert.match(stateChange, /<figure/);
  assert.match(stateChange, /<figcaption>/);
  assert.match(territory, /data-tone=\{tone\}/);
  assert.match(connection, /role="img"/);
  assert.match(dice, /GameDie/);

  for (const component of [flow, scale, stateChange, territory, connection, dice]) {
    assert.doesNotMatch(
      component,
      /game-rules|game-barrier-rules|reinforcementBase|attackProfile|tradeValue|resolveBattle/,
    );
  }

  assert.match(layout, /import "\.\/war-guide-primitives\.css";/);
  assert.match(layout, /import "\.\/war-guide-sections\.css";/);
  assert.match(layout, /import "\.\/war-guide-final-sections\.css";/);
  assert.match(layout, /import "\.\/war-guide-responsive\.css";/);
});
