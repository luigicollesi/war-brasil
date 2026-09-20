import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationsDir = "src/lib/db/migrations/managed";
const migrationNamePattern = /^\d{3}-[a-z0-9-]+\.sql$/;
const historyReferencePattern = /\bops\.pgmigrations\b/i;
const runner = readFileSync("scripts/prepare-dev-db.mjs", "utf8");

const migrations = readdirSync(migrationsDir)
  .filter((name) => migrationNamePattern.test(name))
  .sort((left, right) => left.localeCompare(right));

function upSql(name) {
  const source = readFileSync(`${migrationsDir}/${name}`, "utf8");
  const upMarker = "-- Up Migration";
  const downMarker = "-- Down Migration";
  const upIndex = source.indexOf(upMarker);
  assert.notEqual(upIndex, -1, `${name} sem ${upMarker}`);
  const downIndex = source.indexOf(downMarker, upIndex + upMarker.length);
  return source
    .slice(upIndex + upMarker.length, downIndex < 0 ? source.length : downIndex)
    .trim();
}

test("managed migrations are contiguous and the runner exclusively owns history writes", () => {
  assert.ok(migrations.length > 0);
  assert.equal(migrations[0].slice(0, 3), "026");

  for (let index = 0; index < migrations.length; index += 1) {
    const expected = String(26 + index).padStart(3, "0");
    assert.equal(migrations[index].slice(0, 3), expected, migrations[index]);
    assert.doesNotMatch(
      upSql(migrations[index]),
      historyReferencePattern,
      `${migrations[index]} must not read or write ops.pgmigrations`,
    );
  }

  assert.match(runner, /pg_advisory_xact_lock\(20260906, 26\)/);
  assert.match(runner, /assertManagedMigrationSequence\(files\)/);
  assert.match(runner, /migrationHistoryReferencePattern\.test\(sql\)/);
  assert.match(
    runner,
    /INSERT INTO ops\.pgmigrations\(name\) VALUES\(\$1\)/,
  );
});
