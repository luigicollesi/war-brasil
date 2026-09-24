import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("src/components/profile/v4/profile-shell.tsx", "utf8");
const shellStyles = readFileSync(
  "src/components/profile/v4/profile-shell.module.css",
  "utf8",
);
const boundary = readFileSync(
  "src/components/profile/v4/profile-v4-boundary.tsx",
  "utf8",
);
const boundaryStyles = readFileSync(
  "src/components/profile/v4/profile-v4-boundary.module.css",
  "utf8",
);

test("profile, arsenal and store use a contained SVG back arrow", () => {
  assert.match(shell, /className=\{styles\.homeIcon\}/);
  assert.match(shell, /viewBox="0 0 24 24"/);
  assert.match(shell, /<path d="M14\.5 5\.5 8 12l6\.5 6\.5M8\.5 12H19"/);

  assert.match(shellStyles, /\.homeLink[\s\S]*overflow:\s*hidden/);
  assert.match(shellStyles, /\.homeIcon[\s\S]*width:\s*22px/);
  assert.match(shellStyles, /\.homeIcon[\s\S]*height:\s*22px/);
  assert.match(shellStyles, /stroke-width:\s*1\.9/);
});

test("mobile profile header keeps the arrow large inside the 36px frame", () => {
  assert.match(
    shellStyles,
    /@media \(max-width: 620px\)[\s\S]*\.homeLink[\s\S]*width:\s*36px[\s\S]*height:\s*36px/,
  );
  assert.match(
    shellStyles,
    /@media \(max-width: 620px\)[\s\S]*\.homeIcon[\s\S]*width:\s*21px[\s\S]*height:\s*21px/,
  );
});

test("profile loading and error boundaries use the same arrow geometry", () => {
  assert.match(boundary, /className=\{styles\.homeIcon\}/);
  assert.match(boundary, /viewBox="0 0 24 24"/);
  assert.match(boundaryStyles, /\.homeLink[\s\S]*overflow:\s*hidden/);
  assert.match(boundaryStyles, /\.homeIcon[\s\S]*width:\s*22px/);
  assert.match(boundaryStyles, /stroke-width:\s*1\.9/);
});
