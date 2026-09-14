# Plano técnico — PROFILE V3 / Quartel do Comandante

Branch atual: `feature/auth-command-access`  
Rota própria: `/profile`  
Rota pública planejada: `/profile/[handle]`

## Objetivo

Integrar a PROFILE ao fluxo real de autenticação sem quebrar o jogo, lobby, realtime ou Foundation. A V3 preserva a identidade visual do Quartel construída na V2 e substitui fixtures por dados persistidos por domínio.

A PROFILE V3 **não possui imagens de perfil, avatares ou retratos de comandante**. A identidade visual de um comandante é representada por nome, handle, título, estado, atividade e elementos tipográficos/monogramas gerados pela própria interface.

## Princípio de implementação

Não haverá grande reescrita. A implementação será incremental e cada fase deve deixar a branch executável e testável.

Fontes de verdade:

- Better Auth / `auth.*` — autenticação e sessão;
- `profile.*` — identidade pública e privacidade;
- `social.*` — grafo social;
- Redis — presença efêmera;
- `game.*` — atividade e histórico;
- `catalog.*` — títulos e outros cosméticos que não representem imagem de perfil.

## Regra arquitetural — nenhum perfil possui imagem

Esta regra é obrigatória em todas as camadas.

### Produto/UI

- não existe foto de perfil;
- não existe avatar;
- não existe retrato selecionável;
- não existe upload de imagem pessoal;
- não existe fallback para imagem OAuth;
- não existe catálogo de retratos de comandante;
- listas sociais, busca e perfil público usam identidade textual e, quando necessário, monograma/iniciais gerados pela UI;
- assets decorativos do jogo continuam permitidos, desde que não funcionem como imagem identificadora do perfil do usuário.

### Auth

O Better Auth/OAuth pode manter internamente campos próprios como `auth."user".image` porque fazem parte do schema controlado pela biblioteca/provedor.

War-Brasil deve:

- não usar `session.user.image` como dado de Profile;
- não copiar imagem OAuth para `profile.*`;
- não retornar imagem OAuth em DTOs de Profile;
- não renderizar imagem OAuth em `/profile`, `/profile/[handle]`, busca ou Rede de Comando;
- não alterar manualmente o core schema do Better Auth apenas para remover uma coluna que a biblioteca espera administrar.

### Profile database

`profile.*` não deve possuir estado autoritativo relacionado a avatar/retrato.

Consequentemente:

- `profile.commanders.portrait_source` deve ser removido;
- `profile.commanders.portrait_ref` deve ser removido;
- nenhuma nova coluna equivalente deve ser criada;
- nenhuma tabela de upload/storage de avatar deve existir;
- títulos continuam válidos porque são identidade textual/cosmética e não imagem de perfil.

### Contratos e DTOs

Remover do domínio de Profile:

- `CommanderPortrait`;
- `CommanderPortraitDto`;
- propriedades `portrait` de identidade, contatos, busca e perfil público;
- qualquer função como `portraitFromRow`, `safeProfilePortraitSrc` ou equivalente;
- qualquer allowlist de host criada exclusivamente para imagens de perfil.

DTO público e privado não devem transportar URL de imagem de perfil.

## Estado atual aproveitado

A branch já possui:

- Better Auth 1.7.4 integrado;
- `auth."user"`, `session`, `account`, `verification` e rate limit;
- `profile.commanders(user_id, handle, display_name)`;
- `game.players.user_id`, `display_name_snapshot`, `handle_snapshot`;
- `game.rooms.match_mode` e `finished_at`;
- `getAuthenticatedSession`, `requireAuthenticatedSession` e `withAuthenticatedApi`;
- PROFILE V2 baseada em `ProfileCommandSnapshot`;
- busca social desacoplada do snapshot;
- realtime de jogo por sala;
- Redis já disponível na infraestrutura realtime quando configurado.

### Estado transitório a remover

A implementação atual da branch chegou a introduzir suporte a retrato/avatar antes desta nova decisão de produto. Portanto podem existir temporariamente:

