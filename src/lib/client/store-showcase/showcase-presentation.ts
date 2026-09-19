export type ShowcaseObjectType = "dice" | "territory";

export type ShowcasePresentation = Readonly<{
  objectScale: number;
  cameraFov: number;
  cameraDistance: number;
  cameraY: number;
  cameraTargetY: number;
  rotation: readonly [number, number, number];
}>;

type ShowcasePresentationByViewport = Readonly<{
  desktop: ShowcasePresentation;
  compact: ShowcasePresentation;
}>;

const SHOWCASE_PRESENTATION: Readonly<
  Record<ShowcaseObjectType, ShowcasePresentationByViewport>
> = {
  dice: {
    desktop: {
      objectScale: 1.55,
      cameraFov: 30,
      cameraDistance: 6.4,
      cameraY: 0.22,
      cameraTargetY: 0.02,
      rotation: [-0.1, -0.42, 0],
    },
    compact: {
      objectScale: 1.65,
      cameraFov: 34,
      cameraDistance: 5.8,
      cameraY: 0.32,
      cameraTargetY: 0.04,
      rotation: [-0.1, -0.42, 0],
    },
  },
  territory: {
    desktop: {
      objectScale: 0.92,
      cameraFov: 36,
      cameraDistance: 5.5,
      cameraY: 0.15,
      cameraTargetY: 0,
      rotation: [-0.12, -0.52, 0],
    },
    compact: {
      objectScale: 1,
      cameraFov: 39,
      cameraDistance: 6.2,
      cameraY: 0.35,
      cameraTargetY: 0,
      rotation: [-0.12, -0.52, 0],
    },
  },
};

export function resolveShowcasePresentation(
  objectType: ShowcaseObjectType,
  compact: boolean,
): ShowcasePresentation {
  return SHOWCASE_PRESENTATION[objectType][compact ? "compact" : "desktop"];
}
