import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCommanderIdentityWriteDto,
  validateCommanderDisplayNameDraft,
  validateCommanderHandleDraft,
  validateCommanderIdentityDraft,
} from "../.test-build/profile/commander-name-contract.js";

test("commander name DTO accepts canonical public identity", () => {
  const result = validateCommanderIdentityDraft({
    handle: "luigi.collesi",
    displayName: "Luigi Collesi",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    handle: "luigi.collesi",
    displayName: "Luigi Collesi",
  });
});

test("commander handle rejects edge and repeated separators before request", () => {
  for (const handle of [
    "_luigi",
    "luigi_",
    "luigi..collesi",
    "luigi__collesi",
    "luigi--collesi",
    "luigi.-collesi",
  ]) {
    assert.equal(validateCommanderHandleDraft(handle).ok, false, handle);
  }
});

test("commander display name normalizes compatibility width and spaces", () => {
  const result = validateCommanderDisplayNameDraft("  Ｌｕｉｇｉ   Collesi  ");
  assert.deepEqual(result, {
    ok: true,
    value: "Luigi Collesi",
    error: null,
  });
});

test("commander display name rejects hidden controls and symbols outside identity grammar", () => {
  assert.equal(validateCommanderDisplayNameDraft("Luigi\u200BAdmin").ok, false);
  assert.equal(validateCommanderDisplayNameDraft("Luigi\nAdmin").ok, false);
  assert.equal(validateCommanderDisplayNameDraft("Luigi 🚀").ok, false);
});

test("commander identity DTO rejects unexpected fields", () => {
  const result = parseCommanderIdentityWriteDto({
    handle: "luigi",
    displayName: "Luigi",
    userId: "forged",
  });

  assert.equal(result.ok, false);
});

test("commander display name keeps legitimate accented and non-Latin names", () => {
  for (const name of ["João Silva", "O’Connor", "佐藤"]) {
    assert.equal(validateCommanderDisplayNameDraft(name).ok, true, name);
  }
});


test("commander display name rejects punctuation-only identity", () => {
  assert.equal(validateCommanderDisplayNameDraft("__").ok, false);
  assert.equal(validateCommanderDisplayNameDraft("--").ok, false);
});