- `portrait_source` / `portrait_ref` em `profile.commanders`;
- leitura de `auth."user".image`;
- tipos `CommanderPortrait*`;
- políticas/allowlists de imagem;
- propriedades `portrait` em DTOs;
- `<Image>` ou `<img>` em componentes de Profile;
- lógica de fallback OAuth.

Esses elementos passam a ser dívida técnica explícita e devem ser eliminados nas fases abaixo.

Não reescrever migrations que já possam ter sido aplicadas em ambientes compartilhados. A remoção física do schema deve ocorrer por **nova migration forward-only**.

## Decisões fechadas

1. Não ampliar `auth.user` com dados de jogo/social quando esses dados pertencem a outro domínio.
2. `session.user.id` é a única identidade autoritativa do ator autenticado.
3. Não persistir `is_online` em PostgreSQL.
4. Não persistir `in_match`/`in_lobby` em PROFILE.
5. Não criar tabela paralela de histórico enquanto `game.*` atender o contrato.
6. PROFILE próprio e público usarão DTOs distintos.
7. Fixtures continuam apenas para EVAL.
8. Constraints de banco protegem invariantes sociais críticas.
9. Redis indisponível produz `presence=unavailable`.
10. O realtime atual de sala não será reescrito para presença global nesta trilha.
11. Nenhum usuário possui imagem de perfil no domínio War-Brasil.
12. Imagens fornecidas por OAuth não fazem parte da identidade pública do comandante.
13. Não haverá upload, storage, catálogo ou configuração de avatar/retrato.
14. Monogramas/iniciais são apresentação derivada de texto, nunca estado persistido de imagem.

## Arquitetura alvo

```text
Better Auth session
       |
       v
Profile/Social services
       |
       +--> profile.*
       +--> social.*
       +--> game.*
       +--> Redis presence
       |
       v
DTO privado/público sem imagem de perfil
       |
       v
ProfileCommandSnapshot / endpoints
       |
       v
Quartel do Comandante
       |
       +--> identidade textual / monograma derivado
```

## Fase 0 — Contrato V3

### Entregas

- atualizar `SPEC.md`;
- atualizar `EVAL.md`;
- atualizar este plano;
- formalizar fontes autoritativas e DTOs;
- registrar presença/activity como conceitos separados;
- registrar explicitamente que imagem de perfil é inexistente no produto.

### Gate

Nenhuma migration, endpoint, DTO ou componente pode contradizer `SPEC.md`/`EVAL.md`.

Deve existir um gate específico garantindo ausência de imagem de perfil em contratos públicos e privados.

**Status:** regra de ausência de imagem incorporada ao plano; SPEC/EVAL ainda devem ser sincronizados antes da implementação de remoção.

## Fase 1 — Profile database foundation

### Modelo alvo

`profile.commanders` deve conter apenas os campos necessários ao domínio de identidade textual e estado persistente:

- `user_id`;
- `handle`;
- `display_name`;
- `bio`;
- `last_seen_at`;
- `equipped_title_id`;
- timestamps necessários.

Não fazem parte do modelo alvo:

- `portrait_source`;
- `portrait_ref`;
- avatar URL;
- storage key de imagem;
- mime type de avatar;
- qualquer campo equivalente de retrato.

Criar/manter `profile.privacy_settings`:

- `user_id` PK/FK;
- `presence_visibility`;
- `activity_visibility`;
- `history_visibility`;
- `friend_request_policy`;
- `updated_at`.

Criar/manter `catalog.commander_titles`:

- id;
- nome;
- descrição;
- raridade;
- ativo;
- timestamps necessários.

Criar/manter `profile.commander_titles`:

- `user_id`;
- `title_id`;
- `unlocked_at`;
- PK composta.

### Migration de limpeza de imagem

Como migrations anteriores da branch podem já ter criado `portrait_source` e `portrait_ref`, não alterar o histórico aplicado em-place.

Criar a próxima migration disponível, por exemplo `036-profile-remove-portraits.sql` se essa numeração continuar livre no HEAD de implementação, para:

