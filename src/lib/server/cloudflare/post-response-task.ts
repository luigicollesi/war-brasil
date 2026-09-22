import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

function currentExecutionContext(): ExecutionContextLike | null {
  try {
    const ctx = getCloudflareContext().ctx as unknown;
    if (
      ctx &&
      (typeof ctx === "object" || typeof ctx === "function") &&
      typeof (ctx as { waitUntil?: unknown }).waitUntil === "function"
    ) {
      return ctx as ExecutionContextLike;
    }
  } catch {
    // Node/local runtimes intentionally fall back to awaiting the task.
  }
  return null;
}

export async function runPostResponseTask(
  label: string,
  task: () => Promise<void>,
) {
  const ctx = currentExecutionContext();

  if (ctx) {
    ctx.waitUntil(
      task().catch((error) => {
        console.error(`[war-brasil] post-response task failed: ${label}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    );
    return;
  }

  await task();
}
