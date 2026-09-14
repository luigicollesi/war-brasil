export const PROFILE_REMOTE_PORTRAIT_HOSTS = [
  "lh3.googleusercontent.com",
  "cdn.discordapp.com",
] as const;

const REMOTE_HOSTS = new Set<string>(PROFILE_REMOTE_PORTRAIT_HOSTS);

export function safeProfilePortraitSrc(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !REMOTE_HOSTS.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
