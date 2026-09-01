import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("guia deriva números e exemplos das regras reais", () => {
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
  assert.deepEqual(guide.reinforcement.minimumExample, {
    territoryCount: 5,
    rawHalf: 2,
    final: 3,
  });

  assert.equal(guide.attack.normalMinimumTroops, 2);
  assert.equal(guide.attack.normalLossPerComparison, 1);
  assert.deepEqual(guide.attack.normalDiceBands, [
    { minimumTroops: 2, maximumTroops: 2, diceCount: 1 },
    { minimumTroops: 3, maximumTroops: 3, diceCount: 2 },
    { minimumTroops: 4, maximumTroops: null, diceCount: 3 },
  ]);
  assert.deepEqual(guide.defense.diceBands, [
    { minimumTroops: 1, maximumTroops: 1, diceCount: 1 },
    { minimumTroops: 2, maximumTroops: 2, diceCount: 2 },
    { minimumTroops: 3, maximumTroops: null, diceCount: 3 },
  ]);
  assert.deepEqual(guide.combat.example, {
    comparisons: [
      { key: "comparison-0", attack: 6, defense: 5, loser: "defender" },
      { key: "comparison-1", attack: 4, defense: 4, loser: "attacker" },
    ],
    unpairedAttack: [2],
    unpairedDefense: [],
    attackerLosses: 1,
    defenderLosses: 1,
  });

  assert.equal(guide.attack.barrierMinimumTroops, 4);
  assert.equal(guide.attack.barrierLossPerComparison, 3);
  assert.deepEqual(guide.attack.barrierDiceBands, [
    { minimumTroops: 4, maximumTroops: 6, diceCount: 1 },
    { minimumTroops: 7, maximumTroops: 9, diceCount: 2 },
    { minimumTroops: 10, maximumTroops: null, diceCount: 3 },
  ]);
  assert.equal(guide.conquest.minimumMove, 1);
  assert.equal(guide.conquest.minimumTroopsLeftAtOrigin, 1);

  assert.equal(guide.maneuver.minimumTroopsLeftAtOrigin, 1);
  assert.equal(guide.maneuver.normalLoss, 0);
  assert.equal(guide.maneuver.barrierLoss, 1);
  assert.equal(guide.maneuver.barrierMinimumTroops, 2);
  assert.equal(guide.maneuver.blockedBarrierCount, 2);
  assert.deepEqual(guide.maneuver.example, {
    sourceTroops: 5,
    alreadyMoved: 2,
    movableBeforeReceiving: 4,
    movableAfterReceiving: 2,
  });

  assert.equal(guide.cards.cardsPerConqueringTurn, 1);
  assert.equal(guide.cards.mandatoryTradeHandSize, 5);
  assert.equal(guide.cards.ownedTerritoryBonus, 2);
  assert.equal(guide.cards.firstTradeValue, 4);
  assert.deepEqual(guide.cards.tradeValues, [4, 5, 6, 7, 8, 9]);
  assert.equal(guide.cards.incrementPerPersonalTrade, 1);
  assert.equal(guide.anomalies.minimumTroopsAfterRemoval, 1);
});

test("home usa brasão e leva ao Manual de Campo", () => {
  const page = source("src/app/page.tsx");

  assert.match(page, /src="\/icone\.png"/);
  assert.match(page, /loading="eager"/);
  assert.match(page, /href="#manual"/);
  assert.match(page, /<GameQuickGuide \/>/);
});

test("manual compõe as quinze etapas na ordem planejada", () => {
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

  assert.doesNotMatch(main, /GuideHeading|MapReadingExample|TerritoryCardArtwork|TemporalAnomalyEffectList|GameDie/);
});

test("seções 01 a 04 permanecem introdutórias e sem duplicar o núcleo", () => {
  const setup = source("src/components/game-guide/sections/guide-setup-section.tsx");
  const order = source("src/components/game-guide/sections/guide-order-section.tsx");
  const objective = source("src/components/game-guide/sections/guide-objective-section.tsx");
  const turn = source("src/components/game-guide/sections/guide-turn-section.tsx");

  assert.match(setup, /number="01" title="Prepare o Brasil"/);
  assert.match(order, /number="02" title="Defina a ordem"/);
  assert.match(objective, /number="03" title="Leia sua missão"/);
  assert.match(turn, /number="04" title="Siga seu turno"/);
  assert.match(order, /GameDie/);
  assert.match(order, /Turno/);
  assert.match(order, /Rodada/);
  assert.match(objective, /Domínio/);
  assert.match(objective, /Expansão/);
  assert.match(objective, /Fortificação/);
  assert.match(objective, /Eliminação/);
  assert.match(objective, /mesmo sem você realizar a conquista final/);
  assert.match(turn, /GuideFlow/);
  assert.doesNotMatch(turn, /wb-guide-rule-grid|Domínio regional|GameDie/);
});

