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

test("/rules resolve deep-link no servidor sem depender de Canvas", () => {
  const page = source("src/app/rules/page.tsx");

  assert.match(page, /await searchParams/);
  assert.match(page, /isDoctrineChapterSlug/);
  assert.match(page, /buildDoctrinePresentation/);
  assert.match(page, /<DoctrineExperience/);
  assert.match(page, /canonical: "\/rules"/);
  assert.doesNotMatch(page, /Canvas|@react-three|three\//i);
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
  assert.doesNotMatch(experience, /GameDie|GuideBoardScene|TerritoryCardArtwork/);
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

test("layout da Doutrina recompõe mobile e respeita reduced motion", () => {
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
  );

  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.chapterNav[\s\S]*overflow-x: auto/);
  assert.match(css, /min-height: 44px/);
});
