import assert from "node:assert/strict";
import test from "node:test";
import { selectUsageProbe } from "../scripts/context/cpg-smoke.mjs";

test("CPG smoke probe derives stable usage and data-flow targets from Joern output", () => {
  const raw = {
    objectSlices: [
      {
        fullName: "src/example.ts::program:handler",
        slices: [
          {
            targetObj: { name: "payload" },
            definedBy: { name: "payload" },
            argToCalls: [
              { callName: "<operator>.assignment" },
              { callName: "persistPayload" }
            ]
          }
        ]
      }
    ]
  };

  assert.deepEqual(selectUsageProbe(raw), {
    usage: {
      variable: "payload",
      methodFullName: "src/example.ts::program:handler"
    },
    dataflowCall: "persistPayload"
  });
});

test("CPG smoke probe reports missing capabilities instead of inventing targets", () => {
  assert.deepEqual(selectUsageProbe({ objectSlices: [] }), {
    usage: null,
    dataflowCall: null
  });
});
