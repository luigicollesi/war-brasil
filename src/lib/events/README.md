# Sistema de eventos

## Fase 1 — catálogo, grafo e seleção

- `event-types.ts`: contratos e validação dos efeitos configurados em `events.effects`.
- `event-selector.ts`: filtro do histórico e sorteio ponderado puro/determinístico.
- `event-repository.ts`: acesso SQL usando o `PoolClient` recebido pela transação do jogo.
- `event-selection-service.ts`: orquestra leitura do histórico, grafo e `crypto.randomInt`.
- `event-catalog.ts`: contrato estrutural do catálogo atual (eventos 0–37 e 195 conexões).
- `event-catalog-service.ts`: valida o catálogo persistido na borda server-side.

Invariantes de seleção:

- evento `0` pode ser origem, mas nunca destino;
- self-loops são inválidos;
- pesos precisam ser inteiros positivos;
- `event_connections.weight` é peso relativo, não sequência fixa;
- os quatro eventos mais recentes são excluídos quando houver alternativa;
- se o histórico eliminar todas as saídas, o selector volta às saídas originais;
- `game_round_events` é a fonte persistente do evento de cada rodada.

## Fase 2 — resolução e efeitos

- `event-resolver.ts`: transforma `EventEffect[]` em `ResolvedEventEffect[]` usando aleatoriedade injetada.
- `event-resolution-service.ts`: borda server-side que fornece `crypto.randomInt`, topologia base e proteção da conexão do Túnel Jurássico.
- `event-topology.ts`: aplica overlays temporários sem mutar `territory_connections` nem os objetos cacheados.
- `event-attack-rules.ts`: regra temporária de `BLOCK_ATTACK`.
- `event-effects-service.ts`: aplica somente efeitos permanentes de tropas em `game_territories`.
- `game-effective-connections.ts`: compõe topologia base → efeitos resolvidos → Túnel Jurássico.
- `game-effective-topology-service.ts`: carrega o evento da rodada exata e entrega a mesma topologia efetiva para ataque e manobra.

Invariantes de resolução:

- efeitos aleatórios são resolvidos uma única vez e o resultado concreto é persistível em `game_round_events.resolved_effects`;
- pares territoriais são canônicos e uma conexão não recebe duas alterações no mesmo evento;
- `OPEN_CONNECTIONS` só abre fronteiras base bloqueadas e `BLOCK_CONNECTIONS` só bloqueia fronteiras base abertas;
- `RANDOM_OPEN_CONNECTIONS` e `RANDOM_BLOCK_CONNECTIONS` sorteiam sem reposição;
- `RANDOM_TOGGLE_CONNECTIONS` move uma barreira entre duas conexões que compartilham o mesmo território e preserva seus metadados;
- efeitos temporários nunca executam `UPDATE territory_connections`;
- `REMOVE_TROOPS` usa mínimo de uma tropa;
- o Túnel Jurássico é aplicado por último e permanece uma conexão sintética;
- `BLOCK_ATTACK` impede apenas que o território listado seja origem de ataque.

## Transporte e sincronização

O snapshot continua transportando/cacheando somente a topologia base. O evento ativo transporta `eventId` e `resolvedEffects` separadamente. A hidratação deriva a topologia efetiva no cliente com a mesma composição usada pelo servidor, evitando divergência entre mapa, ataque e manobra.

## Próxima fase

A Fase 3 deve integrar o lifecycle atômico de rodada: trocar o Túnel Jurássico, escolher o próximo evento, resolver seus efeitos, registrar `game_round_events`, aplicar efeitos permanentes e incrementar a rodada dentro da mesma transação. O evento `0` será registrado no início com `resolvedEffects: []`, preservando a regra atual de uma tropa inicial sem reaplicar seu efeito configurado.
