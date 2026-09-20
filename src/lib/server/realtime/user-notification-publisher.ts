import "server-only";

function realtimeInternalUrl() {
  const value = process.env.GAME_REALTIME_INTERNAL_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function realtimeInternalToken() {
  return process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim() || null;
}

export async function publishUserNotificationChange(userId: string) {
  const baseUrl = realtimeInternalUrl();
  const token = realtimeInternalToken();
  if (!baseUrl || !token) return false;

  try {
    const response = await fetch(`${baseUrl}/internal/user-notification`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
