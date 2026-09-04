const MODES = new Set(["off", "shadow", "active"]);

export function automationWorkerMode(env = process.env) {
  const raw = env.GAME_AUTOMATION_WORKER_MODE?.trim() || "off";
  if (!MODES.has(raw)) {
    throw new Error(
      `GAME_AUTOMATION_WORKER_MODE inválido: ${raw}. Use off, shadow ou active.`,
    );
  }
  return raw;
}

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

export function automationWorkerPollMs(env = process.env) {
  return positiveInteger(env.GAME_AUTOMATION_WORKER_POLL_MS, 500, 100, 60_000);
}

export function automationWorkerBatchSize(env = process.env) {
  return positiveInteger(env.GAME_AUTOMATION_WORKER_BATCH_SIZE, 50, 1, 500);
}
