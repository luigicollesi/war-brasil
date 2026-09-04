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

export function automationWorkerInternalBaseUrl(env = process.env) {
  const raw = env.GAME_AUTOMATION_INTERNAL_BASE_URL?.trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("GAME_AUTOMATION_INTERNAL_BASE_URL deve ser uma URL HTTP(S) válida.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("GAME_AUTOMATION_INTERNAL_BASE_URL deve usar HTTP ou HTTPS.");
  }

  return url.toString().replace(/\/$/, "");
}

export function automationWorkerToken(env = process.env) {
  const token = env.GAME_AUTOMATION_WORKER_TOKEN?.trim();
  return token || null;
}