test("seções 05 a 10 ensinam o núcleo de combate sem regras órfãs", () => {
  const reinforcement = source("src/components/game-guide/sections/guide-reinforcement-section.tsx");
  const attack = source("src/components/game-guide/sections/guide-attack-section.tsx");
  const combat = source("src/components/game-guide/sections/guide-combat-section.tsx");
  const barrier = source("src/components/game-guide/sections/guide-barrier-section.tsx");
  const conquest = source("src/components/game-guide/sections/guide-conquest-section.tsx");
  const elimination = source("src/components/game-guide/sections/guide-elimination-section.tsx");

  assert.match(reinforcement, /number="05" title="Reforce seus territórios"/);
  assert.match(reinforcement, /GuideRuleScale/);
  assert.match(reinforcement, /GuideStateChange/);
  assert.match(reinforcement, /guide\.regions\.map/);
  assert.match(reinforcement, /Troca obrigatória pendente/);

  assert.match(attack, /number="06" title="Escolha seu ataque"/);
  assert.match(attack, /GuideConnection/);
  assert.match(attack, /Depois da primeira rolagem/);
  assert.match(attack, /origem bloqueada por Anomalia/);
  assert.match(attack, /conquista pendente precisa ser ocupada/);

  assert.match(combat, /number="07" title="Role e compare"/);
  assert.match(combat, /GuideDiceComparison/);
  assert.match(combat, /guide\.attack\.normalDiceBands/);
  assert.match(combat, /guide\.defense\.diceBands/);
  assert.match(combat, /Empate favorece a defesa/);
  assert.match(combat, /dados sem adversário são ignorados/i);

  assert.match(barrier, /number="08" title="Cruze Barreiras Geográficas"/);
  assert.match(barrier, /GeographicBarrierMapExample/);
  assert.match(barrier, /guide\.attack\.barrierDiceBands/);
  assert.match(barrier, /caveira-vermelha\.svg/);
  assert.match(barrier, /alcapao-saida\.svg/);

  assert.match(conquest, /number="09" title="Tome o território"/);
  assert.match(conquest, /GuideStateChange/);
  assert.match(conquest, /Nenhum novo ataque pode começar/);

  assert.match(elimination, /number="10" title="Elimine um rival"/);
  assert.match(elimination, /GuideFlow/);
  assert.match(elimination, /TerritoryCardArtwork/);
  assert.match(elimination, /todas as cartas/);
  assert.match(elimination, /deixa de receber turnos/);
});

test("seções 11 a 15 fecham cartas, manobra, mapa, Anomalias e vitória", () => {
  const cards = source("src/components/game-guide/sections/guide-cards-section.tsx");
  const maneuver = source("src/components/game-guide/sections/guide-maneuver-section.tsx");
  const map = source("src/components/game-guide/sections/guide-map-section.tsx");
  const anomaly = source("src/components/game-guide/sections/guide-anomaly-section.tsx");
  const victory = source("src/components/game-guide/sections/guide-victory-section.tsx");

  assert.match(cards, /number="11" title="Transforme cartas em tropas"/);
  assert.match(cards, /Conquistou ≥ 1/);
  assert.match(cards, /guide\.cards\.cardsPerConqueringTurn/);
  assert.match(cards, /3 símbolos iguais/);
  assert.match(cards, /1 de cada símbolo/);
  assert.match(cards, /Coringa substitui símbolo/);
  assert.match(cards, /guide\.cards\.tradeValues\.map/);
  assert.match(cards, /progressão é <strong>individual<\/strong>/);
  assert.match(cards, /guide\.cards\.ownedTerritoryBonus/);
  assert.match(cards, /guide\.cards\.mandatoryTradeHandSize/);

  assert.match(maneuver, /number="12" title="Reposicione suas tropas"/);
  assert.match(maneuver, /caminho contínuo/);
  assert.match(maneuver, /não pode ser movida de\s+novo/i);
  assert.match(maneuver, /GuideConnection/);
  assert.match(maneuver, /GuideStateChange/);
  assert.match(maneuver, /guide\.maneuver\.movableAfterReceiving|guide\.maneuver\.example\.movableAfterReceiving/);
  assert.match(maneuver, /0 barreiras/);
  assert.match(maneuver, /rota bloqueada/);

  assert.match(map, /number="13" title="Leia as conexões do mapa"/);
  assert.match(map, /MapReadingExample/);
  assert.match(map, /RoadsIcon/);
  assert.match(map, /TroopsIcon/);
  assert.match(map, /AnomalyIcon/);
  assert.match(map, /variant="normal"/);
  assert.match(map, /variant="barrier"/);
  assert.match(map, /variant="tunnel"/);
  assert.match(map, /Acre recebe um novo destino temporário a\s+cada rodada/);

  assert.match(anomaly, /number="14" title="Adapte-se à Anomalia"/);
  assert.match(anomaly, /Todos jogam/);
  assert.match(anomaly, /Nova Anomalia/);
  assert.match(anomaly, /Novo Túnel/);
  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.match(anomaly, /GuideStateChange/);
  assert.match(anomaly, /minimumTroopsAfterRemoval/);
  assert.match(anomaly, /evento inicial é narrativo/i);

  assert.match(victory, /15 · Vitória/);
  assert.match(victory, /GuideFlow/);
  assert.match(victory, /Objetivo secreto/);
  assert.match(victory, /Condição cumprida/);
  assert.match(victory, /partida termina/);
  assert.match(victory, /href="\/matchmaking"/);
});

