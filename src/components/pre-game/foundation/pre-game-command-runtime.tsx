"use client";

import { usePathname } from "next/navigation";
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
import { resolvePreGameSceneIntent } from "./pre-game-route-intent";
import type {
  CommandConflictLevel,
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
}>;

type DirectiveRegistration = Readonly<{
  token: symbol;
  pathname: string;
  directive: CommandSceneDirective;
}>;

type PublishSceneDirective = (
  directive: CommandSceneDirective,
) => () => void;

const SceneDirectiveContext = createContext<PublishSceneDirective | null>(null);
const SceneStateContext = createContext<CommandSceneState | null>(null);

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
  const routeIntent = useMemo(
    () => resolvePreGameSceneIntent(pathname),
    [pathname],
  );
  const [registration, setRegistration] = useState<DirectiveRegistration | null>(null);
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

  const intent = useMemo(
    () =>
      routeIntent
        ? mergeSceneIntent(routeIntent, registration, pathname)
        : null,
    [pathname, registration, routeIntent],
  );

  if (!intent) return <>{children}</>;

  return (
    <SceneStateContext.Provider value={sceneState}>
      <SceneDirectiveContext.Provider value={publishDirective}>
        <CommandShell
          intent={intent}
          showModeRail={pathname !== "/"}
          onSceneStateChange={setSceneState}
        >
          {children}
        </CommandShell>
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
    }),
    [
      directive.conflictLevel,
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

export function useCommandSceneState() {
  const sceneState = useContext(SceneStateContext);
  if (!sceneState) {
    throw new Error(
      "useCommandSceneState deve ser usado dentro de PreGameCommandRuntime.",
    );
  }
  return sceneState;
}
