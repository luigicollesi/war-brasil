import type { ResolvedEventEffect } from "./event-types";

export function isAttackOriginBlocked(
  resolvedEffects: readonly ResolvedEventEffect[],
  territoryId: number,
) {
  return resolvedEffects.some(
    (effect) =>
      effect.type === "BLOCK_ATTACK" && effect.territories.includes(territoryId),
  );
}
