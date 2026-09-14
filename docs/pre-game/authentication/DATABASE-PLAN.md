# Plano de Banco — Authentication + PROFILE / Quartel do Comandante

**Branch:** `feature/auth-command-access`  
**Relaciona:** `SPEC.md`, `EVAL.md`, `../profile/SPEC.md`, `../profile/EVAL.md` e `../profile/IMPLEMENTATION-PLAN.md`.  
**Objetivo:** fazer a autenticação nascer com um modelo de dados capaz de substituir as fixtures atuais da PROFILE sem criar uma tabela monolítica de usuário nem duplicar estado já pertencente ao jogo.

## 1. Princípio de arquitetura

A PROFILE é um **read model composto**. Nenhuma tabela isolada precisa ou deve conter o Quartel inteiro.

O snapshot público continua organizado nas cinco áreas atuais:

```text
Dossiê          <- auth + profile + social presence
Tesouraria      <- economy
Rede de Comando <- social + profile + game
Livro de Campanha <- game + profile + social
Intendência     <- catalog + profile inventory + economy
```

O banco MUST preservar ownership por domínio:

```text
auth      identidade de login, sessão, providers e verification
profile   identidade pública, loadout e cosméticos possuídos
social    relacionamentos e presença efêmera
economy   moedas, saldos e ledger
catalog   itens cosméticos/preços/vitrine (schema já existente)
game      salas, assentos, partidas e histórico factual (schema já existente)
ops       infraestrutura operacional já existente
```

MUST NOT criar uma `users`/`profiles` gigante com saldo, amigos, vitórias, rank, inventário e sessão na mesma linha.

## 2. Mapeamento exato da PROFILE para fontes reais

O contrato vigente da PROFILE exige:

- `displayName`, `handle`, título cosmético, retrato e presença;
- duas moedas (`campaign-credit`, `command-reserve`);
- amigos, solicitações, contatos recentes e busca;
- histórico recente paginado com participantes;
- showcase cosmético com `portrait`, `frame`, `title` e `insignia`.

A fonte planejada é:

| Campo da PROFILE | Fonte persistida | Derivado em leitura? |
| --- | --- | --- |
| `displayName` | `profile.commanders.display_name` | não |
| `handle` | `profile.commanders.handle` | normalização/lookup somente |
| `title` | `profile.commander_loadout.title_item_id` + `catalog.cosmetic_items` | sim |
| retrato cosmético | `profile.commander_loadout.portrait_item_id` + catálogo | sim |
| retrato OAuth fallback | `auth.user.image` | sim; somente fallback |
| monograma | nenhuma coluna | sim de `displayName`/`handle` |
| presença | `social.presence_leases` | sim; `offline` = nenhuma lease ativa quando a fonte está disponível |
| saldo comum/premium | `economy.wallets` | não; saldo corrente é estado persistido |
| labels/símbolos das moedas | `economy.currencies` | não |
| amigos | `social.relationships(status='accepted')` | consulta |
| solicitações recebidas | `social.relationships(status='pending')` | consulta |
| `mutualContacts` | grafo de amizades aceitas | **sim; não persistir contador** |
| `totalFriends` | grafo de amizades aceitas | **sim; não persistir contador** |
| contatos recentes | partidas finalizadas + `game.players.user_id` | **sim; não criar tabela inicialmente** |
| `operationCode` | `game.rooms.code` | não |
| `playedAt` | `game.rooms.finished_at` | não |
| vitória/derrota | `winner_player_id` versus assento do usuário | **sim** |
| `mode` | `game.rooms.match_mode` | não |
| duração | `finished_at - started_at` | **sim** |
| participantes | `game.players` + snapshots públicos | consulta |
| `isFriend` de participante | `social.relationships` atual | **sim; nunca persistir no histórico** |
| itens da Intendência | `catalog.cosmetic_items` + showcase | consulta |
| preço/moeda | `catalog.cosmetic_prices` | consulta |
| item possuído | `profile.user_cosmetics` | consulta; não faz parte do preview atual |

## 3. `auth` permanece mínimo

Better Auth continua dono das tabelas core:

