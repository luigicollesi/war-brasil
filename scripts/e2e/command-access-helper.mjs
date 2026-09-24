import assert from "node:assert/strict";
import { withE2EAuthCaptcha } from "./runtime-helper.mjs";

export const E2E_ELIGIBLE_BIRTH_DATE = "1990-01-01";

async function apiJson(page, url, init = {}) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, requestInit);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestUrl: url, requestInit: withE2EAuthCaptcha(url, init) },
  );
}

export async function completeCommanderAgeGate(
  page,
  birthDate = E2E_ELIGIBLE_BIRTH_DATE,
) {
  const age = await apiJson(page, "/api/auth/command-access/age", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ birthDate }),
  });
  assert.equal(age.status, 200, JSON.stringify(age.body));
  assert.equal(age.body?.ok, true, JSON.stringify(age.body));
  assert.equal(age.body?.eligible, true, JSON.stringify(age.body));

  const state = await apiJson(page, "/api/auth/command-access");
  assert.equal(state.status, 200, JSON.stringify(state.body));
  assert.equal(state.body?.ageGateComplete, true, JSON.stringify(state.body));

  return state.body;
}

export async function completeCommanderOnboarding(
  page,
  { handle, displayName, birthDate = E2E_ELIGIBLE_BIRTH_DATE },
) {
  await completeCommanderAgeGate(page, birthDate);

  const onboarding = await apiJson(page, "/api/auth/command-access", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, displayName }),
  });
  assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
  assert.equal(onboarding.body?.profileComplete, true, JSON.stringify(onboarding.body));

  return onboarding.body;
}
