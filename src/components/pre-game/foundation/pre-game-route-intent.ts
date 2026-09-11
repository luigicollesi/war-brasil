import type {
  CommandSceneIntent,
  CommandSceneMode,
} from "./scene-contract";

const EXACT_ROUTE_MODES: Readonly<Record<string, CommandSceneMode>> = {
  "/": "entrance",
  "/matchmaking": "operations",
  "/rules": "doctrine",
  "/profile": "profile",
};

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function resolvePreGameSceneMode(pathname: string): CommandSceneMode | null {
  const normalizedPathname = normalizePathname(pathname);
  const exactMode = EXACT_ROUTE_MODES[normalizedPathname];

  if (exactMode) return exactMode;
  if (normalizedPathname.startsWith("/lobby/")) return "lobby";

  return null;
}

export function resolvePreGameSceneIntent(pathname: string): CommandSceneIntent | null {
  const mode = resolvePreGameSceneMode(pathname);
  return mode ? { mode } : null;
}