```text
auth.user
auth.session
auth.account
auth.verification
auth.rate_limit        # se rate limit persistido for ativado
```

Campos de domínio da PROFILE MUST NOT ser adicionados ao `auth.user` apenas por conveniência.

Em especial, MUST NOT colocar em `auth.user`:

- moedas/saldos;
- título cosmético selecionado;
- amizade;
- presença;
- rank/nível/vitórias;
- inventário;
- histórico de partida.

`auth.user.name` e `auth.user.image` podem existir porque pertencem ao schema da biblioteca/provider, mas a identidade pública autoritativa do jogo é `profile.commanders`.

Isso evita que campos adicionais de auth sejam automaticamente acoplados a sessão/client payload e reduz impacto de upgrades da biblioteca.

## 4. Identidade pública — `profile.commanders`

Tabela alvo:

```sql
CREATE TABLE profile.commanders (
  user_id UUID PRIMARY KEY REFERENCES auth."user"(id) ON DELETE CASCADE,
  handle VARCHAR(32),
  display_name VARCHAR(48),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Regras:

- `handle` MUST ser único sem diferença de caixa/espaços externos;
- handle e display name são dados públicos; email não pertence a esta tabela;
- perfil incompleto MAY possuir `handle = NULL` durante onboarding OAuth;
- acesso completo ao Comando exige identidade pública completa;
- título, retrato, frame e insígnia não são strings livres aqui; pertencem ao loadout cosmético.

Índice planejado:

```sql
CREATE UNIQUE INDEX commanders_handle_normalized_uq
  ON profile.commanders (lower(btrim(handle)))
  WHERE handle IS NOT NULL;
```

A busca pública SHOULD usar handle/display name, nunca email. Query MUST ser limitada e indexável; não carregar diretório global no browser.

Para busca prefixada, adicionar índice funcional compatível com `lower(...)`/`text_pattern_ops` após confirmar a query final. `pg_trgm` não entra por padrão; só depois de necessidade medida de busca fuzzy/contains.

## 5. Completeness/onboarding

Autenticação válida não implica perfil público completo.

O gate futuro da Home passa a distinguir:

```text
unauthenticated
      ↓
auth modal

       OU

authenticated
      ↓
profile.commanders completo?
  ├─ sim -> command-open
  └─ não -> profile-onboarding
```

MUST exigir antes de liberar o Comando:

- `handle` válido e único;
- `display_name` válido.

Para OAuth:

- `display_name` MAY iniciar com nome do provider;
- `auth.user.image` MAY servir como fallback de retrato;
- handle MUST ser escolhido/confirmado pelo usuário; não depender permanentemente de email ou provider username.

Para credentials, o modal MAY coletar handle/display name no cadastro ou concluir em onboarding imediato, mas o banco suporta ambos os fluxos.

## 6. Cosméticos, inventário e loadout

### 6.1 Catálogo

Usar o schema `catalog` já existente.

```sql
catalog.cosmetic_items
- id BIGSERIAL PK
- slug TEXT UNIQUE NOT NULL        # identificador público estável
- name TEXT NOT NULL
- category TEXT CHECK IN ('portrait','frame','title','insignia')
- artwork_path TEXT NULL
- artwork_alt TEXT NOT NULL
- is_active BOOLEAN NOT NULL
- created_at / updated_at

catalog.cosmetic_prices
- item_id FK cosmetic_items
- currency_id FK economy.currencies
- amount BIGINT >= 0
- PRIMARY KEY (item_id, currency_id)

