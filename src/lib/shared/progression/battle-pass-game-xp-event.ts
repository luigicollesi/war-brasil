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

export function isBattlePassGameXpEvent(
  value: unknown,
): value is BattlePassGameXpEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.matchId === "string" &&
    typeof row.sourceKey === "string" &&
    typeof row.kind === "string" &&
    typeof row.xp === "number" &&
    Number.isSafeInteger(row.xp) &&
    row.xp >= 0 &&
    typeof row.label === "string" &&
    (row.detail === null || typeof row.detail === "string") &&
    (row.intensity === "micro" ||
      row.intensity === "standard" ||
      row.intensity === "major" ||
      row.intensity === "terminal") &&
    typeof row.occurredAt === "string"
  );
}
