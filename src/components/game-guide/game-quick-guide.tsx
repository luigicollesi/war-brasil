import { GuideAnomalySection } from "@/src/components/game-guide/sections/guide-anomaly-section";
import { GuideAttackSection } from "@/src/components/game-guide/sections/guide-attack-section";
import { GuideBarrierSection } from "@/src/components/game-guide/sections/guide-barrier-section";
import { GuideCardsSection } from "@/src/components/game-guide/sections/guide-cards-section";
import { GuideCombatSection } from "@/src/components/game-guide/sections/guide-combat-section";
import { GuideConquestSection } from "@/src/components/game-guide/sections/guide-conquest-section";
import { GuideEliminationSection } from "@/src/components/game-guide/sections/guide-elimination-section";
import { GuideManeuverSection } from "@/src/components/game-guide/sections/guide-maneuver-section";
import { GuideMapSection } from "@/src/components/game-guide/sections/guide-map-section";
import { GuideObjectiveSection } from "@/src/components/game-guide/sections/guide-objective-section";
import { GuideOrderSection } from "@/src/components/game-guide/sections/guide-order-section";
import { GuideReinforcementSection } from "@/src/components/game-guide/sections/guide-reinforcement-section";
import { GuideSetupSection } from "@/src/components/game-guide/sections/guide-setup-section";
import { GuideTurnSection } from "@/src/components/game-guide/sections/guide-turn-section";
import { GuideVictorySection } from "@/src/components/game-guide/sections/guide-victory-section";
import { buildGameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GameQuickGuide() {
  const guide = buildGameGuidePresentation();

  return (
    <section id="manual" className="wb-guide" aria-labelledby="manual-title">
      <header className="wb-guide-intro">
        <p className="wb-kicker">Manual de campo</p>
        <h2 id="manual-title">Entenda uma partida em poucos minutos.</h2>
        <p>
          Aprenda a partida na ordem em que ela acontece. Cada seção explica uma
          decisão do jogo e usa o próprio mapa, dados e cartas para mostrar a regra.
        </p>
      </header>

      <GuideSetupSection guide={guide} />
      <GuideOrderSection />
      <GuideObjectiveSection />
      <GuideTurnSection />
      <GuideReinforcementSection guide={guide} />
      <GuideAttackSection guide={guide} />
      <GuideCombatSection guide={guide} />
      <GuideBarrierSection guide={guide} />
      <GuideConquestSection guide={guide} />
      <GuideEliminationSection />
      <GuideCardsSection guide={guide} />
      <GuideManeuverSection guide={guide} />
      <GuideMapSection />
      <GuideAnomalySection guide={guide} />
      <GuideVictorySection />
    </section>
  );
}
