# Sistema de eventos — Fase 1

Esta fase implementa somente a fundação do sistema de anomalias temporais.

## Responsabilidades

- `event-types.ts`: contratos e validação dos efeitos configurados em `events.effects`.
- `event-selector.ts`: filtro do histórico e sorteio ponderado puro/determinístico.
- `event-repository.ts`: acesso SQL usando o `PoolClient` recebido pela transação do jogo.
- `event-selection-service.ts`: orquestra leitura do histórico, grafo e `crypto.randomInt`.
- `event-catalog.ts`: contrato estrutural do catálogo atual (eventos 0–37 e 195 conexões).
- `event-catalog-service.ts`: valida o catálogo persistido na borda server-side.

## Invariantes

- evento `0` pode ser origem, mas nunca destino;
- self-loops são inválidos;
- pesos precisam ser inteiros positivos;
- o sorteio usa `event_connections.weight` como peso relativo, não como sequência fixa;
- os quatro eventos mais recentes são excluídos quando houver alternativa;
- se o histórico eliminar todas as saídas, o selector volta às saídas originais;
- o resultado aleatório é escolhido no servidor;
- `game_round_events` é a fonte persistente do evento de cada rodada.

## Catálogo existente

Os registros históricos de `events` e `event_connections` já existentes no banco são preservados. A migration `008-event-catalog-validation.sql` valida a forma esperada quando o catálogo está populado e não bloqueia um banco novo ainda vazio.

A aplicação de efeitos, a integração com o Túnel Jurássico, a virada de rodada, snapshot e UI pertencem às fases seguintes.
