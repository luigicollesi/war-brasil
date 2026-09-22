import "server-only";

import { realtimeInternalFetch } from "./realtime-internal-client";

export async function publishUserNotificationChange(userId: string) {
  try {
    const response = await realtimeInternalFetch(
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
    return response?.ok ?? false;
  } catch {
    return false;
  }
}
