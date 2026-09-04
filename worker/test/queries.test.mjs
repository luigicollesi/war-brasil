import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAIM_DUE_AUTOMATION_SQL,
  DUE_AUTOMATION_SQL,
  RELEASE_AUTOMATION_CLAIM_SQL,
} from "../queries.mjs";

test("shadow worker lê somente agendas vencidas e ordenadas", () => {
  assert.match(DUE_AUTOMATION_SQL, /automation_due_at IS NOT NULL/);
  assert.match(DUE_AUTOMATION_SQL, /automation_due_at <= NOW\(\)/);
  assert.match(DUE_AUTOMATION_SQL, /ORDER BY automation_due_at,id/);
  assert.match(DUE_AUTOMATION_SQL, /LIMIT \$1/);
  assert.match(DUE_AUTOMATION_SQL, /due_lag_ms/);
  assert.doesNotMatch(DUE_AUTOMATION_SQL, /UPDATE|DELETE|FOR UPDATE/i);
});

test("active worker faz claim atômico com SKIP LOCKED e lease recuperável", () => {
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /FOR UPDATE SKIP LOCKED/);
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /automation_claimed_until IS NULL/);
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /automation_claimed_until <= NOW\(\)/);
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /automation_claimed_by=\$2/);
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /INTERVAL '1 millisecond'/);
  assert.match(CLAIM_DUE_AUTOMATION_SQL, /recovered_expired_claim/);
});

test("claim só pode ser liberado pela instância que o possui", () => {
  assert.match(RELEASE_AUTOMATION_CLAIM_SQL, /WHERE id=\$1/);
  assert.match(RELEASE_AUTOMATION_CLAIM_SQL, /automation_claimed_by=\$2/);
  assert.match(RELEASE_AUTOMATION_CLAIM_SQL, /automation_claimed_by=NULL/);
  assert.match(RELEASE_AUTOMATION_CLAIM_SQL, /automation_claimed_until=NULL/);
});
