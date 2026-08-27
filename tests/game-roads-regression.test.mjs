import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("preferência de estradas vive fora do canvas e persiste no provider", () => {
  const provider = readFileSync(
    "src/components/road-visibility-provider.tsx",
    "utf8",
  );
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const page = readFileSync("src/app/game/[roomId]/page.tsx", "utf8");

  assert.match(provider, /war-brasil:roads-visible/);
  assert.match(provider, /window\.localStorage\.getItem/);
  assert.match(provider, /window\.localStorage\.setItem/);
  assert.match(provider, /aria-pressed=\{roadsVisible\}/);
  assert.match(page, /<RoadVisibilityProvider>/);
  assert.match(board, /useRoadVisibility\(\)/);
  assert.match(board, /roadsVisible \? \([\s\S]*?<RoadNetwork/);
  assert.doesNotMatch(board, /localStorage/);
  assert.doesNotMatch(board, /game-road-toggle/);
});