catalog.profile_showcase
- item_id FK cosmetic_items
- display_order INTEGER
- is_active BOOLEAN
- PRIMARY KEY (item_id)
```

Nenhuma chave de pagamento/checkout pertence ao catálogo.

### 6.2 Itens possuídos

```sql
profile.user_cosmetics
- user_id UUID FK auth.user ON DELETE CASCADE
- item_id BIGINT FK catalog.cosmetic_items
- acquired_at TIMESTAMPTZ
- acquisition_source TEXT
- PRIMARY KEY (user_id, item_id)
```

### 6.3 Loadout

```sql
profile.commander_loadout
- user_id UUID PK FK auth.user ON DELETE CASCADE
- portrait_item_id BIGINT NULL
- frame_item_id BIGINT NULL
- title_item_id BIGINT NULL
- insignia_item_id BIGINT NULL
- updated_at TIMESTAMPTZ
```

A implementação SHOULD usar FKs compostas `(user_id, item_id)` para `profile.user_cosmetics` quando possível, impedindo equipar item não possuído no nível do banco. O service também MUST validar que a categoria corresponde ao slot.

Título cosmético MUST continuar semanticamente separado de rank/patente competitiva.

## 7. Economia / Tesouraria

### 7.1 Catálogo de moedas

```sql
economy.currencies
- id TEXT PK                   # campaign-credit / command-reserve
- kind TEXT CHECK IN ('common','premium')
- label TEXT
- short_label TEXT
- symbol TEXT
- is_active BOOLEAN
```

Seed inicial:

- `campaign-credit` — moeda comum;
- `command-reserve` — moeda premium/mais valiosa.

Labels e símbolos são dados de produto versionados/persistidos, não env vars.

### 7.2 Wallet

```sql
economy.wallets
- user_id UUID FK auth.user ON DELETE CASCADE
- currency_id TEXT FK economy.currencies
- balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0)
- updated_at TIMESTAMPTZ
- PRIMARY KEY (user_id, currency_id)
```

As duas linhas da wallet MUST ser provisionadas idempotentemente para uma conta completa. Assim `0` é valor real quando a fonte está disponível; falha de banco/provider continua sendo `unavailable`, nunca zero inventado.

MUST usar inteiro (`BIGINT`) e MUST NOT usar float para moeda virtual/preço.

### 7.3 Ledger

```sql
economy.wallet_ledger
- id UUID PK
- user_id UUID
- currency_id TEXT
- amount BIGINT NOT NULL CHECK (amount <> 0)
- reason TEXT NOT NULL
- reference_type TEXT NULL
- reference_id TEXT NULL
- idempotency_key TEXT UNIQUE NOT NULL
- created_at TIMESTAMPTZ NOT NULL
```

Regras de mutação:

1. iniciar transação;
2. bloquear wallet alvo (`SELECT ... FOR UPDATE`);
3. validar saldo resultante >= 0;
4. inserir ledger com idempotency key;
5. atualizar `wallets.balance`;
6. commit.

O ledger é trilha imutável de auditoria; `wallets.balance` é a projeção corrente usada para leitura rápida. Toda alteração de saldo MUST atualizar ambos atomicamente.

Não implementar compra/checkout nesta fase; o modelo apenas evita que a Intendência precise ser redesenhada depois.

## 8. Social / Rede de Comando

Usar uma relação canônica por par de usuários para impedir solicitações recíprocas duplicadas.

```sql
social.relationships
- user_a_id UUID
- user_b_id UUID
- status TEXT CHECK IN ('pending','accepted','blocked')
- requested_by_user_id UUID NULL
- blocked_by_user_id UUID NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
- responded_at TIMESTAMPTZ NULL
- PRIMARY KEY (user_a_id, user_b_id)
- CHECK (user_a_id < user_b_id)
```

A camada de serviço MUST canonicalizar o par `(menor UUID, maior UUID)` antes da mutação.

Semântica:

- `pending` + `requested_by_user_id` identifica direção da solicitação;
- `accepted` representa amizade;
- `blocked` + `blocked_by_user_id` representa bloqueio;
- remover amizade MAY remover a linha ou usar evento de auditoria futuro, conforme política de produto;
- uma única linha por par elimina corrida de duas solicitações opostas.

MUST NOT persistir:

- `mutualContacts`;
- `totalFriends`;
- `isFriend` em histórico;
- listas duplicadas de amigos por usuário.

Esses valores são derivados da relação canônica.

## 9. Presença

Presença é efêmera e não deve ser coluna permanente em `profile.commanders`.

Modelo inicial:

```sql
social.presence_leases
- lease_id UUID PK
- user_id UUID FK auth.user ON DELETE CASCADE
- state TEXT CHECK IN ('online','in-lobby','in-match')
- room_id BIGINT NULL FK game.rooms ON DELETE SET NULL
- last_heartbeat_at TIMESTAMPTZ NOT NULL
- expires_at TIMESTAMPTZ NOT NULL
```

Regras:

- cada conexão/tab/socket pode possuir uma lease;
- presença agregada usa a lease ativa de maior prioridade: `in-match > in-lobby > online`;
- `offline` é derivado da ausência de lease não expirada **somente quando o provider de presença está saudável**;
- nunca persistir token Better Auth ou `war_brasil_player` na tabela de presença;
- `room_id` é contexto interno e não precisa ser exposto ao perfil de terceiros;
- índice por `(user_id, expires_at DESC)` e por `expires_at` para cleanup.

O contrato PROFILE SHOULD evoluir para representar presença indisponível/unknown separadamente de `offline`, pois indisponibilidade de fonte não é ausência do jogador.

## 10. Conta ↔ assento de jogo

`game.players` recebe:

```sql
user_id UUID NULL REFERENCES auth."user"(id) ON DELETE SET NULL
```

Também SHOULD receber snapshots públicos para histórico estável:

```sql
display_name_snapshot VARCHAR(48) NULL
handle_snapshot VARCHAR(32) NULL
```

Regras:

- bot: `user_id = NULL`;
- humano autenticado novo: `user_id NOT NULL` na prática;
- salas legadas podem continuar com `NULL` durante rollout;
- exclusão de conta não apaga partidas; `ON DELETE SET NULL` preserva game history e snapshots;
- snapshots não são autorização e não substituem `user_id` durante conta ativa.

Unicidade:

```sql
CREATE UNIQUE INDEX players_room_user_uq
  ON game.players (room_id, user_id)
  WHERE user_id IS NOT NULL;
