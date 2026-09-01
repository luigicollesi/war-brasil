import { GameDie } from "@/src/components/game-die";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";

const orderExample = [
  { key: "a", label: "Jogador A", value: 6 },
  { key: "b", label: "Jogador B", value: 2 },
  { key: "c", label: "Jogador C", value: 4 },
] as const;

export function GuideOrderSection() {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-chapter--reverse wb-guide-section--order">
      <div className="wb-guide-copy">
        <GuideHeading number="02" title="Defina a ordem">
          Todos rolam um dado. O maior resultado joga primeiro.
        </GuideHeading>

        <p className="wb-guide-inline-note">
          <strong>Empate.</strong> Apenas os jogadores empatados rolam novamente.
        </p>
      </div>

      <div className="wb-guide-visual wb-guide-order-example">
        <div className="wb-guide-order-dice" aria-label="Exemplo de rolagem para definir a ordem">
          {orderExample.map((player) => (
            <div key={player.key}>
              <span>{player.label}</span>
              <GameDie value={player.value} color="forest" size="sm" />
            </div>
          ))}
        </div>

        <GuideFlow
          compact
          className="wb-guide-order-flow"
          ariaLabel="Ordem definida pelas rolagens"
          steps={[
            { key: "first", eyebrow: "1º", label: "Jogador A", detail: "rolou 6", tone: "accent" },
            { key: "second", eyebrow: "2º", label: "Jogador C", detail: "rolou 4" },
            { key: "third", eyebrow: "3º", label: "Jogador B", detail: "rolou 2" },
          ]}
        />
      </div>
    </article>
  );
}
