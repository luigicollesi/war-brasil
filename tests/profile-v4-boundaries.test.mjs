import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 loading boundary no longer renders the legacy command shell", async () => {
  const loading = await source("src/app/profile/loading.tsx");

  assert.match(loading, /ProfileV4Boundary/);
  assert.match(loading, /variant="loading"/);
  assert.doesNotMatch(loading, /ProfileSceneBridge|ProfileBoundaryState/);
});

test("PROFILE V4 error boundary stays generic and retryable", async () => {
  const error = await source("src/app/profile/error.tsx");

  assert.match(error, /ProfileV4Boundary/);
  assert.match(error, /variant="error"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.doesNotMatch(error, /error\.message|error\.stack|digest/);
});

test("PROFILE V4 boundary uses the same local coin identity without synthesizing a balance", async () => {
  const boundary = await source("src/components/profile/v4/profile-v4-boundary.tsx");

  assert.match(boundary, /src="\/coin\.svg"/);
  assert.doesNotMatch(boundary, />\s*0\s*</);
  assert.doesNotMatch(boundary, /◈/);
});