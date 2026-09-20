"use client";

import { usePathname } from "next/navigation";
import type { ShowcaseObjectType } from "@/src/lib/client/store-showcase/showcase-presentation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CommandShell } from "./command-shell";
import {
  isStandalonePublicProfileRoute,
  resolvePreGameSceneIntent,
} from "./pre-game-route-intent";
import type {
  CommandConflictLevel,
  CommandEntranceState,
  CommandOrbitalAlignment,
  CommandSceneFocus,
  CommandSceneIntent,
  CommandSceneState,
} from "./scene-contract";

export type CommandSceneDirective = Readonly<{
  focus?: CommandSceneFocus;
  conflictLevel?: CommandConflictLevel;
  territoryExplode?: number;
  orbitalAlignment?: CommandOrbitalAlignment;
  entranceState?: CommandEntranceState;
}>;

export type ShowcaseSceneMode = "standard" | "collection";

export type ShowcaseScenePayload = Readonly<{
  key: string;
  mode: ShowcaseSceneMode;
  objectType: ShowcaseObjectType;
  stageCenterRatio: number;
  render: (context: { reducedMotion: boolean }) => ReactNode;
}>;

type DirectiveRegistration = Readonly<{
  token: symbol;
  pathname: string;
  directive: CommandSceneDirective;
}>;

type ShowcaseSceneRegistration = Readonly<{
  token: symbol;
  pathname: string;
  scene: ShowcaseScenePayload;
}>;

type PublishSceneDirective = (
  directive: CommandSceneDirective,
) => () => void;

type PublishShowcaseScene = (scene: ShowcaseScenePayload) => () => void;

const SceneDirectiveContext = createContext<PublishSceneDirective | null>(null);
const SceneStateContext = createContext<CommandSceneState | null>(null);
const ShowcaseSceneContext = createContext<PublishShowcaseScene | null>(null);
const PROFILE_SHELL_ROUTES = new Set([
  "/profile",
  "/profile/arsenal",
  "/profile/store",
]);

function mergeSceneIntent(
  routeIntent: CommandSceneIntent,
  registration: DirectiveRegistration | null,
  pathname: string,
): CommandSceneIntent {
  if (!registration || registration.pathname !== pathname) return routeIntent;

  return {
    ...routeIntent,
    ...registration.directive,
    mode: routeIntent.mode,
  };
}

export function PreGameCommandRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const profileOwnsBackground = PROFILE_SHELL_ROUTES.has(pathname);
  const standalonePublicProfile = isStandalonePublicProfileRoute(pathname);
  const profileOwnsSurface = profileOwnsBackground || standalonePublicProfile;
  const profileOwnsChrome =
    profileOwnsBackground ||
    standalonePublicProfile ||
    pathname.startsWith("/profile/store/showcase/");
  const routeIntent = useMemo(
    () => resolvePreGameSceneIntent(pathname),
    [pathname],
  );
  const [registration, setRegistration] = useState<DirectiveRegistration | null>(null);
  const [showcaseRegistration, setShowcaseRegistration] =
    useState<ShowcaseSceneRegistration | null>(null);
  const [sceneState, setSceneState] = useState<CommandSceneState>("loading");

  const publishDirective = useCallback<PublishSceneDirective>(
    (directive) => {
      const token = Symbol("command-scene-directive");
      setRegistration({ token, pathname, directive });

      return () => {
        setRegistration((current) =>
          current?.token === token ? null : current,
        );
      };
    },
    [pathname],
  );

  const publishShowcaseScene = useCallback<PublishShowcaseScene>(
    (scene) => {
      const token = Symbol("showcase-scene");
      setShowcaseRegistration({ token, pathname, scene });

      return () => {
        setShowcaseRegistration((current) =>
          current?.token === token ? null : current,
        );
      };
    },
    [pathname],
  );

  const intent = useMemo(
    () =>
      routeIntent
        ? mergeSceneIntent(routeIntent, registration, pathname)
        : null,
    [pathname, registration, routeIntent],
  );

  const showcaseScene =
    showcaseRegistration?.pathname === pathname
      ? showcaseRegistration.scene
      : null;

  if (!intent) return <>{children}</>;

  return (
    <SceneStateContext.Provider value={profileOwnsSurface ? "ready" : sceneState}>
      <SceneDirectiveContext.Provider value={publishDirective}>
        <ShowcaseSceneContext.Provider value={publishShowcaseScene}>
          {profileOwnsSurface ? (
            <>{children}</>
          ) : (
            <CommandShell
              intent={intent}
              chrome={!profileOwnsChrome}
              showModeRail={pathname !== "/"}
              onSceneStateChange={setSceneState}
              showcaseScene={showcaseScene}
            >
              {children}
            </CommandShell>
          )}
        </ShowcaseSceneContext.Provider>
      </SceneDirectiveContext.Provider>
    </SceneStateContext.Provider>
  );
}

export function useCommandSceneDirective(
  directive: CommandSceneDirective,
  enabled = true,
) {
  const publishDirective = useContext(SceneDirectiveContext);
  const stableDirective = useMemo<CommandSceneDirective>(
    () => ({
      focus: directive.focus,
      conflictLevel: directive.conflictLevel,
      territoryExplode: directive.territoryExplode,
      orbitalAlignment: directive.orbitalAlignment,
      entranceState: directive.entranceState,
    }),
    [
      directive.conflictLevel,
      directive.entranceState,
      directive.focus,
      directive.orbitalAlignment,
      directive.territoryExplode,
    ],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    if (!publishDirective) {
      throw new Error(
        "useCommandSceneDirective deve ser usado dentro de PreGameCommandRuntime.",
      );
    }

    return publishDirective(stableDirective);
  }, [enabled, publishDirective, stableDirective]);
}

export function useShowcaseScene(
  scene: ShowcaseScenePayload,
  enabled = true,
) {
  const publishShowcaseScene = useContext(ShowcaseSceneContext);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!publishShowcaseScene) {
      throw new Error(
        "useShowcaseScene deve ser usado dentro de PreGameCommandRuntime.",
      );
    }

    return publishShowcaseScene(scene);
  }, [enabled, publishShowcaseScene, scene]);
}

export function useCommandSceneState() {
  const sceneState = useContext(SceneStateContext);
  if (!sceneState) {
    throw new Error(
      "useCommandSceneState deve ser usado dentro de PreGameCommandRuntime.",
    );
  }
  return sceneState;
}
