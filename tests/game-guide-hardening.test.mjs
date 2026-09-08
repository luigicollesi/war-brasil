import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const sectionDirectory = "src/components/game-guide/sections";
const sectionFiles = readdirSync(sectionDirectory)
  .filter((file) => file.endsWith(".tsx"))
  .sort();
const sectionSources = sectionFiles.map((file) => ({
  file,
  content: source(`${sectionDirectory}/${file}`),
}));

const guideStyles = [
  "src/app/war-guide.css",
  "src/app/war-guide-primitives.css",
  "src/app/war-guide-geographic.css",
  "src/app/war-guide-regions.css",
  "src/app/war-guide-sections.css",
  "src/app/war-guide-final-sections.css",
  "src/app/war-guide-scenes.css",
  "src/app/war-guide-responsive.css",
].map(source).join("\n");

test("guia final não carrega folhas ou seletores legados das versões intermediárias", () => {
  const layout = source("src/app/layout.tsx");
  const legacySelectors = [
    ".wb-guide-turn-flow",
    ".wb-guide-rule-grid",
    ".wb-guide-rule-number",
    ".wb-guide-dice-versus",
    ".wb-guide-route-chain",
    ".wb-guide-barrier-row",
    ".wb-guide-barrier-line",
    ".wb-guide-card-rules",
    ".wb-guide-card-preview",
    ".wb-guide-order-caption",
    ".wb-guide-attack-checks",
    ".wb-guide-attack-blockers",
    ".wb-guide-combat-rule",
    ".wb-guide-maneuver-barriers",
    ".wb-guide-card-combination-note",
  ];

  assert.doesNotMatch(layout, /war-guide-barrier-refresh\.css/);
  for (const selector of legacySelectors) {
    assert.ok(!guideStyles.includes(selector), `${selector} não deve permanecer no CSS final`);
  }
});

test("seções dependem da camada de apresentação e não de serviços ou regras de domínio", () => {
  const forbiddenImports = [
    /@\/src\/lib\/game-rules/,
    /@\/src\/lib\/game-barrier-rules/,
    /@\/src\/lib\/game-trade-rules/,
    /@\/src\/lib\/game-command-service/,
    /@\/src\/lib\/game-.*-command-service/,
    /@\/src\/lib\/game-battle-service/,
    /@\/src\/lib\/game-objective-service/,
    /@\/src\/lib\/game-round-service/,
  ];

  for (const { file, content } of sectionSources) {
    for (const pattern of forbiddenImports) {
      assert.doesNotMatch(content, pattern, `${file} não deve importar regras/serviços diretamente`);
    }
    assert.doesNotMatch(content, /onClick=|onPointer|onMouse/, `${file} deve ensinar o jogo, não implementar interação`);
  }

  const main = source("src/components/game-guide/game-quick-guide.tsx");
  assert.match(main, /buildGameGuidePresentation/);
  assert.doesNotMatch(main, /game-rules|game-barrier-rules|game-trade-rules|command-service/);
});

test("cenas visuais usam exclusivamente o mapa 2D de produção", () => {
  const boardScene = source("src/components/game-guide/guide-board-scene.tsx");
  const setup = source(`${sectionDirectory}/guide-setup-section.tsx`);
  const allGuideComponents = [
    boardScene,
    setup,
    ...sectionSources.map(({ content }) => content),
  ].join("\n");

  assert.match(boardScene, /\/war-brasil-42\.production\.svg/);
  assert.match(setup, /\/war-brasil-42\.production\.svg/);
  assert.doesNotMatch(allGuideComponents, /25d|2\.5d|mapa-war-brasil-25d/i);
});

test("estrutura semântica do manual permanece acessível depois da limpeza", () => {
  const heading = source("src/components/game-guide/guide-heading.tsx");
  const flow = source("src/components/game-guide/guide-flow.tsx");
  const stateChange = source("src/components/game-guide/guide-state-change.tsx");
  const connection = source("src/components/game-guide/guide-connection.tsx");
  const boardScene = source("src/components/game-guide/guide-board-scene.tsx");
  const mapExamples = source("src/components/game-guide/guide-map-examples.tsx");
  const reinforcement = source(`${sectionDirectory}/guide-reinforcement-section.tsx`);
  const barrier = source(`${sectionDirectory}/guide-barrier-section.tsx`);

  for (const { file, content } of sectionSources) {
    assert.match(content, /<article/, `${file} deve manter uma região semântica própria`);
  }

  assert.match(heading, /<h2>/);
  assert.match(heading, /<p>/);
  assert.match(flow, /<ol/);
  assert.match(stateChange, /<figure/);
  assert.match(stateChange, /<figcaption/);
  assert.match(connection, /role="img"/);
  assert.match(boardScene, /<figure/);
  assert.match(boardScene, /aria-label/);
  assert.match(mapExamples, /<figure/);
  assert.match(mapExamples, /role="img"/);
  assert.match(reinforcement, /scope="col"/);
  assert.match(reinforcement, /scope="row"/);
  assert.match(barrier, /alt=""/);
});

test("responsividade final não referencia estruturas removidas pelo polimento editorial", () => {
  const responsive = source("src/app/war-guide-responsive.css");
  const sections = source("src/app/war-guide-sections.css");
  const finalSections = source("src/app/war-guide-final-sections.css");
  const scenes = source("src/app/war-guide-scenes.css");

  assert.doesNotMatch(responsive, /wb-guide-card-rules|wb-guide-combat-rule|wb-guide-maneuver-barriers/);
  assert.doesNotMatch(sections, /wb-guide-attack-checks|wb-guide-attack-blockers|wb-guide-combat-rule/);
  assert.doesNotMatch(finalSections, /wb-guide-maneuver-barriers|wb-guide-card-combination-note/);
  assert.match(scenes, /@media \(max-width: 700px\)/);
  assert.match(scenes, /prefers-reduced-motion/);
});
