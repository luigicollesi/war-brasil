function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

export async function cleanupStaleLobbies({
  baseUrl,
  token,
  fetchImpl = fetch,
  signal = AbortSignal.timeout(10_000),
}) {
  const response = await fetchImpl(
    `${normalizeBaseUrl(baseUrl)}/api/internal/lobby/cleanup`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    removedSeats:
      data && typeof data === "object" && Number.isSafeInteger(data.removedSeats)
        ? data.removedSeats
        : 0,
    affectedRooms:
      data && typeof data === "object" && Number.isSafeInteger(data.affectedRooms)
        ? data.affectedRooms
        : 0,
    deletedRooms:
      data && typeof data === "object" && Number.isSafeInteger(data.deletedRooms)
        ? data.deletedRooms
        : 0,
  };
}