```

Isso impede a mesma conta de ocupar dois assentos na mesma sala sem impedir múltiplos bots/legado `NULL`.

Índice de histórico:

```sql
CREATE INDEX players_user_room_idx
  ON game.players (user_id, room_id)
  WHERE user_id IS NOT NULL;
```

## 11. Livro de Campanha / histórico

O histórico MUST reutilizar o estado factual da partida, não receber uma segunda tabela de `profile.match_history`.

`game.rooms` precisa garantir os campos que o contrato da PROFILE consome:

```sql
match_mode TEXT NOT NULL CHECK (match_mode IN ('classic','custom'))
finished_at TIMESTAMPTZ NULL
```

Campos já existentes reutilizados:

- `code` -> `operationCode`;
- `started_at`;
- `winner_player_id`;
- `status`;
- `id` como cursor interno, nunca exibido.

Derivações:

```text
playedAt        = finished_at
result          = winner_player_id == player.id ? victory : defeat
duration        = finished_at - started_at
participants    = game.players da sala
isFriend        = social.relationships no momento da leitura
```

MUST NOT persistir `durationMinutes`, `result`, `isFriend` ou uma cópia do histórico por usuário.

### 11.1 Legado/informação incompleta

Não inventar duração para partidas antigas sem timestamps completos.

O contrato `MatchSummary` SHOULD ser refinado antes da integração real para representar duração indisponível (`durationMinutes: number | null` ou value+availability). Nunca preencher com `0` ou estimativa silenciosa.

O provider inicial MAY listar apenas partidas finalizadas com dados suficientes até o contrato ser ajustado.

### 11.2 Paginação

Usar keyset/cursor, não histórico ilimitado e preferencialmente não `OFFSET` para páginas profundas.

Cursor SHOULD codificar internamente:

```text
finished_at + room_id
```

Query:

```text
WHERE player.user_id = currentUser
  AND room.status = 'finished'
  AND (finished_at, room.id) < (:cursorFinishedAt, :cursorRoomId)
ORDER BY finished_at DESC, room.id DESC
LIMIT :pageSize + 1
```

Índice recomendado:

```sql
CREATE INDEX rooms_finished_history_idx
  ON game.rooms (finished_at DESC, id DESC)
  WHERE status = 'finished';
