export const MAP_VISUALS_READY_EVENT = "war:map-visuals-ready";
export const MAP_GESTURE_STATE_EVENT = "war:map-gesture-state";

export type MapGestureKind = "pan" | "pinch" | null;

export type MapGestureState = {
  active: boolean;
  kind: MapGestureKind;
};

export function isMapGestureState(value: unknown): value is MapGestureState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MapGestureState>;
  return (
    typeof candidate.active === "boolean" &&
    (candidate.kind === null || candidate.kind === "pan" || candidate.kind === "pinch")
  );
}
