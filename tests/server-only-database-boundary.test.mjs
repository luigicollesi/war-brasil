import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(full));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(extname(full))) files.push(full);
  }
  return files;
}

function projectPath(file) {
  return relative(ROOT, file).split(sep).join("/");
}

function isClientModule(source) {
  return /^\s*["']use client["'];/m.test(source);
}

function importsServerRuntime(source) {
  return (
    /from\s+["'][^"']*\/lib\/server(?:\/|["'])/.test(source) ||
    /import\s*\(\s*["'][^"']*\/lib\/server(?:\/|["'])/.test(source)
  );
}

function importsDatabaseDriver(source) {
  return (
    /from\s+["']pg["']/.test(source) ||
    /require\(\s*["']pg["']\s*\)/.test(source) ||
    /@neondatabase\/serverless/.test(source) ||
    /from\s+["']postgres["']/.test(source)
  );
}

function importsDatabasePool(source) {
  return (
    /from\s+["'][^"']*\/db\/(?:pool|runtime-pool|connection-string)["']/.test(source) ||
    /from\s+["'][^"']*\/auth\/auth-pool["']/.test(source)
  );
}

function readsDatabaseEnvironment(source) {
  return /process\.env\.(?:DATABASE_URL|AUTH_DATABASE_URL|DATABASE_HYPERDRIVE_URL|CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_[A-Z0-9_]+)/.test(
    source,
  );
}

test("client modules cannot import server runtime, database drivers, pools, or database secrets", () => {
  const violations = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    if (!isClientModule(source)) continue;

    if (
      importsServerRuntime(source) ||
      importsDatabaseDriver(source) ||
      importsDatabasePool(source) ||
      readsDatabaseEnvironment(source)
    ) {
      violations.push(projectPath(file));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Client-side database boundary violations:\n${violations.join("\n")}`,
  );
});

test("direct database drivers and connection configuration stay inside server-only modules", () => {
  const violations = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    if (
      !importsDatabaseDriver(source) &&
      !importsDatabasePool(source) &&
      !readsDatabaseEnvironment(source)
    ) {
      continue;
    }

    const path = projectPath(file);
    const isServerLibrary = path.startsWith("src/lib/server/");
    const isServerRoute = path.startsWith("src/app/api/") && path.endsWith("/route.ts");

    if (!isServerLibrary && !isServerRoute) {
      violations.push(path);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Direct database access escaped server-only areas:\n${violations.join("\n")}`,
  );
});

test("database-capable server modules explicitly import server-only", () => {
  const violations = [];

  for (const file of sourceFiles(join(SRC, "lib", "server"))) {
    const source = readFileSync(file, "utf8");
    if (
      !importsDatabaseDriver(source) &&
      !importsDatabasePool(source) &&
      !readsDatabaseEnvironment(source)
    ) {
      continue;
    }

    if (!/import\s+["']server-only["'];/.test(source)) {
      violations.push(projectPath(file));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Database modules missing explicit server-only guard:\n${violations.join("\n")}`,
  );
});
