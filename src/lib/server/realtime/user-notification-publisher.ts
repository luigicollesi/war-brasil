import "server-only";

import { runPostResponseTask } from "../cloudflare/post-response-task";
import { realtimeInternalFetch } from "./realtime-internal-client";

export async function publishUserNotificationChange(userId: string) {
  await runPostResponseTask("user.notification.realtime", async () => {
    try {
      await realtimeInternalFetch(
        "/internal/user-notification",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        },
      );
    } catch {
      // Notifications are recovered by HTTP polling if realtime delivery fails.
    }
  });
  return true;
}