test("regras documentadas correspondem às restrições implementadas no dev", () => {
  const troopService = source("src/lib/game-troop-command-service.ts");
  const commandService = source("src/lib/game-command-service.ts");
  const combatService = source("src/lib/game-combat-command-service.ts");
  const conquestService = source("src/lib/game-conquest-command-service.ts");
  const battleService = source("src/lib/game-battle-service.ts");
  const maneuverService = source("src/lib/game-maneuver-command-service.ts");
  const connections = source("src/lib/territory-connections.ts");
  const topology = source("src/lib/game-effective-topology-service.ts");
  const roundService = source("src/lib/game-round-service.ts");
  const eventEffects = source("src/lib/events/event-effects-service.ts");
  const objectiveService = source("src/lib/game-objective-service.ts");

  assert.match(troopService, /MANDATORY_TRADE_HAND_SIZE = 5/);
  assert.match(troopService, /room\.phase !== "reinforcement"/);
  assert.match(troopService, /SET card_trade_count=card_trade_count\+1/);
  assert.match(troopService, /RETURNING card_trade_count-1 trade_count_before/);
  assert.match(troopService, /tradeValue\(tradeProgress\.trade_count_before\)/);
  assert.match(troopService, /SET troops=troops\+2/);
  assert.match(commandService, /if \(room\.conquered_this_turn\)/);
  assert.match(commandService, /await drawCard\(client, room, player\.id\)/);

  assert.match(combatService, /attackProfile\(attacker\.troops, attackMode\)/);
  assert.match(combatService, /Math\.min\(3, defender\.troops\)/);
  assert.match(combatService, /Conclua o deslocamento da conquista antes de atacar novamente/);
  assert.match(combatService, /não pode mais ser cancelado depois da primeira rolagem/);
  assert.match(combatService, /isAttackOriginBlocked/);
  assert.match(conquestService, /troops > source\.troops - 1/);
  assert.match(battleService, /SET turn_position=NULL/);
  assert.match(battleService, /SET owner_player_id=\$3/);
  assert.match(battleService, /zone='hand'/);

  assert.match(maneuverService, /bestTerritoryRoute/);
  assert.match(maneuverService, /territórios próprios/);
  assert.match(maneuverService, /maneuverMovableTroops/);
  assert.match(maneuverService, /moved_in_turn=moved_in_turn\+\$3/);
  assert.match(maneuverService, /mais de uma barreira/);

  assert.match(connections, /JURASSIC_TUNNEL_SOURCE_ID = 3/);
  assert.match(connections, /passable: true/);
  assert.match(connections, /Conexão temporária do Acre válida durante esta rodada/);
  assert.match(topology, /effectiveGameConnections/);
  assert.match(roundService, /const jurassicTunnelDestinationId = nextTunnel/);
  assert.match(roundService, /currentRoundNumber \+ 1/);
  assert.match(roundService, /resolveGameEventEffects/);
  assert.match(eventEffects, /GREATEST\(1,troops-\$3\)/);

  assert.match(objectiveService, /SET status='finished',phase='finished',winner_player_id=\$2/);
});

