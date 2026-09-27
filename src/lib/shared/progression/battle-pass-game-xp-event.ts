export type BattlePassGameXpEventKind =
  | "troops_placed"
  | "card_trade"
  | "combat"
  | "territory_conquered"
  | "territory_reconquered"
  | "match_completed"
  | "match_won"
  | "match_settled";

export type BattlePassGameXpEventIntensity =
  | "micro"
  | "standard"
  | "major"
  | "terminal";

export type BattlePassGameXpEvent = Readonly<{
  id: string;
  matchId: string;
  sourceKey: string;
  kind: BattlePassGameXpEventKind;
  xp: number;
  label: string;
  detail: string | null;
  intensity: BattlePassGameXpEventIntensity;
  occurredAt: string;
}>;

const KINDS = new Set<BattlePassGameXpEventKind>([
  "troops_placed",
  "card_trade",
  "combat",
  "territory_conquered",
  "territory_reconquered",
  "match_completed",
  "match_won",
  "match_settled",
]);

const INTENSITIES = new Set<BattlePassGameXpEventIntensity>([
  "micro",
  "standard",
  "major",
  "terminal",
]);

function boundedString(value: unknown, maxLength: number) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength
  );
}

export function isBattlePassGameXpEvent(
  value: unknown,
): value is BattlePassGameXpEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;

  return (
    boundedString(row.id, 256) &&
    boundedString(row.matchId, 64) &&
    boundedString(row.sourceKey, 256) &&
    typeof row.kind === "string" &&
    KINDS.has(row.kind as BattlePassGameXpEventKind) &&
    typeof row.xp === "number" &&
    Number.isSafeInteger(row.xp) &&
    row.xp >= 0 &&
    row.xp <= 40_000 &&
    boundedString(row.label, 80) &&
    (row.detail === null ||
      (typeof row.detail === "string" && row.detail.length <= 240)) &&
    typeof row.intensity === "string" &&
    INTENSITIES.has(row.intensity as BattlePassGameXpEventIntensity) &&
    boundedString(row.occurredAt, 64)
  );
}
