import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("cenas do manual usam explicitamente o mapa 2D e nunca o mapa 2.5D", () => {
  const boardScene = source("src/components/game-guide/guide-board-scene.tsx");
  const guideFiles = [
    boardScene,
    source("src/components/game-guide/guide-map-examples.tsx"),
    ...readdirSync("src/components/game-guide/sections")
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => source(`src/components/game-guide/sections/${file}`)),
  ].join("\n");

  assert.match(boardScene, /src="\/war-brasil-42\.production\.svg"/);
  assert.doesNotMatch(guideFiles, /mapa-war-brasil-25d|2\.5d/i);
});

test("ataque, conquista e manobra compartilham a mesma cena de tabuleiro", () => {
  const attack = source("src/components/game-guide/sections/guide-attack-section.tsx");
  const conquest = source("src/components/game-guide/sections/guide-conquest-section.tsx");
  const maneuver = source("src/components/game-guide/sections/guide-maneuver-section.tsx");

  for (const section of [attack, conquest, maneuver]) {
    assert.match(section, /GuideBoardScene/);
    assert.doesNotMatch(section, /GuideTerritoryNode/);
  }

  assert.match(attack, /kind: "attack"/);
  assert.match(conquest, /conquistar \+ mover 2/);
  assert.match(maneuver, /A → B → C/);
  assert.match(maneuver, /status: "moved"/);
});

test("negociação é representada com jogadores, termos e cartas reais", () => {
  const turn = source("src/components/game-guide/sections/guide-turn-section.tsx");
  const tradeScene = source("src/components/game-guide/guide-trade-scene.tsx");

  assert.match(turn, /GuideTradeScene/);
  assert.match(turn, /guide\.playerTrade\.offerLimitPerTurn/);
  assert.match(turn, /guide\.playerTrade\.signalLimitPerTurn/);
  assert.match(tradeScene, /TerritoryCardArtwork/);
  assert.match(tradeScene, /Símbolo ouro/);
  assert.match(tradeScene, /Símbolo água/);
  assert.match(tradeScene, /Seleção privada/);
  assert.match(tradeScene, /troca concluída/);
});

test("cenas são passivas, acessíveis e respeitam redução de movimento", () => {
  const boardScene = source("src/components/game-guide/guide-board-scene.tsx");
  const tradeScene = source("src/components/game-guide/guide-trade-scene.tsx");
  const styles = source("src/app/war-guide-scenes.css");
  const layout = source("src/app/layout.tsx");

  assert.match(boardScene, /role="img"/);
  assert.match(boardScene, /aria-label=\{ariaLabel\}/);
  assert.match(tradeScene, /role="img"/);
  assert.doesNotMatch(`${boardScene}\n${tradeScene}`, /onClick=|onPointer|onMouse/);
  assert.match(styles, /prefers-reduced-motion: no-preference/);
  assert.ok(
    layout.indexOf('war-guide-scenes.css') < layout.indexOf('war-guide-responsive.css'),
    "os estilos responsivos precisam continuar por último",
  );
});
