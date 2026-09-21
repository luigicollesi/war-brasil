import "server-only";

export function isNeonPooledConnectionString(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname.endsWith(".neon.tech") &&
      url.hostname.split(".")[0]?.endsWith("-pooler")
    );
  } catch {
    return false;
  }
}
