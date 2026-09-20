import assert from "node:assert/strict";
import test from "node:test";

import {
  patchNextServerSource,
} from "../scripts/patch-next-cloudflare-middleware-manifest.mjs";

const vulnerableFixture = `
const _loadmanifestexternal = require("./load-manifest.external");
class NextNodeServer {
  getMiddlewareManifest() {
    if (this.minimalMode) {
      return null;
    } else {
      const manifest = require(this.middlewareManifestPath);
      return manifest;
    }
  }
}
`;

test("Cloudflare patch troca require dinâmico do middleware manifest por loadManifest", () => {
  const result = patchNextServerSource(vulnerableFixture);

  assert.equal(result.changed, true);
  assert.doesNotMatch(
    result.source,
    /require\(this\.middlewareManifestPath\)/,
  );
  assert.match(
    result.source,
    /_loadmanifestexternal\.loadManifest\)\(this\.middlewareManifestPath\)/,
  );
});

test("Cloudflare patch é idempotente", () => {
  const first = patchNextServerSource(vulnerableFixture);
  const second = patchNextServerSource(first.source);

  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});

test("Cloudflare patch falha alto quando o layout compilado do Next muda", () => {
  assert.throws(
    () =>
      patchNextServerSource(
        'const other = require("./something-else"); const manifest = require(this.middlewareManifestPath);',
      ),
    /load-manifest\.external não encontrado/,
  );

  assert.throws(
    () =>
      patchNextServerSource(
        'const _loadmanifestexternal = require("./load-manifest.external");',
      ),
    /esperado exatamente 1 require/,
  );
});
