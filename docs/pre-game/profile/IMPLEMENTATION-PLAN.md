# Plano técnico — PROFILE V3 / Quartel do Comandante

Branch atual: `feature/auth-command-access`  
Rota própria: `/profile`  
Rota pública planejada: `/profile/[handle]`

## Objetivo

Integrar a PROFILE ao fluxo real de autenticação sem quebrar o jogo, lobby, realtime ou Foundation. A V3 preserva a UI do Quartel construída na V2 e substitui fixtures por dados persistidos por domínio.

## Princípio de implementação

Não haverá grande reescrita. A implementação será incremental e cada fase deve deixar a branch executável e testável.

Fontes de verdade:

- Better Auth / `auth.*` — autenticação e sessão;
- `profile.*` — identidade pública e privacidade;
- `social.*` — grafo social;
- Redis — presença efêmera;
- `game.*` — atividade e histórico;
- `catalog.*` — títulos/cosméticos.

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
DTO privado/público
       |
       v
ProfileCommandSnapshot / endpoints
       |
       v
Quartel do Comandante
```

## Fase 0 — Contrato V3

### Entregas

- atualizar `SPEC.md`;
- atualizar `EVAL.md`;
- atualizar este plano;
- formalizar fontes autoritativas e DTOs;
- registrar presença/activity como conceitos separados.

### Gate

Nenhuma migration ou endpoint deve contradizer `SPEC.md`/`EVAL.md`.

**Status:** em implementação nesta branch.

## Fase 1 — Profile database foundation

### Migration 034

Criar `034-profile-v3-foundation.sql`.

Alterar `profile.commanders` com campos mínimos:

- `bio`;
- `portrait_source`;
- `portrait_ref`;
- `last_seen_at`;
- `equipped_title_id` após criação das estruturas de título.

Criar `profile.privacy_settings`:

- `user_id` PK/FK;
- `presence_visibility`;
- `activity_visibility`;
- `history_visibility`;
- `friend_request_policy`;
- `updated_at`.

Criar `catalog.commander_titles`:

- id;
- nome;
- descrição;
- raridade;
- ativo;
- timestamps necessários.

Criar `profile.commander_titles`:

- `user_id`;
- `title_id`;
- `unlocked_at`;
- PK composta.

### Integridade

- preservar FK 1:1 entre commander e auth user;
- manter handle normalized unique;
- impedir valores inválidos de privacy por CHECK;
- impedir equipar título de outro usuário por FK composta quando possível;
- não mover credenciais ou dados Better Auth para profile.

### Testes

Atualizar `tests/integration/database-migration.test.mjs` para:

- migration history 034;
- novas tabelas físicas;
- novas colunas;
- constraints/FKs;
- upgrade de baseline;
- execução idempotente pelo runner.

## Fase 2 — Social database foundation

### Migration 035

Criar schema `social`.

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

## Fase 3 — DAL, repositories e DTOs

Criar `src/lib/server/profile/`.

Arquivos alvo:

- `profile-repository.ts`;
- `profile-service.ts`;
- `profile-dto.ts`;
- `profile-history.ts`;
- `profile-search.ts`;
- `social-repository.ts`;
- `social-service.ts`;
- `presence-service.ts`.

### Regra

Componentes React não executam SQL.

Route Handlers não retornam rows internos diretamente.

### DTOs

Separar explicitamente:

- `OwnCommanderProfileDTO`;
- `PublicCommanderProfileDTO`;
- `CommanderSearchDTO`;
- `FriendRosterDTO`.

## Fase 4 — Snapshot autenticado real

Alterar `getCurrentProfileCommandSnapshot()`.

Fluxo normal:

1. obter sessão Better Auth server-side;
2. obter commander real;
3. compor identidade;
4. compor social disponível;
5. compor histórico disponível;
6. manter wallet/store `unavailable` até fonte real existir;
7. retornar contrato já consumido pela UI.

`PROFILE_EVAL_MODE` continua sendo a única entrada para fixtures completas.

## Fase 5 — Search e Profile APIs

Endpoints previstos:

- `PATCH /api/profile/me`;
- `GET /api/profile/commanders/search?q=`;
- endpoints sociais da fase seguinte;
- heartbeat de presença em fase própria.

A busca atual será migrada do provider local para SQL server-side mantendo:

- mínimo 2 chars;
- máximo 64 chars;
- máximo 8 resultados;
- `private, no-store`;
- nenhuma listagem global no browser.

Cada endpoint protegido usa `withAuthenticatedApi` ou verificação equivalente dentro do próprio handler.

## Fase 6 — Social service + APIs

Implementar operações:

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

Não criar índice extra antes de medir a query. Se necessário, justificar com `EXPLAIN (ANALYZE, BUFFERS)`.

## Fase 8 — Presence V1

O gateway realtime atual é por sala e autentica assentos de jogo. Não será acoplado à presença global nesta fase.

Criar presence independente:

- endpoint autenticado de heartbeat;
- chave Redis `presence:user:<userId>` ou namespace equivalente;
- heartbeat aproximado 30s;
- TTL aproximado 90s;
- leitura em lote para roster;
- `last_seen_at` PostgreSQL atualizado com throttle, não a cada heartbeat.

Falha Redis => `unavailable`.

## Fase 9 — Perfil público

Criar `/profile/[handle]`.

Resolver commander por handle normalizado.

Aplicar:

1. viewer autenticado;
2. relationship/block;
3. privacy settings;
4. projection pública;
5. DTO público mínimo.

Nunca enviar DTO próprio completo e esconder campos no cliente.

## Fase 10 — Avatar/storage

Criar interface de armazenamento independente de provider.

`ProfilePortraitStorage` deve abstrair:

- upload;
- delete/replace quando necessário;
- resolução de URL pública/assinada.

Upload inicial aceita somente formatos raster permitidos e possui limite explícito de bytes.

OAuth image MAY ser usada como seed inicial sem virar fonte permanente obrigatória.

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

Medir:

- profile snapshot;
- busca;
- friend roster;
- activity;
- history;
- presence batch.

Só então adicionar otimizações de índice adicionais.

## Fase 12 — Evidência visual

Revalidar V2 em:

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

## Estratégia de rollout

A implementação deve permitir fases intermediárias seguras.

Ordem recomendada de ativação:

1. migrations;
2. DAL read-only;
3. snapshot real de identidade;
4. search real;
5. social writes;
6. histórico/activity;
7. presence;
8. perfil público;
9. avatar upload.

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
- não misturar wallet/store real nesta trilha.

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
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Próxima ação técnica

Após a Fase 0, implementar exclusivamente a migration `034-profile-v3-foundation.sql` e seus testes de integração antes de alterar o runtime da PROFILE.
