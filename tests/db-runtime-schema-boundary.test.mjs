import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";

const RUNTIME_ROOTS = ["src/lib/server", "src/app/api", "realtime", "worker"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const EXCLUDED_DIRECTORIES = new Set(["node_modules", "test", "tests"]);

const LEGACY_RELATIONS = [
  "game_rooms",
  "room_players",
  "game_territories",
  "game_order_rolls",
  "game_rematch_votes",
  "game_player_objectives",
  "game_cards",
  "game_player_trade_offers",
  "game_round_events",
  "objectives",
  "objective_rules",
  "events",
  "event_connections",
  "bot_names",
  "game_command_receipts",
  "territory_card_symbols",
  "territory_connections",
];

const relationAlternation = LEGACY_RELATIONS.join("|");
const LEGACY_SQL_RELATION = new RegExp(
  String.raw`\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+(?:public\.)?(?:${relationAlternation})\b`,
  "gi",
);
const EXPLICIT_PUBLIC_RELATION = new RegExp(
  String.raw`\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+public\.[a-z_][a-z0-9_]*\b`,
  "gi",
);

function runtimeFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      files.push(...runtimeFiles(join(root, entry.name)));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(join(root, entry.name));
    }
  }
  return files;
}

function matchesFor(source, pattern) {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

test("runtime usa somente relações schema-qualified e não depende das views legadas de public", () => {
  const violations = [];

  for (const root of RUNTIME_ROOTS) {
    for (const path of runtimeFiles(root)) {
      const source = readFileSync(path, "utf8");
      const matches = new Set([
        ...matchesFor(source, LEGACY_SQL_RELATION),
        ...matchesFor(source, EXPLICIT_PUBLIC_RELATION),
      ]);

      for (const match of matches) {
        violations.push(`${relative(".", path)}: ${match}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `SQL de runtime ainda depende do schema public/legado:\n${violations.join("\n")}`,
  );
});
