import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

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
  assert.equal(guide.maneuver.barrierLoss, 1);
  assert.equal(guide.maneuver.barrierMinimumTroops, 2);
  assert.equal(guide.maneuver.blockedBarrierCount, 2);
  assert.equal(guide.cards.firstTradeValue, 4);
});

test("home usa brasão e leva ao Manual de Campo", () => {
  const page = source("src/app/page.tsx");

  assert.match(page, /src="\/icone\.png"/);
  assert.match(page, /loading="eager"/);
  assert.match(page, /href="#manual"/);
  assert.match(page, /<GameQuickGuide \/>/);
});

test("manual compõe as dez primeiras etapas na ordem da partida", () => {
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
  ];

  let previous = -1;
  for (const marker of expected) {
    const index = main.indexOf(marker);
    assert.ok(index > previous, `${marker} precisa manter a ordem do fluxo`);
    previous = index;
  }

  assert.match(main, /number="11" title="Use suas cartas"/);
  assert.match(main, /number="12" title="Leia o mapa"/);
  assert.match(main, /number="13" title="Sobreviva às Anomalias"/);
  assert.match(main, /14 · Vitória/);
  assert.doesNotMatch(main, /GeographicBarrierMapExample/);
  assert.doesNotMatch(main, /wb-guide-geographic-actions/);
});

test("seções 01 a 04 continuam educativas e sem duplicar regras do núcleo", () => {
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
  assert.doesNotMatch(objective, /condição alternativa|fallback/i);
  assert.match(turn, /GuideFlow/);
  assert.doesNotMatch(turn, /wb-guide-rule-grid|Domínio regional|GameDie/);
});

test("núcleo do manual explica reforço, ataque, combate, barreira, conquista e eliminação", () => {
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
  assert.match(reinforcement, /ataque só é liberado quando todos os reforços forem posicionados/i);

  assert.match(attack, /number="06" title="Escolha seu ataque"/);
  assert.match(attack, /GuideConnection/);
  assert.match(attack, /guide\.attack\.normalMinimumTroops/);
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
  assert.match(barrier, /guide\.attack\.normalDiceBands/);
  assert.match(barrier, /guide\.attack\.barrierDiceBands/);
  assert.match(barrier, /guide\.attack\.barrierLossPerComparison/);
  assert.match(barrier, /caveira-vermelha\.svg/);
  assert.match(barrier, /alcapao-saida\.svg/);

  assert.match(conquest, /number="09" title="Tome o território"/);
  assert.match(conquest, /GuideStateChange/);
  assert.match(conquest, /guide\.conquest\.minimumMove/);
  assert.match(conquest, /Nenhum novo ataque pode começar/);

  assert.match(elimination, /number="10" title="Elimine um rival"/);
  assert.match(elimination, /GuideFlow/);
  assert.match(elimination, /TerritoryCardArtwork/);
  assert.match(elimination, /todas as cartas/);
  assert.match(elimination, /deixa de receber turnos/);
  assert.match(elimination, /mesmo quando outro jogador realizou a conquista final/);
});

test("regras documentadas do núcleo correspondem às restrições implementadas no dev", () => {
  const troopService = source("src/lib/game-troop-command-service.ts");
  const combatService = source("src/lib/game-combat-command-service.ts");
  const conquestService = source("src/lib/game-conquest-command-service.ts");
  const battleService = source("src/lib/game-battle-service.ts");

  assert.match(troopService, /MANDATORY_TRADE_HAND_SIZE = 5/);
  assert.match(troopService, /Você só pode reforçar territórios próprios/);
  assert.match(troopService, /phase=CASE WHEN \$2=0 THEN 'attack' ELSE phase END/);

  assert.match(combatService, /attackProfile\(attacker\.troops, attackMode\)/);
  assert.match(combatService, /Math\.min\(3, defender\.troops\)/);
  assert.match(combatService, /Conclua o deslocamento da conquista antes de atacar novamente/);
  assert.match(combatService, /não pode mais ser cancelado depois da primeira rolagem/);
  assert.match(combatService, /isAttackOriginBlocked/);

  assert.match(conquestService, /troops > source\.troops - 1/);
  assert.match(conquestService, /positiveInteger/);

  assert.match(battleService, /SET turn_position=NULL/);
  assert.match(battleService, /SET owner_player_id=\$3/);
  assert.match(battleService, /zone='hand'/);
  assert.match(battleService, /evaluateEliminationObjectiveOwners/);
});

test("exemplo geográfico copia os paths reais do Pará e reutiliza a curva das estradas", () => {
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

test("manual reutiliza arte e ícones reais em vez de duplicar componentes", () => {
  const utility = source("src/components/game-utility-bar.tsx");
  const cards = source("src/components/territory-card.tsx");
  const battle = source("src/components/battle-overlay.tsx");
  const anomaly = source("src/components/temporal-anomaly-modal.tsx");
  const combatGuide = source("src/components/game-guide/sections/guide-combat-section.tsx");

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
});

test("primitivas visuais do manual têm contratos semânticos e responsivos", () => {
  const flow = source("src/components/game-guide/guide-flow.tsx");
  const scale = source("src/components/game-guide/guide-rule-scale.tsx");
  const stateChange = source("src/components/game-guide/guide-state-change.tsx");
  const territory = source("src/components/game-guide/guide-territory-node.tsx");
  const connection = source("src/components/game-guide/guide-connection.tsx");
  const dice = source("src/components/game-guide/guide-dice-comparison.tsx");
  const styles = source("src/app/war-guide-primitives.css");
  const sectionStyles = source("src/app/war-guide-sections.css");
  const layout = source("src/app/layout.tsx");

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

  for (const selector of [
    "wb-guide-core-split",
    "wb-guide-attack-checks",
    "wb-guide-combat-scales",
    "wb-guide-barrier-comparison",
    "wb-guide-elimination-transfer",
  ]) {
    assert.match(sectionStyles, new RegExp(`\\.${selector}`));
  }

  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(sectionStyles, /@media \(max-width: 980px\)/);
  assert.match(sectionStyles, /@media \(max-width: 700px\)/);
  assert.match(layout, /import "\.\/war-guide-primitives\.css";/);
  assert.match(layout, /import "\.\/war-guide-sections\.css";/);

  for (const primitive of [flow, scale, stateChange, territory, connection, dice]) {
    assert.doesNotMatch(
      primitive,
      /game-rules|game-barrier-rules|reinforcementBase|attackProfile|tradeValue|resolveBattle/,
    );
  }
});
