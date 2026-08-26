export type RoadPoint = {
  x: number;
  y: number;
};

function connectionSeed(territoryA: number, territoryB: number) {
  const low = Math.min(territoryA, territoryB);
  const high = Math.max(territoryA, territoryB);
  return low * 97 + high * 193;
}

export function createRoadCurve(
  from: RoadPoint,
  to: RoadPoint,
  territoryA: number,
  territoryB: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  const seed = connectionSeed(territoryA, territoryB);
  const direction = seed % 2 === 0 ? 1 : -1;
  const curvatureRatio = 0.045 + (seed % 7) * 0.005;
  const bend = Math.min(34, Math.max(10, distance * curvatureRatio));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const controlX = (from.x + to.x) / 2 + normalX * bend * direction;
  const controlY = (from.y + to.y) / 2 + normalY * bend * direction;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}
