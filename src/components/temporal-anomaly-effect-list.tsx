import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

const effectMarker: Record<
  TemporalAnomalyPresentation["effects"][number]["kind"],
  string
> = {
  "troops-added": "+",
  "troops-removed": "−",
  "attack-blocked": "×",
  "connection-opened": "↔",
  "connection-blocked": "∥",
  "barrier-moved": "⇢",
  information: "•",
};

type TemporalAnomalyEffectListProps = {
  effects: TemporalAnomalyPresentation["effects"];
  heading?: string;
  headingId?: string;
  className?: string;
};

export function TemporalAnomalyEffectList({
  effects,
  heading = "Efeitos",
  headingId = "temporal-anomaly-effects-heading",
  className = "temporal-anomaly-effects",
}: TemporalAnomalyEffectListProps) {
  if (!effects.length) return null;

  return (
    <section className={className} aria-labelledby={headingId}>
      <p id={headingId} className="temporal-anomaly-effects-heading">
        {heading}
      </p>
      <ul>
        {effects.map((effect, index) => (
          <li key={`${effect.kind}-${effect.primary}-${index}`}>
            <span
              aria-hidden="true"
              className="temporal-anomaly-effect-icon"
              data-kind={effect.kind}
            >
              {effectMarker[effect.kind]}
            </span>
            <span className="temporal-anomaly-effect-copy">
              <small>{effect.label}</small>
              <strong>{effect.primary}</strong>
              {effect.secondary ? <span>{effect.secondary}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
