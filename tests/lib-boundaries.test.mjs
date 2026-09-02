import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function sourceFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

function assertNoPattern(paths, pattern, message) {
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, pattern, `${message}: ${path}`);
  }
}

const clientFiles = sourceFiles("src/lib/client");
const serverFiles = sourceFiles("src/lib/server");
const sharedFiles = sourceFiles("src/lib/shared");
const apiFiles = sourceFiles("src/app/api");

test("shared permanece independente de client, server, framework, browser e banco", () => {
  assertNoPattern(sharedFiles, /(?:@\/|\.\.\/)(?:client|server)(?:\/|["'])/, "shared cruzou fronteira");
  assertNoPattern(sharedFiles, /from ["'](?:react|next(?:\/[^"']*)?|pg)["']/i, "shared importou runtime proibido");
  assertNoPattern(sharedFiles, /["']server-only["']/, "shared marcou server-only");
  assertNoPattern(sharedFiles, /\b(?:window|document)\b/, "shared acessou browser");
});

test("client não depende da implementação server-side", () => {
  assertNoPattern(clientFiles, /(?:@\/server\/|\.\.\/server\/)/, "client importou server");
  assertNoPattern(clientFiles, /from ["']pg["']/i, "client importou PostgreSQL");
  assertNoPattern(clientFiles, /["']server-only["']/, "client marcou server-only");
});

test("server não depende da implementação client-side", () => {
  assertNoPattern(serverFiles, /(?:@\/client\/|\.\.\/client\/)/, "server importou client");
  assertNoPattern(serverFiles, /from ["']react["']/i, "server importou React");
});

test("route handlers não dependem de libs client-side", () => {
  assertNoPattern(apiFiles, /(?:@\/client\/|@\/src\/lib\/client\/)/, "API importou client");
});
