import { buildGameGuidePresentation } from "./game-guide-presentation";
import { EVENT_COUNT } from "./shared/events/event-catalog";
import {
  JURASSIC_TUNNEL_SOURCE_ID,
} from "./shared/game-round-rules";

export const DOCTRINE_CHAPTER_SLUGS = [
  "preparacao",
  "objetivos",
  "turno",
  "reforcos",
  "ataque",
  "conquista",
  "movimentacao",
  "barreiras-conexoes",
  "cartas",
  "anomalias",
  "vitoria",
] as const;

export type DoctrineChapterSlug = (typeof DOCTRINE_CHAPTER_SLUGS)[number];

export type DoctrineMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type DoctrineChapter = {
  slug: DoctrineChapterSlug;
  number: string;
  eyebrow: string;
  title: string;
  lede: string;
  principles: readonly string[];
  metrics: readonly DoctrineMetric[];
  visual:
    | "setup"
    | "objectives"
    | "turn"
    | "reinforcement"
    | "attack"
    | "conquest"
    | "maneuver"
    | "barriers"
    | "cards"
    | "events"
    | "victory";
};

export type DoctrinePresentation = ReturnType<typeof buildDoctrinePresentation>;

export function isDoctrineChapterSlug(value: string | null | undefined): value is DoctrineChapterSlug {
  return DOCTRINE_CHAPTER_SLUGS.includes(value as DoctrineChapterSlug);
}

