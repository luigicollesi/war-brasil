import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDoctrinePresentation,
  DOCTRINE_CHAPTER_SLUGS,
} from "../.test-build/doctrine-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("Doutrina cobre o núcleo obrigatório e as mecânicas adicionais ativas", () => {
  const doctrine = buildDoctrinePresentation();
  const slugs = doctrine.chapters.map((chapter) => chapter.slug);

  assert.deepEqual(slugs, [...DOCTRINE_CHAPTER_SLUGS]);
  assert.equal(slugs.length, 12);
  for (const required of [
    "preparacao",
    "trocas",
    "reforcos",
    "ataque",
    "conquista",
    "movimentacao",
    "cartas",
    "objetivos",
    "barreiras-conexoes",
    "anomalias",
  ]) {
    assert.ok(slugs.includes(required), `${required} precisa existir na Doutrina`);
  }
});

test("read model da Doutrina deriva mecânicas das autoridades do jogo", () => {
  const doctrine = buildDoctrinePresentation();
  const turn = doctrine.chapters.find((chapter) => chapter.slug === "turno");
  const trade = doctrine.chapters.find((chapter) => chapter.slug === "trocas");
  const attack = doctrine.chapters.find((chapter) => chapter.slug === "ataque");
  const barriers = doctrine.chapters.find(
    (chapter) => chapter.slug === "barreiras-conexoes",
  );
  const events = doctrine.chapters.find((chapter) => chapter.slug === "anomalias");

  assert.ok(turn);
  assert.ok(trade);
  assert.ok(attack);
  assert.ok(barriers);
  assert.ok(events);
  assert.deepEqual(
    turn.metrics.map((phase) => phase.value),
    ["Trocas", "Reforços", "Ataque", "Manobra"],
  );
  assert.equal(trade.visual, "trade");
  assert.equal(doctrine.playerTrade.offerLimitPerTurn, 3);
  assert.equal(doctrine.playerTrade.signalLimitPerTurn, 2);
  assert.equal(doctrine.combatExample.attackerLosses, 1);
  assert.equal(doctrine.combatExample.defenderLosses, 1);
  assert.equal(doctrine.cards.mandatoryTradeHandSize, 5);
  assert.equal(doctrine.cards.ownedTerritoryBonus, 2);
  assert.equal(doctrine.barrier.attackerLossPerComparison, 3);
  assert.equal(doctrine.barrier.maneuverLoss, 1);
  assert.equal(doctrine.barrier.blockedBarrierCount, 2);
  assert.equal(doctrine.conquest.minimumTroopsLeftAtOrigin, 1);
  assert.equal(doctrine.conquest.minimumMove, 1);
  assert.equal(doctrine.maneuver.minimumTroopsLeftAtOrigin, 1);
  assert.equal(doctrine.anomalies.eventCount, 38);
  assert.deepEqual(
    doctrine.objectiveFormats.map((format) => format.title),
    ["DOMÍNIO", "FORTIFICAÇÃO", "ELIMINAÇÃO"],
  );
  assert.match(trade.lede, /antes dos reforços/);
  assert.match(trade.principles.join(" "), /Negociação não concede tropas/);
  assert.match(events.lede, /38 estados de evento/);

  const presentationSource = source("src/lib/doctrine-presentation.ts");
  assert.match(presentationSource, /buildGameGuidePresentation/);
  assert.match(presentationSource, /guide\.playerTrade\.offerLimitPerTurn/);
  assert.match(presentationSource, /guide\.playerTrade\.signalLimitPerTurn/);
  assert.match(presentationSource, /EVENT_COUNT/);
  assert.match(presentationSource, /JURASSIC_TUNNEL_SOURCE_ID/);
  assert.doesNotMatch(
    presentationSource,
    /const\s+(?:MIN_TERRITORY_TROOPS|MANDATORY_TRADE_HAND_SIZE|OWNED_TERRITORY_CARD_BONUS|PLAYER_TRADE_OFFER_LIMIT|PLAYER_TRADE_SIGNAL_LIMIT)\s*=/,
  );
});

