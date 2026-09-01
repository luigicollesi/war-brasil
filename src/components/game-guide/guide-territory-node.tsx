export type GuideTerritoryTone = "ally" | "enemy" | "neutral" | "accent";

function troopLabel(troops: number) {
  return troops === 1 ? "1 tropa" : `${troops} tropas`;
}

export function GuideTerritoryNode({
  name,
  troops,
  tone = "neutral",
  compact = false,
  className = "",
}: {
  name: string;
  troops: number;
  tone?: GuideTerritoryTone;
  compact?: boolean;
  className?: string;
}) {
  const safeTroops = Number.isFinite(troops)
    ? Math.max(0, Math.floor(troops))
    : 0;
  const visibleTroops = Math.min(safeTroops, 5);
  const remainingTroops = Math.max(0, safeTroops - visibleTroops);

  return (
    <div
      className={`wb-guide-territory ${compact ? "wb-guide-territory--compact" : ""} ${className}`.trim()}
      data-tone={tone}
      aria-label={`${name}: ${troopLabel(safeTroops)}`}
    >
      <strong aria-hidden="true">{name}</strong>
      <div className="wb-guide-territory-troops" aria-hidden="true">
        {Array.from({ length: visibleTroops }, (_, index) => (
          <span key={index} className="wb-guide-territory-troop" />
        ))}
        {remainingTroops > 0 ? (
          <small>+{remainingTroops}</small>
        ) : safeTroops === 0 ? (
          <small>0</small>
        ) : null}
      </div>
    </div>
  );
}
