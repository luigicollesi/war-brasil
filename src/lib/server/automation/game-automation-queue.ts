import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { GameAutomationSchedule } from "./game-automation-schedule";

const MAX_QUEUE_DELAY_SECONDS = 24 * 60 * 60;

type AutomationQueueMode = "off" | "shadow" | "active";

function automationQueueMode(): AutomationQueueMode {
  const value = process.env.GAME_AUTOMATION_QUEUE_MODE?.trim();
  return value === "shadow" || value === "active" ? value : "off";
}

type AutomationQueue = {
  send(
    body: unknown,
    options?: Readonly<{ delaySeconds?: number }>,
  ): Promise<unknown>;
};

function automationQueueBinding(): AutomationQueue | null {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const binding = env.GAME_AUTOMATION_QUEUE;
    if (
      binding &&
      typeof binding === "object" &&
      typeof (binding as { send?: unknown }).send === "function"
    ) {
      return binding as AutomationQueue;
    }
  } catch {
    // Node/local and environments without the Queue binding keep the poller.
  }
  return null;
}

function queueDelaySeconds(dueAt: Date, nowMs = Date.now()) {
  return Math.max(
    0,
    Math.min(
      MAX_QUEUE_DELAY_SECONDS,
      Math.ceil((dueAt.getTime() - nowMs) / 1000),
    ),
  );
}

export async function enqueueGameAutomationSchedule(input: Readonly<{
  roomId: string;
  revision: number;
  schedule: GameAutomationSchedule;
}>) {
  const queue = automationQueueBinding();
  const mode = automationQueueMode();
  if (
    mode === "off" ||
    !queue ||
    !input.schedule.kind ||
    !input.schedule.dueAt
  ) {
    return false;
  }

  await queue.send(
    {
      v: 1,
      mode,
      roomId: input.roomId,
      expectedRevision: input.revision,
      kind: input.schedule.kind,
      dueAt: input.schedule.dueAt.toISOString(),
    },
    {
      delaySeconds: queueDelaySeconds(input.schedule.dueAt),
    },
  );
  return true;
}