test("/rules resolve deep-link no servidor dentro do runtime Foundation sem depender de Canvas", () => {
  const page = source("src/app/rules/page.tsx");
  const layout = source("src/app/layout.tsx");
  const routes = source(
    "src/components/pre-game/foundation/pre-game-route-intent.ts",
  );

  assert.match(page, /await searchParams/);
  assert.match(page, /isDoctrineChapterSlug/);
  assert.match(page, /buildDoctrinePresentation/);
  assert.match(page, /<DoctrineExperience/);
  assert.match(page, /canonical: "\/rules"/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.match(routes, /"\/rules": "doctrine"/);
  assert.doesNotMatch(page, /<CommandShell|DOCTRINE_SCENE_INTENT/);
  assert.doesNotMatch(page, /Canvas|@react-three|three\//i);
});

test("Doutrina emite somente diretiva visual e deixa mode com a rota", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /useCommandSceneDirective/);
  assert.match(experience, /focus: "brazil"/);
  assert.match(experience, /territoryExplode: 0\.18/);
  assert.match(experience, /orbitalAlignment: 0/);
  assert.doesNotMatch(experience, /\bmode\s*:/);
  assert.doesNotMatch(experience, /camera|quaternion|fov|position|\bx:|\by:|\bz:/i);
  assert.doesNotMatch(
    experience,
    /<CommandScene|CameraDirector|from\s+["'][^"']*command-scene["']|@react-three|three\//i,
  );
});

test("índice usa links reais, preserva foco/scroll e anima somente a superfície do capítulo", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /`\/rules\?chapter=\$\{slug\}`/);
  assert.match(experience, /window\.history\.pushState/);
  assert.match(experience, /popstate/);
  assert.match(experience, /startViewTransition/);
  assert.match(experience, /prefersReducedMotion/);
  assert.match(experience, /data-chapter=\{chapter\.slug\}/);
  assert.match(experience, /aria-current=\{active \? "location"/);
  assert.match(experience, /aria-label="Capítulos da Doutrina"/);
  assert.match(experience, /aria-live="polite"/);
  assert.match(experience, /aria-atomic="true"/);
  assert.match(experience, /Capítulo \{activeChapter\.number\}/);
  assert.match(experience, /ANTERIOR/);
  assert.match(experience, /PRÓXIMO/);
  assert.match(experience, /prefetch=\{false\}/);
  assert.doesNotMatch(experience, /scrollIntoView|scrollTo|\.focus\(/);
});

test("orquestração cliente permanece pequena e delega as demonstrações", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /DoctrineChapterDemo/);
  assert.match(experience, /foundationIntegrated/);
  assert.match(experience, /doctrine-ux-enhancements\.module\.css/);
  assert.doesNotMatch(experience, /DoctrineMark|styles\.topbar|GameDie|GuideBoardScene|TerritoryCardArtwork/);
});

test("demonstrações reutilizam assets reais e explicam negociação sem confundir com resgate", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");

  assert.match(demos, /GuideBoardScene/);
  assert.match(demos, /GuideTradeScene/);
  assert.match(demos, /GameDie/);
  assert.match(demos, /TerritoryCardArtwork/);
  assert.match(demos, /presentation\.playerTrade\.offerLimitPerTurn/);
  assert.match(demos, /presentation\.playerTrade\.signalLimitPerTurn/);
  assert.match(demos, /NEGOCIAÇÃO ≠ RESGATE/);
  assert.match(demos, /presentation\.objectiveFormats/);
  assert.match(demos, /chapter\.metrics/);
  assert.match(demos, /presentation\.conquest/);
  assert.match(demos, /presentation\.maneuver/);
  assert.match(demos, /presentation\.anomalies/);
  assert.match(demos, /case "trade"/);
  assert.match(demos, /<figcaption>/);
  assert.match(demos, /ariaLabel=/);
  assert.doesNotMatch(demos, /const\s+types\s*=|const\s+phases\s*=/);
  assert.doesNotMatch(demos, /Canvas|@react-three|three\//i);
});

test("layout da Doutrina mantém índice persistente, recompõe mobile e respeita reduced motion", () => {
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
  );
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );
  const integrationCss = source(
    "src/components/doctrine/doctrine-foundation-integration.module.css",
  );

  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.chapterNav[\s\S]*overflow-x: auto/);
  assert.match(css, /min-height: 44px/);
  assert.match(uxCss, /top: var\(--command-content-top/);
  assert.match(uxCss, /100dvh/);
  assert.match(uxCss, /overflow-y: auto/);
  assert.match(uxCss, /view-transition-name: doctrine-chapter/);
  assert.match(uxCss, /data-doctrine-direction="forward"/);
  assert.match(uxCss, /data-doctrine-direction="backward"/);
  assert.match(uxCss, /grid-template-columns: repeat\(4/);
  assert.match(uxCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(integrationCss, /rgb\(5 10 8 \/ 68%\)/);
  assert.match(integrationCss, /@media \(max-width: 760px\)/);
  assert.match(integrationCss, /@media \(prefers-reduced-motion: reduce\)/);
});
