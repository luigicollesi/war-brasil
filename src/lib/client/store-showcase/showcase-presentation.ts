export type ShowcaseObjectType = "dice" | "territory";

export const SHOWCASE_PORTRAIT_ASPECT_MAX = 0.78;

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
  portrait: ShowcasePresentation;
}>;

type ShowcaseViewport = keyof ShowcasePresentationByViewport;

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
    portrait: {
      objectScale: 0.98,
      cameraFov: 36,
      cameraDistance: 6.8,
      cameraY: 0.28,
      cameraTargetY: 0.02,
      rotation: [-0.08, -0.36, 0],
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
    portrait: {
      objectScale: 0.55,
      cameraFov: 38,
      cameraDistance: 6.8,
      cameraY: 0.28,
      cameraTargetY: 0,
      rotation: [-0.12, -0.52, 0],
    },
  },
};

export function resolveShowcaseViewport(
  compact: boolean,
  aspectRatio: number,
): ShowcaseViewport {
  if (!compact) return "desktop";
  if (
    Number.isFinite(aspectRatio) &&
    aspectRatio <= SHOWCASE_PORTRAIT_ASPECT_MAX
  ) {
    return "portrait";
  }
  return "compact";
}

export function resolveShowcasePresentation(
  objectType: ShowcaseObjectType,
  compact: boolean,
  aspectRatio = 1,
): ShowcasePresentation {
  const viewport = resolveShowcaseViewport(compact, aspectRatio);
  return SHOWCASE_PRESENTATION[objectType][viewport];
}
