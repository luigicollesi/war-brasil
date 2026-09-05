# WAR Brasil

WAR Brasil é um jogo de estratégia multiplayer por turnos inspirado no WAR, adaptado para um mapa do Brasil com 42 territórios. A aplicação reúne criação de salas, lobby sincronizado, distribuição inicial, tabuleiro interativo e persistência do estado da partida em PostgreSQL.

O projeto é desenvolvido com Next.js, React, TypeScript e Tailwind CSS, mantendo fronteiras explícitas entre código client-side, server-side e compartilhado. A ideia é evoluir as regras e o multiplayer sem acoplar a lógica do jogo à interface, preservando uma base que possa crescer sem depender de uma única camada da aplicação.

[**Jogar versão de produção**](https://war-brasil.vercel.app)

## Fluxo de branches

O repositório mantém apenas dois branches principais de longa duração:

- `main` — versão de produção e único branch ligado ao deploy da Vercel;
- `dev` — desenvolvimento ativo e integração das próximas mudanças, sem deploy na Vercel.

Branches adicionais são temporários e podem ser criados a partir de `dev` quando uma funcionalidade precisa ser desenvolvida de forma isolada ou quando há trabalho paralelo. Depois de validada, a mudança retorna para `dev`; somente versões consolidadas seguem de `dev` para `main`.

```text
branch temporário → dev → main
```

## Rotas

- `/` — apresentação e acesso ao jogo;
- `/matchmaking` — criação ou entrada em uma sala;
- `/lobby/[code]` — configuração sincronizada de jogadores antes da partida;
- `/game/[roomId]` — tabuleiro interativo com 42 territórios.

## Arquitetura

`src/lib` possui fronteiras explícitas entre `client/`, `server/` e `shared/`.
O Next.js continua responsável pela aplicação web e pelos Route Handlers em
`src/app/api`, que atuam como adaptadores HTTP para o código server-side.
Consulte `src/lib/README.md` para as regras de dependência e a estratégia de
compatibilidade durante a migração.

## Banco de dados

Copie `.env.example` para um arquivo de ambiente local e configure `DATABASE_URL`.
O pool PostgreSQL reutilizável fica em `src/lib/server/db/pool.ts` e só pode ser
importado por código executado no servidor. O caminho histórico
`src/lib/db/pool.ts` permanece temporariamente como reexport de compatibilidade.

O schema de `game_rooms` e `room_players` está em `src/lib/db/schema.sql` e
não é executado automaticamente pela aplicação. A lobby usa polling de um
segundo e o PostgreSQL permanece como fonte de verdade para jogadores, cores,
prontidão e início da partida.

Para bancos que já receberam o schema inicial, aplique também
`src/lib/db/migrations/002-game-initialization.sql`. Ela adiciona a fase de
sorteio, a distribuição de territórios, tropas e resultados dos dados.

Para habilitar turnos, objetivos e cartas em um banco que já recebeu a
migração anterior, aplique em seguida `src/lib/db/migrations/003-playable-game.sql`.
