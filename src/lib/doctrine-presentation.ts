import { buildGameGuidePresentation } from "./game-guide-presentation";
import { EVENT_COUNT } from "./shared/events/event-catalog";
import {
  JURASSIC_TUNNEL_SOURCE_ID,
} from "./shared/game-round-rules";
import { DEPARTURE_REDISTRIBUTED_TROOPS } from "./shared/game-departure-rules";

export const DOCTRINE_CHAPTER_SLUGS = [
  "preparacao",
  "objetivos",
  "turno",
  "trocas",
  "reforcos",
  "ataque",
  "conquista",
  "movimentacao",
  "barreiras-conexoes",
  "cartas",
  "anomalias",
  "retirada",
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
    | "trade"
    | "reinforcement"
    | "attack"
    | "conquest"
    | "maneuver"
    | "barriers"
    | "cards"
    | "events"
    | "departure"
    | "victory";
};

export type DoctrinePresentation = ReturnType<typeof buildDoctrinePresentation>;

export function isDoctrineChapterSlug(value: string | null | undefined): value is DoctrineChapterSlug {
  return DOCTRINE_CHAPTER_SLUGS.includes(value as DoctrineChapterSlug);
}

export function buildDoctrinePresentation() {
  const guide = buildGameGuidePresentation();

  const objectiveFormats = [
    {
      title: "DOMÍNIO",
      description: "Controlar territórios, regiões ou uma combinação dos dois.",
    },
    {
      title: "FORTIFICAÇÃO",
      description: "Manter a quantidade pedida de territórios com o número mínimo de tropas.",
    },
    {
      title: "ELIMINAÇÃO",
      description: "Eliminar o jogador indicado quando esse tipo de objetivo estiver valendo.",
    },
  ] as const;

  const chapters: readonly DoctrineChapter[] = [
    {
      slug: "preparacao",
      number: "01",
      eyebrow: "Preparação",
      title: "A partida começa dividindo o mapa.",
      lede: `A partida começa distribuindo os ${guide.territoryCount} territórios entre os jogadores. Cada território começa com ${guide.setup.initialTroopsPerTerritory} tropa.`,
      principles: [
        "Desde o começo, cada território já pertence a um jogador e já faz parte das suas fronteiras.",
        "A ordem dos jogadores é definida antes do primeiro turno e continua a mesma durante a partida.",
        "O objetivo de cada jogador continua secreto durante a preparação.",
      ],
      metrics: [
        { label: "Territórios", value: String(guide.territoryCount) },
        { label: "Regiões", value: String(guide.regionCount) },
        {
          label: "Tropas iniciais",
          value: `${guide.setup.initialTroopsPerTerritory} por território`,
        },
      ],
      visual: "setup",
    },
    {
      slug: "objetivos",
      number: "02",
      eyebrow: "Objetivos",
      title: "Você vence pelo seu objetivo, não por pontuação.",
      lede: "Cada jogador recebe um objetivo secreto. Esse objetivo diz o que ele precisa fazer para vencer.",
      principles: [
        "Um objetivo pode pedir territórios, regiões completas, uma quantidade mínima de tropas ou a eliminação de um jogador.",
        "Se um objetivo pedir mais de uma coisa, todas elas precisam ser cumpridas.",
        "Seu objetivo deve guiar suas jogadas, mas os outros jogadores não precisam saber qual é.",
      ],
      metrics: [
        { label: "Objetivo", value: "secreto" },
        { label: "Vitória", value: "ao cumprir o objetivo" },
        { label: "Pontuação", value: "não existe" },
      ],
      visual: "objectives",
    },
    {
      slug: "turno",
      number: "03",
      eyebrow: "Turno",
      title: "Seu turno acontece em quatro fases.",
      lede: "Se você for um jogador humano e tiver cartas, seu turno pode começar com Trocas. Depois vêm Reforços, Ataque e Manobra.",
      principles: [
        "As Trocas acontecem antes dos Reforços e servem apenas para trocar cartas entre jogadores.",
        "Você precisa distribuir seus Reforços. Atacar e fazer Manobra são escolhas suas, desde que a jogada seja permitida.",
        "Depois da Manobra, seu turno termina e a vez passa para o próximo jogador.",
      ],
      metrics: [
        { label: "Fase 1", value: "Trocas", detail: "Se houver cartas para negociar." },
        { label: "Fase 2", value: "Reforços", detail: "Você precisa distribuir seus reforços." },
        { label: "Fase 3", value: "Ataque", detail: "Você escolhe se quer atacar." },
        { label: "Fase 4", value: "Manobra", detail: "Você escolhe se quer mover tropas." },
      ],
      visual: "turn",
    },
    {
      slug: "trocas",
      number: "04",
      eyebrow: "Trocas",
      title: "Antes dos reforços, você pode trocar cartas com outro jogador.",
      lede: `Antes dos Reforços, o jogador humano da vez pode trocar cartas com outro jogador humano que ainda esteja na partida. Ele pode fazer até ${guide.playerTrade.offerLimitPerTurn} ofertas por turno. Os outros jogadores podem marcar até ${guide.playerTrade.signalLimitPerTurn} cartas que aceitam trocar.`,
      principles: [
        "Você pode pedir uma carta de um território, de um símbolo ou um coringa. Bots não participam das Trocas.",
        "O outro jogador pode aceitar, recusar ou fazer uma contraoferta. A troca precisa terminar ou ser cancelada antes dos Reforços.",
        "Quando a troca é aceita, cada jogador entrega a carta combinada. Trocar cartas não dá tropas; para ganhar tropas com cartas, é preciso fazer um resgate válido.",
      ],
      metrics: [
        { label: "Ofertas do turno", value: String(guide.playerTrade.offerLimitPerTurn) },
        { label: "Cartas marcadas", value: String(guide.playerTrade.signalLimitPerTurn) },
        { label: "Participantes", value: "jogadores humanos" },
      ],
      visual: "trade",
    },
    {
      slug: "reforcos",
      number: "05",
      eyebrow: "Reforços",
      title: "No começo dos Reforços, você recebe tropas para colocar no mapa.",
      lede: `O reforço base é metade dos territórios controlados, arredondada para baixo, respeitando o mínimo de ${guide.reinforcement.minimum} tropas. Regiões completas e resgates de cartas aumentam esse total.`,
      principles: [
        `Com ${guide.reinforcement.territoryExample} territórios, você recebe ${guide.reinforcement.baseExample} tropas de Reforço base.`,
        "Se você controlar uma região inteira, recebe também o bônus daquela região.",
        "Se você for obrigado a resgatar cartas, faça o resgate antes de terminar de colocar seus reforços.",
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
      number: "06",
      eyebrow: "Ataque",
      title: "Para atacar, os dois territórios precisam estar ligados e a origem precisa ter tropas suficientes.",
      lede: `Um ataque normal parte de um território próprio com pelo menos ${guide.attack.normalMinimumTroops} tropas para um território inimigo conectado. A quantidade de dados depende da força na origem.`,
      principles: [
        "O território de onde você ataca precisa ter uma ligação válida com o território inimigo.",
        "No empate entre dados comparados, a defesa vence a comparação.",
        "Em cada comparação de dados, o lado que perde remove uma tropa. Se houver uma barreira, o atacante pode perder mais.",
      ],
      metrics: guide.attack.normalDiceBands.map((band) => ({
        label: band.maximumTroops === null ? `${band.minimumTroops}+ tropas` : `${band.minimumTroops} tropas`,
        value: `${band.diceCount} ${band.diceCount === 1 ? "dado" : "dados"}`,
      })),
      visual: "attack",
    },
    {
      slug: "conquista",
      number: "07",
      eyebrow: "Conquista",
      title: "Depois de vencer a defesa, você precisa ocupar o território.",
      lede: `Quando a defesa chega a zero, o atacante precisa transferir tropas para o território conquistado e manter pelo menos ${guide.conquest.minimumTroopsLeftAtOrigin} tropa na origem.`,
      principles: [
        `A conquista exige mover pelo menos ${guide.conquest.minimumMove} tropa para o novo território.`,
        "O território de origem precisa ficar com pelo menos uma tropa.",
        "Assim que o território é ocupado, ele já passa a ser seu e pode mudar suas próximas opções de ataque e defesa.",
      ],
      metrics: [
        { label: "Origem", value: `≥ ${guide.conquest.minimumTroopsLeftAtOrigin} tropa` },
        { label: "Destino", value: `≥ ${guide.conquest.minimumMove} tropa` },
        { label: "Resultado", value: "território conquistado" },
      ],
      visual: "conquest",
    },
    {
      slug: "movimentacao",
      number: "08",
      eyebrow: "Manobra",
      title: "Na Manobra, você move tropas entre seus próprios territórios.",
      lede: `Na Manobra, você pode mover tropas que já estavam disponíveis no território. A origem precisa ficar com pelo menos ${guide.maneuver.minimumTroopsLeftAtOrigin} tropa, e tropas recebidas nessa mesma fase não podem ser movidas outra vez.`,
      principles: [
        "O território de origem e o destino precisam ser seus e precisam estar ligados por uma rota permitida.",
        "Tropas que acabaram de chegar por Manobra não podem ser movidas outra vez no mesmo turno.",
        "Se a rota passar por barreiras, aplique as perdas e os bloqueios da regra de travessia.",
      ],
      metrics: [
        { label: "Pode mover", value: `${guide.maneuver.example.movableBeforeReceiving} tropas` },
        { label: "Depois de receber 2", value: `${guide.maneuver.example.movableAfterReceiving} tropas ainda móveis` },
        { label: "Reserva", value: `${guide.maneuver.minimumTroopsLeftAtOrigin} na origem` },
      ],
      visual: "maneuver",
    },
    {
      slug: "barreiras-conexoes",
      number: "09",
      eyebrow: "Barreiras",
      title: "Algumas ligações do mapa têm barreiras.",
      lede: `Barreiras deixam a travessia mais difícil. Para atacar através de uma barreira, a origem precisa ter pelo menos ${guide.attack.barrierMinimumTroops} tropas. Cada comparação perdida pelo atacante remove ${guide.attack.barrierLossPerComparison} tropas.`,
      principles: [
        `Ao atravessar uma barreira durante a Manobra, você perde ${guide.maneuver.barrierLoss} tropa e precisa ter pelo menos ${guide.maneuver.barrierMinimumTroops} tropas disponíveis.`,
        `${guide.maneuver.blockedBarrierCount} ou mais barreiras na mesma rota impedem a Manobra.`,
        `O Túnel Jurássico sai do território ${JURASSIC_TUNNEL_SOURCE_ID} e pode levar a um destino diferente a cada rodada.`,
      ],
      metrics: guide.attack.barrierDiceBands.map((band) => ({
        label: band.maximumTroops === null ? `${band.minimumTroops}+ tropas` : `${band.minimumTroops}–${band.maximumTroops}`,
        value: `${band.diceCount} ${band.diceCount === 1 ? "dado" : "dados"}`,
      })),
      visual: "barriers",
    },
    {
      slug: "cartas",
      number: "10",
      eyebrow: "Cartas",
      title: "Você pode resgatar combinações de cartas para receber tropas.",
      lede: `Se você conquistar pelo menos um território no seu turno, recebe ${guide.cards.cardsPerConqueringTurn} carta no fim dele. Combinações válidas de cartas podem ser resgatadas por tropas.`,
      principles: [
        "Uma combinação válida pode ter três símbolos iguais ou um de cada símbolo. O coringa pode substituir qualquer símbolo.",
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
      number: "11",
      eyebrow: "Anomalias",
      title: "Anomalias mudam algumas regras do tabuleiro por um tempo.",
      lede: `Existem ${EVENT_COUNT} anomalias possíveis. Cada uma informa o que muda enquanto estiver ativa.`,
      principles: [
        "Uma anomalia pode mudar ligações do mapa, territórios, ataques ou outras regras por um tempo.",
        "Quando uma anomalia aparecer, siga exatamente o efeito mostrado nela.",
        `Se uma anomalia remover tropas de um território ocupado, pelo menos ${guide.anomalies.minimumTroopsAfterRemoval} tropa continua nele.`,
      ],
      metrics: [
        { label: "Anomalias", value: String(EVENT_COUNT) },
        { label: "Pode mudar", value: "mapa e combate" },
        { label: "Regra", value: "siga o efeito mostrado" },
      ],
      visual: "events",
    },
    {
      slug: "retirada",
      number: "12",
      eyebrow: "Saída da partida",
      title: "Se alguém sair da partida, o mapa é reorganizado.",
      lede: `Quando um jogador sai no meio da partida, as Trocas pendentes são canceladas e suas cartas vão para o descarte. Os territórios são embaralhados e redistribuídos tentando deixar a quantidade de territórios dos jogadores o mais equilibrada possível. Cada território redistribuído fica com ${DEPARTURE_REDISTRIBUTED_TROOPS} tropa. Depois disso, os objetivos são verificados novamente.`,
      principles: [
        "Os territórios de quem saiu são embaralhados e entregues um por um. A cada entrega, recebem primeiro os jogadores que têm menos territórios naquele momento. Se houver empate, a escolha entre eles é aleatória.",
        `Quando um território é redistribuído, ele fica com ${DEPARTURE_REDISTRIBUTED_TROOPS} tropa, não importa quantas tropas tinha antes. As cartas de quem saiu vão para o descarte e não passam diretamente para outro jogador.`,
        "Depois da redistribuição, o objetivo de todos os jogadores que continuam é verificado novamente. Se mais de um objetivo for concluído ao mesmo tempo, todos esses jogadores vencem.",
        "Essa é a única situação em que mais de um jogador pode vencer ao mesmo tempo.",
      ],
      metrics: [
        { label: "Cartas", value: "descarte" },
        { label: "Territórios", value: "distribuição equilibrada" },
        {
          label: "Tropas",
          value: `${DEPARTURE_REDISTRIBUTED_TROOPS} por território`,
        },
        { label: "Caso especial", value: "mais de um vencedor" },
      ],
      visual: "departure",
    },
    {
      slug: "vitoria",
      number: "13",
      eyebrow: "Vitória",
      title: "Você vence quando completa seu objetivo.",
      lede: "Para vencer, você precisa cumprir exatamente o seu objetivo. Ter muitos territórios, tropas ou cartas só vale se isso fizer parte dele.",
      principles: [
        "O jogo verifica se o seu objetivo foi cumprido.",
        "Seu objetivo continua secreto durante a partida.",
        "Quando o objetivo é cumprido, a partida termina.",
      ],
      metrics: [
        { label: "Critério", value: "objetivo" },
        { label: "Para vencer", value: "cumpra o objetivo" },
        { label: "Resultado", value: "vitória" },
      ],
      visual: "victory",
    },
  ];

  return {
    chapters,
    objectiveFormats,
    playerTrade: {
      offerLimitPerTurn: guide.playerTrade.offerLimitPerTurn,
      signalLimitPerTurn: guide.playerTrade.signalLimitPerTurn,
    },
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
    conquest: {
      minimumMove: guide.conquest.minimumMove,
      minimumTroopsLeftAtOrigin: guide.conquest.minimumTroopsLeftAtOrigin,
    },
    maneuver: {
      minimumTroopsLeftAtOrigin: guide.maneuver.minimumTroopsLeftAtOrigin,
      movableBeforeReceiving: guide.maneuver.example.movableBeforeReceiving,
      movableAfterReceiving: guide.maneuver.example.movableAfterReceiving,
    },
    barrier: {
      attackDiceBands: guide.attack.barrierDiceBands,
      attackerLossPerComparison: guide.attack.barrierLossPerComparison,
      maneuverLoss: guide.maneuver.barrierLoss,
      blockedBarrierCount: guide.maneuver.blockedBarrierCount,
    },
    anomalies: {
      eventCount: EVENT_COUNT,
      minimumTroopsAfterRemoval: guide.anomalies.minimumTroopsAfterRemoval,
    },
    departure: {
      redistributedTroops: DEPARTURE_REDISTRIBUTED_TROOPS,
    },
  };
}