1. remover constraints/indexes dependentes de portrait, se existirem;
2. remover `profile.commanders.portrait_source`;
3. remover `profile.commanders.portrait_ref`;
4. remover estruturas de catálogo/storage criadas exclusivamente para avatar, caso existam;
5. manter intacto `auth."user".image`, pois pertence ao Better Auth e apenas será ignorado pelo domínio Profile.

A numeração final deve ser confirmada contra o HEAD antes da implementação.

### Integridade

- preservar FK 1:1 entre commander e auth user;
- manter handle normalized unique;
- impedir valores inválidos de privacy por CHECK;
- impedir equipar título de outro usuário por FK composta quando possível;
- não mover credenciais ou dados Better Auth para profile;
- não manter referência órfã de avatar/retrato no domínio Profile.

### Testes

Atualizar `tests/integration/database-migration.test.mjs` para provar:

- migration history completa;
- modelo final sem colunas de portrait;
- upgrade a partir do estado que ainda contém portrait;
- constraints/FKs preservadas;
- execução idempotente pelo runner;
- `auth."user".image` não é usado como justificativa para recriar portrait no domínio Profile.

## Fase 2 — Social database foundation

Criar/manter schema `social`.

Criar:

`social.friend_requests`

- UUID id;
- requester UUID;
- recipient UUID;
- state;
- created_at;
- resolved_at;
- CHECK requester != recipient.

`social.friendships`

- `user_a_id`;
- `user_b_id`;
- created_at;
- PK composta;
- ordem canônica do par.

`social.blocks`

- blocker_id;
- blocked_id;
- created_at;
- PK composta;
- CHECK blocker != blocked.

### Índice crítico

Usar unique partial expression index para existir no máximo um request pendente por par, independentemente da direção.

### Gate

Testes concorrentes precisam provar que constraints, e não apenas TypeScript, impedem estados inválidos.

Nenhuma tabela social deve duplicar URL ou referência de imagem de Profile.

## Fase 3 — DAL, repositories e DTOs

Manter `src/lib/server/profile/` como fronteira server-only.

Arquivos alvo:

- `profile-repository.ts`;
- `profile-service.ts`;
- `profile-dto.ts` ou contratos equivalentes;
- `profile-history.ts`;
- `profile-search.ts`;
- `social-repository.ts`;
- `social-service.ts`;
- `presence-service.ts`.

### Regra

Componentes React não executam SQL.

Route Handlers não retornam rows internos diretamente.

Repositories não devem selecionar `auth."user".image` para compor Profile.

### DTOs

Separar explicitamente:

- `OwnCommanderProfileDTO`;
- `PublicCommanderProfileDTO`;
- `CommanderSearchDTO`;
- `FriendRosterDTO`.

Nenhum desses DTOs possui `portrait`, `avatar`, `image`, `imageUrl` ou campo equivalente.

## Fase 4 — Snapshot autenticado real

Alterar/manter `getCurrentProfileCommandSnapshot()`.

Fluxo normal:

1. obter sessão Better Auth server-side;
2. obter commander real;
3. compor identidade textual;
4. compor social disponível;
5. compor histórico disponível;
6. manter wallet/store `unavailable` até fonte real existir;
7. retornar contrato já consumido pela UI.

A identidade contém, quando aplicável:

- display name;
- handle;
- bio;
- título;
- presença;
- atividade.

Não contém imagem.

`PROFILE_EVAL_MODE` continua sendo a única entrada para fixtures completas e suas fixtures também não podem conter retratos.

## Fase 5 — Search e Profile APIs

Endpoints previstos/manutenidos:

- `PATCH /api/profile/me`;
- `GET /api/profile/commanders/search?q=`;
- endpoints sociais da fase seguinte;
- heartbeat de presença em fase própria.

Não criar:

- `/api/profile/avatar`;
- `/api/profile/portrait`;
- endpoint de upload/reset de foto;
- endpoint de seleção de retrato.

A busca SQL server-side mantém:

