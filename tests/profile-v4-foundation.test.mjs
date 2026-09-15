import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const COMPONENTS = [
  "src/components/profile/v4/profile-shell.tsx",
  "src/components/profile/v4/profile-dossier.tsx",
  "src/components/profile/v4/profile-arsenal.tsx",
  "src/components/profile/v4/profile-store.tsx",
  "src/components/profile/v4/profile-economy-unavailable.tsx",
];
const STYLES = [
  "src/components/profile/v4/profile-shell.module.css",
  "src/components/profile/v4/profile-dossier.module.css",
  "src/components/profile/v4/profile-arsenal.module.css",
  "src/components/profile/v4/profile-store.module.css",
];

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 uses the semantic Foundation boundary and never imports Three/R3F", async () => {
  const sources = await Promise.all(COMPONENTS.map(source));
  const combined = sources.join("\n");

  assert.match(combined, /useCommandSceneDirective/);
  assert.doesNotMatch(combined, /from\s+["']three["']/);
  assert.doesNotMatch(combined, /@react-three\/fiber|@react-three\/rapier/);
  assert.doesNotMatch(combined, /<Canvas\b/);
});

test("PROFILE V4 visual surfaces provide reduced-motion rules", async () => {
  const sources = await Promise.all(STYLES.map(source));
  for (const css of sources) {
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
  }
});