test("exemplo geográfico usa paths reais e elementos do mapa", () => {
  const mapExample = source("src/components/game-guide/guide-map-examples.tsx");

  assert.match(mapExample, /createRoadCurve/);
  assert.match(mapExample, /Pará Oeste/);
  assert.match(mapExample, /Pará Sudeste/);
  assert.match(mapExample, /Pará Atlântico/);
  assert.match(mapExample, /id: 6/);
  assert.match(mapExample, /id: 9/);
  assert.match(mapExample, /id: 11/);
  assert.match(mapExample, /M 639\.0 462\.5 L 623\.0 459\.5/);
  assert.match(mapExample, /M 723\.0 467\.5 L 703\.0 466\.5/);
  assert.match(mapExample, /M 784\.0 313\.5 L 779\.0 309\.5/);
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
  assert.doesNotMatch(utility, /function RoadsIcon/);
  assert.match(cards, /TerritoryCardArtwork/);
  assert.doesNotMatch(cards, /card-template\.png/);
  assert.match(battle, /GameDie/);
  assert.doesNotMatch(battle, /pipPositions|function BattleDie/);
  assert.match(anomaly, /TemporalAnomalyEffectList/);
  assert.doesNotMatch(anomaly, /effectMarker/);
  assert.match(combatGuide, /GameDie/);
  assert.match(combatGuide, /GuideDiceComparison/);
  assert.doesNotMatch(combatGuide, /pipPositions|dado-brasil-hq\.svg/);
  assert.match(cardsGuide, /TerritoryCardArtwork/);
  assert.match(cardsGuide, /Symbol/);
  assert.match(anomalyGuide, /TemporalAnomalyEffectList/);
});

test("primitivas e seções possuem contratos semânticos e responsivos", () => {
  const flow = source("src/components/game-guide/guide-flow.tsx");
  const scale = source("src/components/game-guide/guide-rule-scale.tsx");
  const stateChange = source("src/components/game-guide/guide-state-change.tsx");
  const territory = source("src/components/game-guide/guide-territory-node.tsx");
  const connection = source("src/components/game-guide/guide-connection.tsx");
  const dice = source("src/components/game-guide/guide-dice-comparison.tsx");
  const primitiveStyles = source("src/app/war-guide-primitives.css");
  const sectionStyles = source("src/app/war-guide-sections.css");
  const finalStyles = source("src/app/war-guide-final-sections.css");
  const layout = source("src/app/layout.tsx");

  assert.match(flow, /<ol/);
  assert.match(flow, /aria-label=\{ariaLabel\}/);
  assert.match(scale, /<dl/);
  assert.match(scale, /<dt>/);
  assert.match(scale, /<dd>/);
  assert.match(stateChange, /<figure/);
  assert.match(stateChange, /<figcaption>/);
  assert.match(territory, /data-tone=\{tone\}/);
  assert.match(connection, /role="img"/);
  assert.match(dice, /GameDie/);
  assert.doesNotMatch(dice, /pipPositions|dado-brasil-hq\.svg/);

  for (const selector of [
    "wb-guide-flow",
    "wb-guide-rule-scale",
    "wb-guide-state-change",
    "wb-guide-territory",
    "wb-guide-connection",
    "wb-guide-dice-comparison",
  ]) {
    assert.match(primitiveStyles, new RegExp(`\\.${selector}`));
  }

  for (const selector of [
    "wb-guide-cards-layout",
    "wb-guide-maneuver-route",
    "wb-guide-map-legend",
    "wb-guide-anomaly-layout",
    "wb-guide-victory-flow",
  ]) {
    assert.match(finalStyles, new RegExp(`\\.${selector}`));
  }

  assert.match(primitiveStyles, /@media \(max-width: 700px\)/);
  assert.match(sectionStyles, /@media \(max-width: 700px\)/);
  assert.match(finalStyles, /@media \(max-width: 980px\)/);
  assert.match(finalStyles, /@media \(max-width: 700px\)/);
  assert.match(layout, /import "\.\/war-guide-primitives\.css";/);
  assert.match(layout, /import "\.\/war-guide-sections\.css";/);
  assert.match(layout, /import "\.\/war-guide-final-sections\.css";/);

  for (const component of [flow, scale, stateChange, territory, connection, dice]) {
    assert.doesNotMatch(
      component,
      /game-rules|game-barrier-rules|reinforcementBase|attackProfile|tradeValue|resolveBattle/,
    );
  }
});
