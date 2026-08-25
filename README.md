# WAR Brasil

Base inicial de um jogo de estratégia no mapa do Brasil, construída com Next.js,
React, TypeScript e Tailwind CSS.

## Rotas

- `/` — apresentação e acesso ao jogo;
- `/matchmaking` — criação ou entrada em uma sala;
- `/lobby/[code]` — configuração sincronizada de jogadores antes da partida;
- `/game/[roomId]` — tabuleiro interativo com 42 territórios.

## Banco de dados

Copie `.env.example` para um arquivo de ambiente local e configure `DATABASE_URL`.
O pool PostgreSQL reutilizável fica em `src/lib/db/pool.ts` e só pode ser importado
por código executado no servidor.

O schema de `game_rooms` e `room_players` está em `src/lib/db/schema.sql` e
não é executado automaticamente pela aplicação. A lobby usa polling de um
segundo e o PostgreSQL permanece como fonte de verdade para jogadores, cores,
prontidão e início da partida.

Para bancos que já receberam o schema inicial, aplique também
`src/lib/db/migrations/002-game-initialization.sql`. Ela adiciona a fase de
sorteio, a distribuição de territórios, tropas e resultados dos dados.

Para habilitar turnos, objetivos e cartas em um banco que já recebeu a
migração anterior, aplique em seguida `src/lib/db/migrations/003-playable-game.sql`.