export function buildDoctrinePresentation() {
  const guide = buildGameGuidePresentation();

  const chapters: readonly DoctrineChapter[] = [
    {
      slug: "preparacao",
      number: "01",
      eyebrow: "Mobilização",
      title: "O território vem antes da guerra.",
      lede: `A partida começa distribuindo os ${guide.territoryCount} territórios entre os jogadores. Cada território entra em campo com ${guide.setup.initialTroopsPerTerritory} tropa.`,
      principles: [
        "A posse inicial já define fronteiras, riscos e rotas possíveis.",
        "A ordem de jogo é resolvida antes do primeiro turno; depois disso, cada jogador segue o mesmo ciclo operacional.",
        "A preparação não revela o objetivo privado de nenhum jogador.",
      ],
      metrics: [
        { label: "Territórios", value: String(guide.territoryCount) },
        { label: "Regiões", value: String(guide.regionCount) },
        {
          label: "Guarnição inicial",
          value: `${guide.setup.initialTroopsPerTerritory} por território`,
        },
      ],
      visual: "setup",
    },
    {
      slug: "objetivos",
      number: "02",
      eyebrow: "Missão",
      title: "Você vence pelo seu objetivo, não por pontuação.",
      lede: "Cada jogador recebe um objetivo privado. A Doutrina explica os formatos possíveis sem consultar ou expor o objetivo de uma partida real.",
      principles: [
        "Objetivos podem exigir controle territorial, domínio regional, fortificação ou eliminação.",
        "Condições compostas só são concluídas quando todos os requisitos do objetivo forem satisfeitos.",
        "O objetivo deve orientar suas decisões sem virar informação pública para os adversários.",
      ],
      metrics: [
        { label: "Informação", value: "privada" },
        { label: "Verificação", value: "automática" },
        { label: "Regra", value: "objetivo concluído" },
      ],
      visual: "objectives",
    },
    {
      slug: "turno",
      number: "03",
      eyebrow: "Ciclo",
      title: "Cada turno é uma sequência de decisões irreversíveis.",
      lede: "O fluxo operacional separa preparação, conflito e reposicionamento para que cada fase tenha uma responsabilidade clara.",
      principles: [
        "Reforce antes de atacar; o saldo de reforços precisa ser alocado.",
        "Ataques são opcionais e podem se repetir enquanto houver origens válidas.",
        "A manobra encerra o reposicionamento estratégico do turno.",
      ],
      metrics: [
        { label: "Fase 1", value: "Reforços" },
        { label: "Fase 2", value: "Ataque" },
        { label: "Fase 3", value: "Manobra" },
      ],
      visual: "turn",
    },
    {
      slug: "reforcos",
      number: "04",
      eyebrow: "Logística",
      title: "Controle território para ampliar sua capacidade de guerra.",
      lede: `O reforço base é metade dos territórios controlados, arredondada para baixo, respeitando o mínimo de ${guide.reinforcement.minimum} tropas. Regiões completas e cartas aumentam esse total.`,
      principles: [
        `Com ${guide.reinforcement.territoryExample} territórios, o exemplo vigente gera ${guide.reinforcement.baseExample} tropas de reforço base.`,
        "Dominar uma região inteira soma o bônus regional correspondente.",
        "Trocas obrigatórias de cartas acontecem antes da alocação normal de reforços.",
      ],
      metrics: [
        { label: "Mínimo", value: `${guide.reinforcement.minimum} tropas` },
        {
          label: `${guide.reinforcement.territoryExample} territórios`,
          value: `+${guide.reinforcement.baseExample}`,
        },
        {
          label: "Bônus regional",
          value: guide.regions.map((region) => `${region.label} +${region.bonus}`).join(" · "),
        },
      ],
      visual: "reinforcement",
    },
    {
      slug: "ataque",
      number: "05",
      eyebrow: "Conflito",
      title: "Ataque exige conexão, superioridade e uma tropa deixada para trás.",
      lede: `Um ataque normal parte de um território próprio com pelo menos ${guide.attack.normalMinimumTroops} tropas para um território inimigo conectado. A quantidade de dados depende da força na origem.`,
      principles: [
        "A origem e o alvo precisam estar conectados pela topologia vigente da partida.",
        "No empate entre dados comparados, a defesa vence a comparação.",
        "Cada comparação normal perdida remove uma tropa do lado derrotado; barreiras alteram o custo do atacante.",
      ],
      metrics: guide.attack.normalDiceBands.map((band) => ({
        label: band.maximumTroops === null ? `${band.minimumTroops}+ tropas` : `${band.minimumTroops} tropas`,
        value: `${band.diceCount} ${band.diceCount === 1 ? "dado" : "dados"}`,
      })),
      visual: "attack",
    },
    {
      slug: "conquista",
      number: "06",
      eyebrow: "Ocupação",
      title: "Vencer a batalha ainda exige ocupar o território.",
      lede: `Quando a defesa chega a zero, o atacante precisa transferir tropas para o território conquistado e manter pelo menos ${guide.conquest.minimumTroopsLeftAtOrigin} tropa na origem.`,
      principles: [
        `A conquista exige mover pelo menos ${guide.conquest.minimumMove} tropa para o novo território.`,
        "A origem nunca pode ser esvaziada pela transferência pós-conquista.",
        "Depois da ocupação, a nova fronteira passa a participar imediatamente da topologia de conflito.",
      ],
      metrics: [
        { label: "Origem", value: `≥ ${guide.conquest.minimumTroopsLeftAtOrigin} tropa` },
        { label: "Destino", value: `≥ ${guide.conquest.minimumMove} tropa` },
        { label: "Estado", value: "ocupado" },
      ],
      visual: "conquest",
    },
    {
      slug: "movimentacao",
      number: "07",
      eyebrow: "Manobra",
      title: "Reposicione força sem criar tropas novas.",
      lede: `Na manobra, só tropas elegíveis podem sair da origem. O território precisa preservar ${guide.maneuver.minimumTroopsLeftAtOrigin} tropa e tropas recebidas durante a fase não podem ser movidas novamente.`,
      principles: [
        "Origem e destino precisam pertencer ao mesmo jogador e possuir rota válida.",
        "Tropas recém-recebidas na manobra ficam bloqueadas para novo deslocamento no mesmo turno.",
        "Rotas que cruzam barreiras aplicam as perdas e bloqueios definidos pela regra de travessia.",
      ],
      metrics: [
        { label: "Exemplo", value: `${guide.maneuver.example.movableBeforeReceiving} móveis` },
        { label: "Após receber 2", value: `${guide.maneuver.example.movableAfterReceiving} móveis` },
        { label: "Reserva", value: `${guide.maneuver.minimumTroopsLeftAtOrigin} na origem` },
      ],
      visual: "maneuver",
    },
    {
      slug: "barreiras-conexoes",
      number: "08",
      eyebrow: "Terreno",
      title: "O mapa tem atrito: nem toda conexão custa o mesmo.",
      lede: `Barreiras naturais alteram ataque e movimento. Um ataque através de barreira só fica disponível a partir de ${guide.attack.barrierMinimumTroops} tropas e cada comparação perdida pelo atacante custa ${guide.attack.barrierLossPerComparison} tropas.`,
      principles: [
        `Uma barreira na manobra remove ${guide.maneuver.barrierLoss} tropa durante a travessia e exige pelo menos ${guide.maneuver.barrierMinimumTroops} tropas disponíveis.`,
        `${guide.maneuver.blockedBarrierCount} ou mais barreiras bloqueiam a rota de manobra.`,
        `O Túnel Jurássico parte do território ${JURASSIC_TUNNEL_SOURCE_ID} e recebe um destino dinâmico válido por rodada.`,
      ],
      metrics: guide.attack.barrierDiceBands.map((band) => ({
        label: band.maximumTroops === null ? `${band.minimumTroops}+ tropas` : `${band.minimumTroops}–${band.maximumTroops}`,
        value: `${band.diceCount} ${band.diceCount === 1 ? "dado" : "dados"}`,
      })),
      visual: "barriers",
    },
    {
      slug: "cartas",
      number: "09",
      eyebrow: "Reserva",
      title: "Cartas convertem conquista em capacidade futura.",
      lede: `Conquistar ao menos um território no turno rende ${guide.cards.cardsPerConqueringTurn} carta ao fim dele. Combinações válidas podem ser resgatadas durante o reforço para receber tropas.`,
      principles: [
        "Três símbolos iguais ou um de cada símbolo formam uma combinação válida; o coringa substitui símbolos.",
        `Com ${guide.cards.mandatoryTradeHandSize} ou mais cartas, o resgate é obrigatório antes de reforçar.`,
        `Controlar o território correspondente à carta concede +${guide.cards.ownedTerritoryBonus} tropas naquele território quando a carta é usada no resgate.`,
      ],
      metrics: guide.cards.tradeValues.slice(0, 4).map((value, index) => ({
        label: `${index + 1}º resgate pessoal`,
        value: `+${value} tropas`,
      })),
      visual: "cards",
    },
    {
      slug: "anomalias",
      number: "10",
      eyebrow: "Anomalias",
      title: "Eventos mudam o tabuleiro; não mudam a fonte da regra.",
      lede: `O build atual possui um catálogo ativo de ${EVENT_COUNT} estados de evento conectados por um grafo ponderado. Cada anomalia aplica efeitos definidos pela engine e pela topologia vigente.`,
      principles: [
        "Eventos podem alterar conexão, território, ataque ou outras condições temporárias previstas pela engine.",
        "A interface deve apresentar o efeito resolvido; ela não decide nem inventa a consequência.",
        "Ao remover tropas por evento, a regra preserva o mínimo de uma tropa em território ocupado.",
      ],
      metrics: [
        { label: "Estados do catálogo", value: String(EVENT_COUNT) },
        { label: "Seleção", value: "grafo ponderado" },
        { label: "Efeito", value: "resolvido pela engine" },
      ],
      visual: "events",
    },
    {
      slug: "vitoria",
      number: "11",
      eyebrow: "Fim de operação",
      title: "A partida termina quando a missão deixa de ser hipótese.",
      lede: "A vitória é avaliada contra o objetivo atribuído ao jogador. Domínio visual do mapa, quantidade de tropas ou cartas não substituem a condição explícita da missão.",
      principles: [
        "A verificação de vitória usa o estado autoritativo da partida.",
        "Objetivos privados continuam privados até que a experiência de jogo determine sua revelação.",
        "Quando a condição é satisfeita, a operação deixa de aceitar decisões competitivas normais.",
      ],
      metrics: [
        { label: "Critério", value: "objetivo" },
        { label: "Fonte", value: "estado autoritativo" },
        { label: "Resultado", value: "vitória" },
      ],
      visual: "victory",
    },
  ];

  return {
    chapters,
    combatExample: guide.combat.example,
    cards: {
      tradeValues: guide.cards.tradeValues,
      mandatoryTradeHandSize: guide.cards.mandatoryTradeHandSize,
      ownedTerritoryBonus: guide.cards.ownedTerritoryBonus,
    },
    reinforcement: {
      regions: guide.regions,
      baseExample: guide.reinforcement.baseExample,
      territoryExample: guide.reinforcement.territoryExample,
    },
    barrier: {
      attackDiceBands: guide.attack.barrierDiceBands,
      attackerLossPerComparison: guide.attack.barrierLossPerComparison,
      maneuverLoss: guide.maneuver.barrierLoss,
      blockedBarrierCount: guide.maneuver.blockedBarrierCount,
    },
  };
}
