function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

export async function advanceDueAutomation({
  row,
  baseUrl,
  token,
  fetchImpl = fetch,
  signal = AbortSignal.timeout(10_000),
}) {
  const response = await fetchImpl(
    `${normalizeBaseUrl(baseUrl)}/api/internal/automation/advance`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: row.room_id,
        expectedRevision: row.revision,
      }),
      signal,
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return {
    changed: Boolean(
      data && typeof data === "object" && data.changed === true,
    ),
    revision:
      data &&
      typeof data === "object" &&
      Number.isSafeInteger(data.revision) &&
      data.revision >= 1
        ? data.revision
        : null,
    kind:
      data && typeof data === "object" && typeof data.kind === "string"
        ? data.kind
        : null,
  };
}
