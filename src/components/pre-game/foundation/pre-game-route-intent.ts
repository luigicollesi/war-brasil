import type {
  CommandSceneIntent,
  CommandSceneMode,
} from "./scene-contract";

const EXACT_ROUTE_MODES: Readonly<Record<string, CommandSceneMode>> = {
  "/": "entrance",
  "/home": "entrance",
  "/matchmaking": "operations",
  "/rules": "doctrine",
  "/profile": "profile",
};

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const PROFILE_INTERNAL_SEGMENTS = new Set(["arsenal", "store"]);

export function isStandalonePublicProfileRoute(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  const match = normalizedPathname.match(/^\/profile\/([^/]+)$/);
  if (!match) return false;
  const segment = decodeURIComponent(match[1] ?? "").trim().toLowerCase();
  return Boolean(segment) && !PROFILE_INTERNAL_SEGMENTS.has(segment);
}

export function resolvePreGameSceneMode(pathname: string): CommandSceneMode | null {
  const normalizedPathname = normalizePathname(pathname);
  const exactMode = EXACT_ROUTE_MODES[normalizedPathname];

  if (exactMode) return exactMode;
  if (normalizedPathname.startsWith("/lobby/")) return "lobby";
  if (normalizedPathname.startsWith("/profile/")) return "profile";

  return null;
}

export function resolvePreGameSceneIntent(pathname: string): CommandSceneIntent | null {
  const mode = resolvePreGameSceneMode(pathname);
  return mode ? { mode } : null;
}
