import type { CommandSceneIntent } from "../foundation";

export type HomeCeremonyPhase = "earth" | "brazil" | "table" | "stable";
export type HomeDestinationId = "operations" | "doctrine" | "profile";

type HomeSceneIntentInput = Readonly<{
  ceremonyPhase: HomeCeremonyPhase;
  commandOpen: boolean;
  destinationFocus: HomeDestinationId | null;
  transitioningTo: HomeDestinationId | null;
}>;

const DESTINATION_INTENTS: Readonly<Record<HomeDestinationId, CommandSceneIntent>> = {
  operations: {
    mode: "operations",
    focus: "brazil",
    conflictLevel: 1,
    territoryExplode: 0.08,
    orbitalAlignment: 1,
  },
  doctrine: {
    mode: "doctrine",
    focus: "brazil",
    conflictLevel: 0,
    territoryExplode: 0.12,
    orbitalAlignment: 0,
  },
  profile: {
    mode: "profile",
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
}: HomeSceneIntentInput): CommandSceneIntent {
  const activeDestination = transitioningTo ?? destinationFocus;

  if (commandOpen && activeDestination) {
    return DESTINATION_INTENTS[activeDestination];
  }

  if (commandOpen) {
    return {
      mode: "entrance",
      focus: "table",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 1,
    };
  }

  if (ceremonyPhase === "earth") {
    return {
      mode: "entrance",
      focus: "earth",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 0,
    };
  }

  if (ceremonyPhase === "brazil") {
    return {
      mode: "entrance",
      focus: "brazil",
      conflictLevel: 0,
      territoryExplode: 0,
      orbitalAlignment: 0,
    };
  }

  return {
    mode: "entrance",
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
  };
}