- mínimo 2 chars;
- máximo 64 chars;
- máximo 8 resultados;
- `private, no-store`;
- nenhuma listagem global no browser;
- resultado sem imagem de perfil.

Cada endpoint protegido usa `withAuthenticatedApi` ou verificação equivalente dentro do próprio handler.

## Fase 6 — Social service + APIs

Implementar/manter operações:

- send request;
- cancel request;
- accept;
- reject;
- remove friend;
- block;
- unblock.

### Transações

`accept`:

1. BEGIN;
2. lock request `FOR UPDATE`;
3. validar destinatário e estado;
4. verificar bloqueios;
5. inserir friendship canônica;
6. marcar request accepted;
7. COMMIT.

`block`:

1. BEGIN;
2. inserir block;
3. remover friendship do par;
4. cancelar/remover pending requests do par;
5. COMMIT.

Operações repetidas devem ter comportamento idempotente ou erro de domínio estável conforme EVAL.

UI social deve identificar comandantes por nome/handle/monograma textual, nunca por imagem.

## Fase 7 — Activity e histórico real

### Activity

Derivar de `game.players.user_id + game.rooms`.

Mapeamento:

- `waiting`/`order_roll` => lobby;
- `playing` => match;
- sem room ativa => idle.

### Histórico

Usar `game.rooms` e `game.players`.

Primeiro corte:

- page size 20;
- buscar 21 para `hasMore`;
- cursor composto por `finished_at + room_id`;
- keyset pagination;
- snapshots históricos de handle/display name.

Histórico não persiste nem projeta imagem de participante.

Não criar índice extra antes de medir a query. Se necessário, justificar com `EXPLAIN (ANALYZE, BUFFERS)`.

## Fase 8 — Presence V1

O gateway realtime atual é por sala e autentica assentos de jogo. Não será acoplado à presença global nesta fase.

Criar/manter presence independente:

- endpoint autenticado de heartbeat;
- chave Redis `presence:user:<userId>` ou namespace equivalente;
- heartbeat aproximado 30s;
- TTL aproximado 90s;
- leitura em lote para roster;
- `last_seen_at` PostgreSQL atualizado com throttle, não a cada heartbeat.

Falha Redis => `unavailable`.

## Fase 9 — Perfil público

Criar/manter `/profile/[handle]`.

Resolver commander por handle normalizado.

Aplicar:

1. viewer autenticado;
2. relationship/block;
3. privacy settings;
4. projection pública;
5. DTO público mínimo.

O cabeçalho público deve usar identidade tipográfica, título e monograma derivado quando necessário.

Nunca enviar DTO próprio completo e esconder campos no cliente.

Nunca usar imagem OAuth como fallback visual.

## Fase 10 — Remoção completa do conceito de avatar

Esta fase substitui integralmente o antigo plano de `Avatar/storage`.

### Banco

- aplicar migration forward-only que remova os campos de portrait do domínio `profile`;
- remover estruturas auxiliares de portrait que tenham sido criadas;
- manter o core Better Auth intacto.

### Backend

Remover:

- `ProfilePortraitStorage`;
- políticas de URL de imagem de perfil;
- leitura de `auth."user".image` para Profile;
- transformações/fallbacks OAuth;
- propriedades portrait/avatar dos DTOs;
- qualquer código de upload, delete ou replace de imagem.

### Frontend

Remover:

- `next/image` usado especificamente para avatar/retrato;
- `<img>` de comandante;
- preview de foto;
- botão de upload/alteração/reset;
- item de loja/cosmético do tipo retrato.

Substituir a composição visual por:

- nome;
- handle;
- título;
- monograma/iniciais gerados em runtime;
- molduras, insígnias e elementos gráficos não-fotográficos que não funcionem como imagem de perfil persistida.

### Gate

Uma busca de código deve provar ausência de conceitos de avatar/retrato nos contratos do domínio Profile, exceto:

- documentação histórica explicitamente marcada como legado;
- campos internos controlados pelo Better Auth que não são consumidos pela aplicação.

## Fase 11 — Hardening e performance

Rodar:

