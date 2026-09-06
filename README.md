# WAR Brasil

WAR Brasil é um jogo de estratégia multiplayer por turnos inspirado no WAR, adaptado para um mapa do Brasil com 42 territórios. A aplicação reúne criação de salas, lobby sincronizado, distribuição inicial, tabuleiro interativo e persistência do estado da partida em PostgreSQL.

O projeto é desenvolvido com Next.js, React, TypeScript e Tailwind CSS, mantendo fronteiras explícitas entre código client-side, server-side e compartilhado. A ideia é evoluir as regras e o multiplayer sem acoplar a lógica do jogo à interface, preservando uma base que possa crescer sem depender de uma única camada da aplicação.

> Este branch contém o desenvolvimento ativo e pode incluir funcionalidades ainda em validação antes de seguirem para produção.

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
Consulte `src/lib/README.md` para as regras de dependência.

O realtime permanece em um processo separado em `realtime/`. No ambiente de
desenvolvimento, `npm run dev` coordena Next + gateway realtime sem fundir as
duas responsabilidades.

## Variáveis de ambiente

Use `.env.example` como referência pública e copie para um arquivo local ignorado:

```bash
cp .env.example .env.local
```

No mínimo, configure `DATABASE_URL` para o seu PostgreSQL. A referência já traz
os valores recomendados para desenvolvimento com realtime habilitado.

Para acesso pela rede local/celular, não fixe
`NEXT_PUBLIC_GAME_REALTIME_URL=ws://localhost:...`. O desenvolvimento usa
`NEXT_PUBLIC_GAME_REALTIME_PORT` e o cliente reaproveita o hostname pelo qual a
página foi aberta.

Segredos reais nunca devem ser adicionados ao `.env.example`.

## Banco de dados

O schema canônico para uma instalação limpa fica em `src/lib/db/schema.sql` e
as migrations gerenciadas convergem bancos existentes para o mesmo estado.
As tabelas da aplicação são separadas em três namespaces PostgreSQL:

- `game` — estado pertencente a uma partida;
- `catalog` — regras, mapa e outros dados de referência compartilhados;
- `ops` — estado operacional e histórico de migrations.

Os nomes físicos removem prefixos que ficaram redundantes depois da separação
por schema:

```text
game.rooms
game.players
game.territories
game.order_rolls
game.rematch_votes
game.player_objectives
game.cards
game.trade_offers
game.round_events

catalog.objectives
catalog.objective_rules
catalog.events
catalog.event_connections
catalog.bot_names
catalog.territory_card_symbols
catalog.territory_connections

ops.command_receipts
ops.pgmigrations
```

Views automaticamente atualizáveis em `public` ainda expõem temporariamente os
nomes legados (`game_rooms`, `room_players`, `game_cards`, etc.) para que
Next.js, realtime e worker continuem funcionando enquanto as queries são
migradas para nomes schema-qualified. As views serão removidas depois que todo
o runtime deixar de depender da interface antiga.

As migrations `002` a `025` em `src/lib/db/migrations/` formam o histórico
legado e não são reexecutadas pelo runner atual. Novas migrations começam em
`026` e ficam em `src/lib/db/migrations/managed/`, com execução registrada em
`ops.pgmigrations`.

Depois de criar o schema base ou ao atualizar o branch de desenvolvimento, use:

```bash
npm run db:migrate
```

`npm run db:prepare:dev` é um alias compatível para o mesmo runner. Ele ordena
as migrations gerenciadas, valida o histórico, usa advisory lock e executa as
pendências em uma única transação. `npm run dev` executa essa preparação antes
de subir os processos locais.

O CI valida tanto upgrade de um banco no estado v025 quanto instalação limpa
contra PostgreSQL real por meio de:

```bash
npm run test:db
```

PostgreSQL permanece como fonte autoritativa do estado do jogo. Realtime apenas
propaga revisions e eventos efêmeros, como sinalizações de posse.

## Desenvolvimento

Com `.env.local` configurado:

```bash
npm run dev
```

Por padrão, isso inicia:

- Next.js na porta `3000`;
- gateway realtime na porta `3001`;
- cliente realtime em modo `hybrid`;
- origem local/LAN detectada automaticamente pelo orquestrador de desenvolvimento.

Configurações explícitas no ambiente continuam prevalecendo sobre esses defaults.