```

O cursor retornado ao browser MUST ser opaco; IDs internos não são apresentados como dados de UI.

## 12. Contatos recentes

`RecentCommanderContact` deve ser derivado das partidas recentes:

1. buscar últimas partidas do usuário;
2. coletar outros `game.players.user_id`;
3. remover self, bots, contas bloqueadas e duplicatas;
4. ordenar pelo encontro mais recente;
5. compor `displayName`/`handle` com perfil atual e fallback de snapshot quando necessário;
6. `relation` é `opponent` até existir uma fonte de aliança/time real.

MUST NOT emitir `ally` apenas por heurística visual ou fixture depois da integração real.

Não criar `social.recent_contacts` inicialmente. Materializar/cachear só após evidência de custo real.

## 13. Intendência / storefront

A PROFILE continua sendo showcase; banco não muda a regra de produto.

Snapshot usa:

```text
catalog.profile_showcase
      ↓
catalog.cosmetic_items
      ↓
catalog.cosmetic_prices -> economy.currencies
```

A ação da PROFILE continua `Ver item` enquanto checkout não existir.

A presença de `profile.user_cosmetics` no schema não autoriza a UI atual a fingir compra, propriedade ou checkout. Novos campos `owned/purchased` só entram no contrato da PROFILE quando a funcionalidade real for implementada e avaliada.

## 14. Provisionamento de conta

Após criação de `auth.user`, um helper idempotente `ensureCommanderProvisioned(userId)` (nome indicativo) MUST garantir:

1. `profile.commanders`;
2. duas linhas em `economy.wallets` com saldo real `0`;
3. `profile.commander_loadout` vazio/opcional;
4. nenhuma amizade/inventário fictícios.

Better Auth database hooks MAY chamar o provisionamento após criação de usuário, mas o sistema MUST tolerar falha parcial e conseguir reparar idempotentemente em login/onboarding posterior.

MUST NOT criar/alterar schema durante esse provisionamento.

Provisionamento deve funcionar igualmente para credentials, Google e GitHub.

## 15. Deleção e retenção

Política estrutural inicial:

- `auth.user` -> `profile`, `social`, `economy` usam `ON DELETE CASCADE` onde o dado deixa de ter sentido;
- `game.players.user_id` usa `ON DELETE SET NULL` para preservar integridade histórica;
- snapshots públicos de partida permanecem como memória factual mínima;
- ledger financeiro não deve ser apagado silenciosamente sem política legal/econômica explícita; se exclusão de conta for implementada, anonimização/retenção deve ser tratada em SPEC próprio antes de produção com moeda de valor real.

## 16. Dados que deliberadamente NÃO entram agora

Não criar por antecipação:

- `rank`;
- patente competitiva;
- nível/XP;
- win rate persistida;
- contadores de vitórias/partidas duplicados;
- `mutualContacts` persistido;
- `totalFriends` persistido;
- `recentContacts` persistido;
- `isFriend` no histórico;
- tabela separada de histórico da PROFILE;
- checkout/payment transaction.

Quando estatísticas competitivas entrarem no produto, derivar inicialmente de `game` ou criar um read model/agregado explícito com source/versionamento próprio.

## 17. API/read model da PROFILE

`getCurrentProfileCommandSnapshot()` permanece a boundary única da página, mas deixa de ler fixture e passa a compor providers reais:

```text
IdentityProvider
  auth + profile + loadout + presence

WalletProvider
  economy.wallets + currencies

SocialProvider
  social.relationships + presence + game recent contacts

MatchHistoryProvider
  game.rooms + game.players + profile + social

StorefrontProvider
  catalog cosmetics + prices + showcase
