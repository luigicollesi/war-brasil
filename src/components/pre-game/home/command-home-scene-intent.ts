import type { CommandSceneDirective } from "../foundation";

export type HomeCeremonyPhase = "earth" | "brazil" | "table" | "stable";
export type HomeDestinationId = "operations" | "doctrine" | "profile";

type HomeSceneIntentInput = Readonly<{
  ceremonyPhase: HomeCeremonyPhase;
  commandOpen: boolean;
  destinationFocus: HomeDestinationId | null;
  transitioningTo: HomeDestinationId | null;
  entranceStartedAtMs?: number | null;
  entranceDurationMs?: number;
}>;

const DESTINATION_INTENTS: Readonly<
  Record<HomeDestinationId, CommandSceneDirective>
> = {
  operations: {
    focus: "brazil",
    conflictLevel: 1,
    territoryExplode: 0.08,
    orbitalAlignment: 1,
  },
  doctrine: {
    focus: "brazil",
    conflictLevel: 0,
    territoryExplode: 0.12,
    orbitalAlignment: 0,
  },
  profile: {
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  },
};

export function getHomeSceneIntent({
  ceremonyPhase,
  commandOpen,
  destinationFocus,
  transitioningTo,
  entranceStartedAtMs = null,
  entranceDurationMs,
}: HomeSceneIntentInput): CommandSceneDirective {
  const activeDestination = transitioningTo ?? destinationFocus;

  if (commandOpen && activeDestination) {
    return DESTINATION_INTENTS[activeDestination];
  }

  if (commandOpen) {
    return {
      focus: "table",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 1,
    };
  }

  const entranceTiming =
    entranceStartedAtMs === null
      ? {}
      : { entranceStartedAtMs, entranceDurationMs };

  if (ceremonyPhase === "earth") {
    return {
      focus: "earth",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 0,
      ...entranceTiming,
    };
  }

  if (ceremonyPhase === "brazil") {
    return {
      focus: "brazil",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 0,
      ...entranceTiming,
    };
  }

  return {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
    ...entranceTiming,
  };
}