- TypeScript;
- lint;
- testes unitários;
- auth E2E existentes;
- migration integration;
- social concurrency;
- Profile E2E;
- realtime regressions;
- build.

Adicionar testes específicos:

- Profile próprio não retorna `portrait/avatar/image`;
- busca não retorna `portrait/avatar/image`;
- roster social não retorna `portrait/avatar/image`;
- perfil público não retorna `portrait/avatar/image`;
- OAuth com `user.image` preenchido continua sem imagem no Profile;
- OAuth sem imagem produz exatamente o mesmo contrato visual;
- nenhuma rota de upload de avatar existe;
- migrations finais não mantêm `portrait_source`/`portrait_ref`.

Medir:

- profile snapshot;
- busca;
- friend roster;
- activity;
- history;
- presence batch.

Só então adicionar otimizações de índice adicionais.

## Fase 12 — Evidência visual

Revalidar V2/V3 em:

- 1440x900;
- 390x844;
- reduced-motion;
- WebGL fallback;
- loaded;
- partial;
- empty social;
- empty history;
- profile público;
- usuário online;
- usuário em partida;
- presença unavailable.

A evidência deve mostrar que a composição continua visualmente forte sem reservar espaço vazio para foto/retrato.

Monogramas/iniciais devem ser legíveis, consistentes e não provocar layout shift.

## Estratégia de rollout

A implementação deve permitir fases intermediárias seguras.

Ordem recomendada a partir da nova regra:

1. sincronizar SPEC/EVAL com a proibição de imagens de perfil;
2. remover portrait/avatar dos contratos TypeScript e DTOs;
3. remover leitura de `auth.user.image` e políticas de imagem;
4. adaptar componentes para identidade textual/monograma;
5. aplicar migration forward-only removendo portrait do `profile.*`;
6. ajustar fixtures e testes;
7. revalidar social/history/presence/profile público;
8. concluir hardening e evidência visual.

A remoção deve ser feita em cortes que mantenham compilação e testes verdes, evitando remover primeiro a coluna que runtime ainda consome.

Nenhuma fase deve exigir reescrever o realtime de jogo existente.

## Não fazer

- não alterar Better Auth core schema manualmente além das migrations geradas/necessárias à própria auth;
- não reaproveitar `player_session` como identidade de conta;
- não armazenar online/offline durável como boolean;
- não aceitar `user_id` do browser para autoria;
- não expor email/tokens/IDs internos no Profile;
- não criar histórico duplicado;
- não introduzir WebSocket global antes de haver necessidade comprovada;
- não adicionar índices preventivos sem padrão de consulta claro;
- não misturar wallet/store real nesta trilha;
- não criar imagem de perfil, avatar ou retrato;
- não usar imagem OAuth como fallback;
- não criar upload de imagem de usuário;
- não persistir URL/storage key de foto de perfil;
- não criar cosmético do tipo portrait/avatar;
- não reintroduzir imagem de perfil por meio de um DTO genérico ou campo `image` ambíguo.

## Referências técnicas

- Next.js Authentication / DAL / DTO: https://nextjs.org/docs/app/guides/authentication
- Better Auth Database: https://better-auth.com/docs/concepts/database
- Better Auth Session Management: https://better-auth.com/docs/concepts/session-management
- PostgreSQL Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL Expression Indexes: https://www.postgresql.org/docs/current/indexes-expressional.html
- PostgreSQL Partial Indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- Redis EXPIRE: https://redis.io/docs/latest/commands/expire/
- OWASP Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP IDOR: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html

A referência OWASP File Upload deixa de fazer parte desta trilha porque Profile não terá upload de imagem.

## Próxima ação técnica

Antes de remover código/runtime, sincronizar `SPEC.md` e `EVAL.md` com esta regra.

Depois disso, executar a remoção em ordem segura:

1. contratos/DTOs;
2. services/repositories;
3. UI/fixtures;
4. migration forward-only;
5. testes/E2E.

A migration definitiva deve usar a próxima numeração livre do HEAD e não deve reescrever migrations que já possam ter sido executadas.