type AutomationMessage = {
  v: 1;
  mode: "shadow" | "active";
  roomId: string;
  expectedRevision: number;
  kind: "presentation" | "bot";
  dueAt: string;
};

type QueueMessage = {
  body: unknown;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

type QueueBatch = {
  messages: readonly QueueMessage[];
};

type ServiceBinding = {
  fetch(request: Request): Promise<Response>;
};

type Env = {
  GAME_APP_SERVICE?: ServiceBinding;
  GAME_AUTOMATION_WORKER_TOKEN?: string;
  GAME_AUTOMATION_INTERNAL_BASE_URL?: string;
};

function isAutomationMessage(value: unknown): value is AutomationMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return (
    message.v === 1 &&
    (message.mode === "shadow" || message.mode === "active") &&
    typeof message.roomId === "string" &&
    /^\d+$/.test(message.roomId) &&
    typeof message.expectedRevision === "number" &&
    Number.isSafeInteger(message.expectedRevision) &&
    message.expectedRevision >= 1 &&
    (message.kind === "presentation" || message.kind === "bot") &&
    typeof message.dueAt === "string" &&
    Number.isFinite(Date.parse(message.dueAt))
  );
}

function retryDelaySeconds(attempts: number) {
  return Math.min(300, 2 ** Math.min(Math.max(attempts, 1), 8));
}

function internalToken(env: Env) {
  const token = env.GAME_AUTOMATION_WORKER_TOKEN?.trim();
  return token && token.length >= 32 ? token : null;
}

function internalBaseUrl(env: Env) {
  const value = env.GAME_AUTOMATION_INTERNAL_BASE_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

async function advanceAutomation(env: Env, body: AutomationMessage) {
  const token = internalToken(env);
  if (!token) throw new Error("GAME_AUTOMATION_WORKER_TOKEN ausente.");

  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomId: body.roomId,
      expectedRevision: body.expectedRevision,
    }),
  };

  if (env.GAME_APP_SERVICE) {
    return env.GAME_APP_SERVICE.fetch(
      new Request(
        "https://war-brasil.internal/api/internal/automation/advance",
        init,
      ),
    );
  }

  const baseUrl = internalBaseUrl(env);
  if (!baseUrl) {
    throw new Error("GAME_APP_SERVICE ou GAME_AUTOMATION_INTERNAL_BASE_URL é obrigatório.");
  }

  return fetch(`${baseUrl}/api/internal/automation/advance`, init);
}

async function processMessage(message: QueueMessage, env: Env) {
  if (!isAutomationMessage(message.body)) {
    message.ack();
    return;
  }

  if (message.body.mode === "shadow") {
    console.log("[automation-queue] shadow delivery", {
      roomId: message.body.roomId,
      expectedRevision: message.body.expectedRevision,
      kind: message.body.kind,
      dueAt: message.body.dueAt,
    });
    message.ack();
    return;
  }

  try {
    const response = await advanceAutomation(env, message.body);
    if (response.ok || [404, 409, 422].includes(response.status)) {
      message.ack();
      return;
    }
    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
  } catch {
    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
  }
}

const automationQueueWorker = {
  async queue(batch: QueueBatch, env: Env) {
    await Promise.all(
      batch.messages.map((message) => processMessage(message, env)),
    );
  },
};

export default automationQueueWorker;
