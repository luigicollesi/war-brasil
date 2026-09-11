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
  for (const required of [
    "preparacao",
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
  const attack = doctrine.chapters.find((chapter) => chapter.slug === "ataque");
  const barriers = doctrine.chapters.find(
    (chapter) => chapter.slug === "barreiras-conexoes",
  );
  const events = doctrine.chapters.find((chapter) => chapter.slug === "anomalias");

  assert.ok(attack);
  assert.ok(barriers);
  assert.ok(events);
  assert.equal(doctrine.combatExample.attackerLosses, 1);
  assert.equal(doctrine.combatExample.defenderLosses, 1);
  assert.equal(doctrine.cards.mandatoryTradeHandSize, 5);
  assert.equal(doctrine.cards.ownedTerritoryBonus, 2);
  assert.equal(doctrine.barrier.attackerLossPerComparison, 3);
  assert.equal(doctrine.barrier.maneuverLoss, 1);
  assert.equal(doctrine.barrier.blockedBarrierCount, 2);
  assert.match(events.lede, /38 estados de evento/);

  const presentationSource = source("src/lib/doctrine-presentation.ts");
  assert.match(presentationSource, /buildGameGuidePresentation/);
  assert.match(presentationSource, /EVENT_COUNT/);
  assert.match(presentationSource, /JURASSIC_TUNNEL_SOURCE_ID/);
  assert.doesNotMatch(
    presentationSource,
    /const\s+(?:MIN_TERRITORY_TROOPS|MANDATORY_TRADE_HAND_SIZE|OWNED_TERRITORY_CARD_BONUS)\s*=/,
  );
});

test("/rules resolve deep-link no servidor dentro da Foundation sem depender de Canvas", () => {
  const page = source("src/app/rules/page.tsx");

  assert.match(page, /await searchParams/);
  assert.match(page, /isDoctrineChapterSlug/);
  assert.match(page, /buildDoctrinePresentation/);
  assert.match(page, /<CommandShell/);
  assert.match(page, /intent=\{DOCTRINE_SCENE_INTENT\}/);
  assert.match(page, /sectionLabel="DOUTRINA"/);
  assert.match(page, /<DoctrineExperience/);
  assert.match(page, /canonical: "\/rules"/);
  assert.doesNotMatch(page, /Canvas|@react-three|three\//i);
});

test("Doutrina emite somente intenção semântica para a Foundation", () => {
  const intent = source("src/components/doctrine/doctrine-scene-intent.ts");
  const page = source("src/app/rules/page.tsx");

  assert.match(intent, /mode: "doctrine"/);
  assert.match(intent, /focus: "brazil"/);
  assert.match(intent, /territoryExplode: 0\.18/);
  assert.match(intent, /satisfies CommandSceneIntent/);
  assert.doesNotMatch(intent, /camera|quaternion|fov|position|\bx:|\by:|\bz:/i);
  assert.doesNotMatch(page, /CommandScene|CameraDirector|@react-three|three\//i);
});

test("índice usa links reais e troca de capítulo preserva foco e scroll", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /`\/rules\?chapter=\$\{slug\}`/);
  assert.match(experience, /window\.history\.pushState/);
  assert.match(experience, /popstate/);
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
  assert.doesNotMatch(experience, /DoctrineMark|styles\.topbar|GameDie|GuideBoardScene|TerritoryCardArtwork/);
});

test("demonstrações reutilizam mapa, dados e cartas reais com equivalente textual", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");

  assert.match(demos, /GuideBoardScene/);
  assert.match(demos, /GameDie/);
  assert.match(demos, /TerritoryCardArtwork/);
  assert.match(demos, /<figcaption>/);
  assert.match(demos, /ariaLabel=/);
  assert.doesNotMatch(demos, /Canvas|@react-three|three\//i);
});

test("layout da Doutrina recompõe mobile, preserva a cena compartilhada e respeita reduced motion", () => {
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
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
  assert.match(integrationCss, /rgb\(5 10 8 \/ 68%\)/);
  assert.match(integrationCss, /@media \(max-width: 760px\)/);
  assert.match(integrationCss, /@media \(prefers-reduced-motion: reduce\)/);
});
