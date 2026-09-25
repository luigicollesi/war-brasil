import { spawn } from "node:child_process";

const smokeSuite = [
  "scripts/e2e/auth-credentials-verification-e2e.mjs",
  "scripts/e2e/auth-password-reset-e2e.mjs",
  "scripts/e2e/auth-session-security-e2e.mjs",
  "scripts/e2e/auth-token-expiry-e2e.mjs",
  "scripts/e2e/auth-password-reset-token-expiry-e2e.mjs",
  "scripts/e2e/profile-social-flow.mjs",
  "scripts/e2e/auth-origin-redirect-e2e.mjs",
  "scripts/e2e/auth-rate-limit-e2e.mjs",
  "scripts/e2e/auth-seat-boundary-e2e.mjs",
  "scripts/e2e/lobby-e2e.mjs",
  "scripts/e2e/game-modes-e2e.mjs",
  "scripts/e2e/game-modes-victory-e2e.mjs",
  "scripts/e2e/game-player-exit-e2e.mjs",
  "scripts/e2e/economy-game-e2e.mjs",
  "scripts/e2e/store-showcase-e2e.mjs",
];

const fullSuite = [
  ...smokeSuite,
  "scripts/e2e/auth-home-command-access-e2e.mjs",
  "scripts/e2e/economy-e2e.mjs",
  "scripts/e2e/economy-purchase-e2e.mjs",
];

const suiteName = process.argv[2] ?? "smoke";
const suite = suiteName === "full" ? fullSuite : suiteName === "smoke" ? smokeSuite : null;

if (!suite) {
  console.error("usage: node scripts/e2e/run-black-box-suite.mjs [smoke|full]");
  process.exit(2);
}

const timeoutMs = Number.parseInt(
  process.env.BLACKBOX_CASE_TIMEOUT_MS ?? "20000",
  10,
);

if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
  console.error("BLACKBOX_CASE_TIMEOUT_MS must be an integer >= 1000");
  process.exit(2);
}

function timeoutForScript(script) {
  if (script === "scripts/e2e/lobby-e2e.mjs") {
    return timeoutMs * 9;
  }
  return timeoutMs;
}

function runScript(script) {
  return new Promise((resolvePromise, rejectPromise) => {
    console.log(`\n[black-box] ${script}`);

    const child = spawn(process.execPath, [script], {
      env: process.env,
      stdio: "inherit",
    });

    const scriptTimeoutMs = timeoutForScript(script);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000).unref();
    }, scriptTimeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);

      if (timedOut) {
        rejectPromise(
          new Error(
            `${script} exceeded ${scriptTimeoutMs}ms and was terminated`,
          ),
        );
        return;
      }

      if (signal) {
        rejectPromise(new Error(`${script} terminated by ${signal}`));
        return;
      }

      if (code !== 0) {
        rejectPromise(new Error(`${script} exited with code ${code}`));
        return;
      }

      resolvePromise();
    });
  });
}

for (const script of suite) {
  try {
    await runScript(script);
  } catch (error) {
    console.error(`\n[black-box] failed: ${error.message}`);
    process.exit(1);
  }
}

console.log(`\n[black-box] ${suiteName} suite passed (${suite.length} scenarios)`);
