import assert from "node:assert/strict";
import test from "node:test";
import { DUE_AUTOMATION_SQL } from "../queries.mjs";

test("shadow worker lê somente agendas vencidas e ordenadas", () => {
  assert.match(DUE_AUTOMATION_SQL, /automation_due_at IS NOT NULL/);
  assert.match(DUE_AUTOMATION_SQL, /automation_due_at <= NOW\(\)/);
  assert.match(DUE_AUTOMATION_SQL, /ORDER BY automation_due_at,id/);
  assert.match(DUE_AUTOMATION_SQL, /LIMIT \$1/);
  assert.match(DUE_AUTOMATION_SQL, /due_lag_ms/);
  assert.doesNotMatch(DUE_AUTOMATION_SQL, /UPDATE|DELETE|FOR UPDATE/i);
});