```

Cada seção mantém `availability` e `source` do contrato atual. Uma falha de fonte não pode ser convertida em zero/vazio real.

O browser recebe somente DTO público. Email, `auth.user.id`, `game.players.id`, `room.id`, ledger IDs e relationship PKs não devem ser necessários para a UI normal.

## 18. Busca de comandantes

Endpoint `/api/profile/commanders/search` continua sob demanda.

MUST:

- exigir autenticação;
- mínimo 2 caracteres;
- limite máximo de entrada;
- LIMIT pequeno (contrato atual usa até 8);
- pesquisar apenas campos públicos (`handle`, `display_name`);
- excluir self e bloqueados;
- não aceitar email como chave pública de busca;
- não retornar IDs internos;
- retornar `mutualContacts` derivado;
- `Cache-Control: private, no-store`.

Quando ações sociais reais forem adicionadas, o DTO SHOULD incluir estado público de relacionamento (`none`, `pending-outgoing`, `pending-incoming`, `friend`, `blocked`) sem expor a PK interna.

## 19. Concorrência e consistência

### Wallet

Mutação usa row lock e idempotency key. Duas compras/créditos concorrentes não podem causar saldo negativo nem dupla aplicação.

### Social

Uma linha canônica por par impede duas amizades/request records contraditórios. Mutação MUST ocorrer em transação e revalidar status atual.

### Loadout

Equipar item MUST revalidar ownership dentro da mesma transação da atualização quando a operação puder concorrer com revoke/refund.

### Room seat

Constraint parcial `(room_id, user_id)` impede duas entradas simultâneas da mesma conta na mesma sala.

## 20. Migrações propostas

Não concentrar tudo em uma migration gigante. Sequência sugerida:

### AUTH-DB1 — auth core

- schema `auth`;
- tabelas Better Auth geradas/revisadas para versão fixada;
- IDs UUID;
- indexes/constraints core;
- sem runtime DDL.

### AUTH-DB2 — profile identity + game binding

- schema `profile`;
- `profile.commanders`;
- `game.players.user_id`;
- snapshots públicos do assento;
- unique/index parcial por room+user;
- `game.rooms.match_mode` e `finished_at`.

### AUTH-DB3 — economy

- schema `economy`;
- currencies seed;
- wallets;
- wallet ledger;
- transaction service/evals de concorrência.

### AUTH-DB4 — social

- schema `social`;
- canonical relationships;
- presence leases;
- indexes de busca/status/expiry.

### AUTH-DB5 — cosmetics/profile inventory

- `catalog.cosmetic_items`;
- prices/showcase;
- `profile.user_cosmetics`;
- `profile.commander_loadout`;
- ownership/category validation service.

Cada migration MUST passar:

- clean install;
- upgrade do baseline atual;
- repetição conforme política de idempotência do projeto;
- preservação de salas/partidas existentes;
- rollback/down quando exigido pelo padrão vigente.

## 21. Gaps do contrato PROFILE identificados antes da integração real

O backend real exige dois refinamentos no contrato atual para não transformar ausência em dado falso:

1. **presença desconhecida:** `PlayerPresence` hoje não representa provider indisponível. Adicionar `unknown` ou um wrapper `{ availability, state }` antes de ligar presença real;
2. **duração histórica desconhecida:** `durationMinutes` é obrigatório, mas partidas legadas podem não ter `finished_at`. Tornar duração nullable/availability-aware antes do provider real.

Também SHOULD ser adicionado estado de relacionamento ao resultado de busca quando mutações sociais forem habilitadas.

Esses ajustes são de integridade de dados; não são mudanças puramente visuais.

## 22. Critérios de qualidade do modelo

O modelo está pronto para implementação somente quando:

- cada campo visível da PROFILE tiver uma fonte real ou derivação definida;
- zero/vazio/offline não forem usados para representar indisponibilidade;
- auth, perfil público, social, economia e jogo continuarem separados;
- nenhum dado derivável relevante tiver uma segunda fonte de verdade sem necessidade medida;
- IDs/segredos internos não fizerem parte do DTO público;
- queries de busca/histórico tiverem LIMIT/cursor e índices planejados;
- mutações financeiras e sociais possuírem estratégia explícita de concorrência/idempotência;
- migration rollout preservar partidas existentes.

## 23. Referências técnicas

- Better Auth — Database/core schema e extensões: https://better-auth.com/docs/concepts/database
- Better Auth — PostgreSQL e schema não-default: https://better-auth.com/docs/adapters/postgresql
- PostgreSQL 18 — unique indexes: https://www.postgresql.org/docs/18/indexes-unique.html
- PostgreSQL 18 — expression/partial indexes: https://www.postgresql.org/docs/18/sql-createindex.html
- PostgreSQL 18 — row-level locking / `FOR UPDATE`: https://www.postgresql.org/docs/18/explicit-locking.html
