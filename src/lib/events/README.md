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

## Fase 3 — lifecycle atômico da rodada

- `game-round-rules.ts`: regras puras de candidatos e escolha do Túnel Jurássico com aleatoriedade injetada.
- `game-round-service.ts`: orquestra início da rodada 1 e transições N → N+1 reutilizando o `PoolClient` da transação externa.
- `game-presentation-service.ts`: ao terminar o sorteio de ordem, cria primeiro a rodada 1/evento 0 e só então torna a sala `playing`.
- `game-command-service.ts`: detecta o wrap dos jogadores vivos e delega a nova rodada ao `game-round-service`.
- `event-selection-service.ts`: exige o evento da rodada atual exata em vez de usar simplesmente o último registro do histórico.
- `game-effective-topology-service.ts`: partidas ativas sem evento da rodada ou sem Túnel falham explicitamente em vez de receber fallback silencioso.

A rodada 1 registra o evento `0` com `resolvedEffects: []`. Seus efeitos configurados não são resolvidos nem aplicados; a distribuição normal continua responsável por iniciar cada território com uma tropa.

Nas rodadas seguintes a ordem é:

1. escolher o novo destino do Túnel;
2. escolher o próximo evento pelo grafo e histórico;
3. resolver efeitos aleatórios protegendo o novo Túnel;
4. persistir `game_round_events` da nova rodada;
5. aplicar efeitos permanentes de tropas;
6. atualizar `round_number` e `jurassic_tunnel_territory_id`;
7. concluir a troca de jogador/fase no mesmo `gameCommand`.

Nenhum serviço do lifecycle abre uma nova transação. O lock e o rollback continuam pertencendo a `gameCommand`/`gameConditionalCommand`, fazendo com que evento, efeitos, Túnel, rodada, jogador e revisão sejam commitados ou revertidos juntos.

O combate não possui mais self-healing para criar Túnel durante uma jogada. Estado `playing` sem evento da rodada ou sem Túnel é tratado como violação de invariante.

## Fase 4 — resultado factual e apresentação

- `game_round_events.applied_troop_changes`: registra `beforeTroops`, `afterTroops` e `delta` realmente aplicados por `ADD_TROOPS`/`REMOVE_TROOPS`.
- `event-effects-service.ts`: captura o estado anterior sob `FOR UPDATE`, aplica a alteração e produz o resultado factual sem alterar a semântica mecânica de `resolvedEffects`.
- `event-repository.ts`: persiste o resultado factual e oferece `getRoomRoundEventDetails`, um read model que une a rodada ao nome e à descrição do catálogo.
- `game-snapshot-service.ts`: expõe `name`, `description`, `resolvedEffects` e `appliedTroopChanges`; uma sala `playing` sem evento da rodada continua falhando rápido.
- `event-presentation.ts`: domínio puro que transforma estado estruturado da rodada em `TemporalAnomalyPresentation`, sempre usando nomes dos territórios.
- `use-temporal-anomaly.ts`: controla abertura automática e reabertura local por chave `roundNumber:eventId`.
- `temporal-anomaly-modal.tsx`: renderiza exclusivamente o presentation model e reutiliza o `GameModal` acessível existente.
- `game-client-v2.tsx`: oferece o botão persistente **Anomalia Temporal** e monta o modal da rodada atual.

`resolvedEffects` continua sendo a fonte das regras do jogo. `appliedTroopChanges` é uma trilha factual de apresentação/auditoria e não participa do cálculo de topologia ou permissões.

A ordem transacional das rodadas seguintes permanece protegida contra dupla aplicação:

1. persistir a nova rodada e `resolvedEffects`;
2. aplicar os efeitos permanentes;
3. persistir `applied_troop_changes` no mesmo registro;
4. atualizar a sala;
5. deixar o `gameCommand` realizar `revision++` e `COMMIT`.

Se qualquer etapa falhar, o rollback externo remove também o registro intermediário da rodada.

### Apresentação

O React não interpreta tipos como `ADD_TROOPS`, `BLOCK_ATTACK` ou `RANDOM_TOGGLE_CONNECTIONS`. Essa tradução pertence a `event-presentation.ts`. Isso permite reutilizar o mesmo modelo futuramente em histórico, replay ou log sem duplicar regra de copy em componentes.

O evento `0` possui somente uma exceção de apresentação: mostra o Túnel se manifestando e informa que todos os territórios já começaram com uma tropa e que nenhum reforço adicional foi aplicado.

Nas demais rodadas, a apresentação descreve o novo destino do Túnel e as mudanças concretas da rodada. `REMOVE_TROOPS` usa o delta factual, portanto um território limitado à tropa mínima nunca é anunciado como tendo perdido mais tropas do que realmente perdeu.

### Lifecycle visual

A chave visual da anomalia é `roundNumber:eventId`, não apenas `eventId`. Assim, um evento que volte várias rodadas depois abre novamente.

- nova chave em partida `playing`: abre automaticamente;
- polling da mesma chave: não reabre depois de fechado;
- botão **Anomalia Temporal**: reabre manualmente a rodada atual;
- refresh completo da página: novo mount, portanto a anomalia atual pode ser apresentada novamente;
- nenhum acknowledgment é persistido em banco, cookie, `localStorage` ou `sessionStorage`.

## Transporte e sincronização

O snapshot continua transportando/cacheando somente a topologia base. O evento ativo transporta seus efeitos resolvidos e metadados de apresentação separadamente. A hidratação deriva a topologia efetiva no cliente usando apenas `resolvedEffects`, preservando a mesma composição usada pelo servidor e evitando divergência entre mapa, ataque e manobra.
