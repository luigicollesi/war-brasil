import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const harness = String.raw`
const fs = require("node:fs");
const policy = require("./.test-build/server/profile/commander-name-policy.js");
const blocklist = require("./.test-build/server/profile/commander-name-blocklist.js");

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const results = input.cases.map(({ field, value }) => {
  try {
    if (field === "handle") {
      policy.assertCommanderHandleAllowed(value);
    } else {
      policy.assertCommanderDisplayNameAllowed(value);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: error && typeof error === "object" && "code" in error ? error.code : null,
      field: error && typeof error === "object" && "field" in error ? error.field : null,
      message:
        error && typeof error === "object" && "publicMessage" in error
          ? error.publicMessage
          : String(error),
    };
  }
});

process.stdout.write(JSON.stringify({
  results,
  counts: {
    displayRoles: blocklist.RESERVED_COMMANDER_DISPLAY_ROLE_WORDS.size,
    handleRoles: blocklist.RESERVED_COMMANDER_HANDLE_ROLE_WORDS.size,
    reservedKeys: blocklist.RESERVED_COMMANDER_NAME_KEYS.size,
    blockedWords: blocklist.BLOCKED_COMMANDER_WORDS.size,
    compactTerms: blocklist.BLOCKED_COMMANDER_COMPACT_TERMS.size,
  },
}));
`;

function evaluate(cases) {
  const run = spawnSync(
    process.execPath,
    ["--conditions=react-server", "-e", harness],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: JSON.stringify({ cases }),
    },
  );

  assert.equal(
    run.status,
    0,
    `policy harness failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
  );
  return JSON.parse(run.stdout);
}

test("commander name exclusions keep a broad server-only catalog", () => {
  const { counts } = evaluate([]);

  assert.ok(counts.displayRoles >= 15, counts);
  assert.ok(counts.handleRoles >= 40, counts);
  assert.ok(counts.reservedKeys >= 55, counts);
  assert.ok(counts.blockedWords >= 110, counts);
  assert.ok(counts.compactTerms >= 8, counts);
});

test("commander policy allows legitimate names without substring false positives", () => {
  const cases = [
    { field: "displayName", value: "Luigi Collesi" },
    { field: "displayName", value: "João Silva" },
    { field: "displayName", value: "O’Connor" },
    { field: "displayName", value: "佐藤" },
    { field: "displayName", value: "Мария Иванова" },
    { field: "displayName", value: "Modesto" },
    { field: "displayName", value: "Stafford" },
    { field: "displayName", value: "Supporter" },
    { field: "displayName", value: "Devon Miles" },
    { field: "displayName", value: "Scunthorpe" },
    { field: "displayName", value: "Sporn" },
    { field: "handle", value: "modesto" },
    { field: "handle", value: "stafford" },
    { field: "handle", value: "supporter" },
    { field: "handle", value: "devon.miles" },
  ];

  const { results } = evaluate(cases);
  results.forEach((result, index) => {
    assert.equal(result.ok, true, `${cases[index].value}: ${JSON.stringify(result)}`);
  });
});

test("commander policy blocks platform impersonation and reserved operational roles", () => {
  const cases = [
    { field: "displayName", value: "Admin Luigi" },
    { field: "displayName", value: "Suporte Oficial" },
    { field: "displayName", value: "Security Team" },
    { field: "displayName", value: "Root" },
    { field: "handle", value: "developer" },
    { field: "handle", value: "verified" },
    { field: "handle", value: "bellum.civile" },
    { field: "handle", value: "war-brasil" },
    { field: "displayName", value: "Bellum Civile Oficial" },
    { field: "displayName", value: "War Brasil Staff" },
  ];

  const { results } = evaluate(cases);
  results.forEach((result, index) => {
    assert.equal(result.ok, false, cases[index].value);
    assert.equal(result.code, "RESERVED_NAME", cases[index].value);
  });
});

test("commander policy blocks profanity and common evasion variants", () => {
  const cases = [
    { field: "handle", value: "p0rr4" },
    { field: "handle", value: "c4r4lh0" },
    { field: "handle", value: "f.u.c.k" },
    { field: "handle", value: "fuuuck" },
    { field: "handle", value: "5lut" },
    { field: "displayName", value: "P 0 R R 4" },
    { field: "displayName", value: "F.u.c.k" },
    { field: "displayName", value: "N A Z I" },
    { field: "displayName", value: "heil-hitler" },
    { field: "displayName", value: "white_power_88" },
    { field: "displayName", value: "pedophiliaFan" },
    { field: "displayName", value: "child-porn-hub" },
  ];

  const { results } = evaluate(cases);
  results.forEach((result, index) => {
    assert.equal(result.ok, false, cases[index].value);
    assert.equal(result.code, "NAME_NOT_ALLOWED", cases[index].value);
  });
});

test("commander policy rejects Latin-Cyrillic-Greek spoofing inside one token", () => {
  const cases = [
    { field: "displayName", value: "Аdmin" },
    { field: "displayName", value: "pаypal" },
    { field: "displayName", value: "Mοderator" },
  ];

  const { results } = evaluate(cases);
  results.forEach((result, index) => {
    assert.equal(result.ok, false, cases[index].value);
    assert.equal(result.code, "SUSPICIOUS_UNICODE", cases[index].value);
  });
});

test("commander moderation responses do not disclose the matched exclusion", () => {
  const cases = [
    { field: "displayName", value: "Admin" },
    { field: "displayName", value: "p0rr4" },
  ];

  const { results } = evaluate(cases);
  for (const result of results) {
    assert.equal(result.ok, false);
    assert.match(result.message, /não pode ser utilizado/i);
    assert.doesNotMatch(result.message, /admin|porra|p0rr4/i);
  }
});
