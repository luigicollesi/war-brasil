import type { CommandSceneDirective } from "../foundation";

export type HomeCeremonyPhase = "primed" | "playing" | "stable";
export type HomeDestinationId =
  | "operations"
  | "doctrine"
  | "profile"
  | "campaign";

type HomeSceneIntentInput = Readonly<{
  ceremonyPhase: HomeCeremonyPhase;
  commandOpen: boolean;
  destinationFocus: HomeDestinationId | null;
  transitioningTo: HomeDestinationId | null;
}>;

const DESTINATION_INTENTS: Readonly<
  Record<HomeDestinationId, CommandSceneDirective>
> = {
  operations: {
    focus: "brazil",
    cameraPose: "operations",
    conflictLevel: 2,
    territoryExplode: 0.08,
    orbitalAlignment: 1,
    entranceState: "settled",
  },
  doctrine: {
    focus: "brazil",
    cameraPose: "doctrine-overview",
    conflictLevel: 0,
    territoryExplode: 0.22,
    orbitalAlignment: 0,
    entranceState: "settled",
  },
  campaign: {
    focus: "table",
    cameraPose: "campaign-overview",
    conflictLevel: 0,
    territoryExplode: 0.04,
    orbitalAlignment: 1,
    entranceState: "settled",
  },
  profile: {
    focus: "insignia",
    cameraPose: "profile",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
    entranceState: "settled",
  },
};

export function getHomeSceneIntent({
  ceremonyPhase,
  commandOpen,
  destinationFocus,
  transitioningTo,
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
      entranceState: "settled",
    };
  }

  return {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
    entranceState:
      ceremonyPhase === "stable"
        ? "settled"
        : ceremonyPhase === "playing"
          ? "playing"
          : "primed",
  };
}
