# SPEC — PROFILE V3 / Quartel do Comandante

**Rota própria:** `/profile`  
**Rota pública:** `/profile/[handle]`  
**Cena:** `profile`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Objetivo

A PROFILE é o **Quartel do Comandante**: identidade pública, rede social, presença, atividade de jogo, histórico e personalização, integrados ao fluxo real de autenticação do WAR Brasil.

A V3 preserva a composição visual da V2 e substitui progressivamente fixtures por fontes persistentes e auditáveis.

## Estações preservadas do Quartel

A V3 MUST preservar a linguagem e as cinco estações funcionais da composição existente:

- **Dossiê do Comandante** — identidade, retrato, handle, nome público, bio, título, presença e atividade;
- **Tesouraria** — economia do comandante, permanecendo `unavailable` enquanto não houver fonte real;
- **Rede de Comando** — amizades, solicitações, busca, bloqueios e contatos recentes quando suportados;
- **Livro de Campanha** — histórico real e paginado derivado de `game.*`;
- **Intendência** — personalização/cosméticos, sem simular compra enquanto wallet/store não existirem.

A **Mesa de Comando** continua sendo o eixo visual e semântico entre as estações e a Foundation. A V3 altera fontes de dados e ações persistentes; não substitui a identidade visual já aprovada da V2.

## Fontes autoritativas

Cada dado MUST possuir uma única fonte de verdade:

- `auth.*` / Better Auth — login, email, providers, sessão e credenciais;
- `profile.*` — identidade pública, retrato selecionado, bio, título equipado, privacidade e `last_seen_at`;
- `social.*` — solicitações, amizades e bloqueios;
- Redis — presença efêmera online/offline;
- `game.*` — lobby, partida atual e histórico;
- `catalog.*` — títulos e demais cosméticos disponíveis.

MUST NOT duplicar estado autoritativo entre domínios. Em particular:

- MUST NOT persistir `is_online` como verdade em PostgreSQL;
- MUST NOT persistir `in_match` em `profile.commanders`;
- MUST NOT criar histórico paralelo enquanto `game.rooms` + `game.players` forem suficientes.

## Autenticação e autorização

A identidade autenticada MUST ser derivada exclusivamente de `session.user.id`.

Mutações do próprio usuário MUST NOT aceitar `userId` fornecido pelo browser como identidade do ator.

O `Proxy` MAY realizar proteção otimista de navegação, mas MUST NOT ser a única barreira. Route Handlers, serviços e DAL MUST repetir autenticação/autorização server-side.

Autorização segue `deny by default`: ausência de regra explícita MUST resultar em negação.

## Identidade do Comandante

`profile.commanders` continua vinculado 1:1 a `auth."user"(id)`.

O perfil MUST comportar:

- `handle` público único e case-insensitive;
- `displayName`;
- bio curta opcional;
- retrato/avatar;
- título cosmético equipado;
- presença;
- atividade;
- `lastSeenAt` quando permitido;
- timestamps de criação/atualização.

`auth.user.name` MAY ser usado apenas como sugestão inicial de nome público. Depois do onboarding, `profile.commanders.display_name` é a fonte pública.

Nesta versão, o handle SHOULD permanecer imutável depois do onboarding. Mudança futura de handle exige regra própria de aliases/cooldown.

## Presença e atividade são conceitos separados

A V3 MUST modelar presença e atividade separadamente.

Presença:

- `online`;
- `offline`;
- `unavailable`.

Atividade:

- `idle`;
- `lobby`;
- `match`;
- `unavailable`.

A aplicação MUST poder representar combinações como `online + match` e `offline + match`.

Redis indisponível MUST resultar em `presence=unavailable`, nunca em falso `offline`.

## Presença

A presença atual MUST ser efêmera e baseada em TTL.

O heartbeat MUST:

- exigir sessão autenticada;
- usar `session.user.id` como chave lógica;
- renovar TTL por intervalo limitado;
- não aceitar outro usuário como alvo;
- não realizar escrita PostgreSQL a cada heartbeat.

`profile.commanders.last_seen_at` MAY ser atualizado de forma throttled para persistir a última presença conhecida.

## Atividade de jogo

A atividade MUST ser derivada do estado real do jogo:

- nenhuma sala ativa → `idle`;
- sala `waiting`/`order_roll` → `lobby`;
- sala `playing` → `match`.

A fonte MUST ser `game.players.user_id` + `game.rooms`.

O cliente MUST NOT declarar ou persistir `in-match`/`in-lobby` como verdade.

## Retrato/avatar

A identidade MUST suportar:

- imagem herdada inicialmente de autenticação/OAuth;
- upload futuro do usuário;
- retratos de catálogo.

PostgreSQL MUST armazenar somente referência/metadados, não bytes/base64 da imagem.

Upload MUST validar tamanho, tipo real e formato permitido. Filename do cliente MUST NOT definir o caminho final no storage. SVG upload SHOULD permanecer desabilitado na primeira versão.

## Títulos cosméticos

Título é cosmético e MUST permanecer semanticamente separado de rank, patente, nível ou habilidade competitiva.

O modelo MUST distinguir:

- catálogo de títulos;
- títulos desbloqueados pelo usuário;
- título atualmente equipado.

O banco SHOULD impedir equipar título não possuído por constraint/FK quando possível.

## Privacidade

A V3 MUST possuir política persistente para:

- presença;
- atividade;
- histórico;
- recebimento de solicitações de amizade.

A projeção de privacidade MUST ocorrer server-side antes de formar DTOs.

A UI MUST NOT receber dados privados para apenas escondê-los visualmente.

## Rede de Comando

MUST suportar:

- amigos persistentes;
- solicitações recebidas;
- solicitações enviadas;
- busca sob demanda;
- contatos recentes derivados de partidas quando suportados;
- remover amizade;
- bloquear/desbloquear;
- estados vazio, indisponível e erro.

Busca MUST NOT carregar o diretório completo no browser.

Amizade é simétrica. Solicitação é direcional.

O banco MUST impedir:

- amizade consigo mesmo;
- amizade duplicada/invertida;
- mais de uma solicitação pendente para o mesmo par de usuários, independentemente da direção.

Aceitar amizade MUST ser transacional e idempotente.

Bloquear MUST impedir novos pedidos entre o par e SHOULD remover amizade/pedidos pendentes na mesma transação.

## Perfil próprio x perfil público

`/profile` representa o próprio comandante autenticado e MAY expor controles de edição e informações privadas do proprietário.

`/profile/[handle]` representa projeção pública de outro comandante e MUST utilizar DTO próprio.

MUST NOT reutilizar DTO privado e apenas esconder campos no cliente.

Perfil público MUST NOT expor:

- email;
- `auth.user.id`;
- session token;
- provider/account IDs;
- IP/user-agent;
- player_session;
- payloads internos de autorização.

## Busca de comandantes

Busca MUST ser sob demanda, autenticada e limitada.

Baseline:

- mínimo de 2 caracteres;
- máximo de 64 caracteres;
- máximo de 8 resultados por chamada.

Resultado público SHOULD conter somente:

- handle;
- display name;
- retrato permitido;
- título permitido;
- relação social necessária à UI.

## Histórico / Livro de Campanha

A fonte inicial MUST ser `game.rooms` + `game.players`.

A listagem MUST:

- ser limitada;
- usar cursor/keyset pagination;
- possuir `hasMore` e `nextCursor`;
- evitar histórico ilimitado e OFFSET profundo.

Cada resumo MAY conter:

- código/nome da operação;
- data;
- resultado;
- modo;
- duração;
- participantes resumidos;
- relação social com participantes.

Snapshots históricos de nome/handle em `game.players` MUST ser preservados para que partidas antigas não mudem quando o usuário editar seu perfil.

## DAL e DTO

A V3 MUST possuir boundary server-only entre UI/API e armazenamento.

Fluxo esperado:

`Page/Route Handler -> Service -> authorization/privacy -> Repository -> PostgreSQL/Redis -> DTO`.

React components MUST NOT consultar SQL diretamente.

Route Handlers MUST NOT retornar `SELECT *` de tabelas internas.

A página Server Component `/profile` SHOULD chamar o serviço diretamente; MUST NOT fazer fetch HTTP para a própria API apenas para montar o snapshot inicial.

## ProfileCommandSnapshot

A UI continuará consumindo o contrato V2/V3, não payloads de provider.

Cada seção MUST manter `availability` e `source` auditáveis.

Ausência de fonte MUST ser `unavailable`, nunca convertida para:

- `offline`;
- `0`;
- lista vazia;
- nenhum histórico;
- nenhum amigo.

Fixtures normais MUST desaparecer do fluxo real. `evaluation-fixture` permanece permitido apenas em EVAL.

## Tesouraria e Intendência

A integração real de wallet/store continua independente desta entrega.

Enquanto não houver fonte real:

- seção MUST usar `unavailable` ou fixture de EVAL;
- zero MUST NOT representar ausência de backend;
- compra MUST NOT ser simulada como persistida.

## Foundation / visual

Todos os requisitos visuais da PROFILE V2 permanecem:

- Quartel militar espacial e assimétrico;
- desktop 1440x900 sem scroll global obrigatório para uso principal;
- mobile 390x844 como Terminal de Campo;
- reduced-motion;
- fallback WebGL;
- Foundation acessada somente pela API pública semântica;
- PROFILE MUST NOT importar Three/R3F/Canvas/câmera.

## Performance

MUST evitar N+1 de presença/social.

Leitura de presença de roster SHOULD ser feita em lote.

Índices adicionais MUST ser justificados por padrões de consulta e, para histórico, preferencialmente por `EXPLAIN (ANALYZE, BUFFERS)` com dataset representativo.

## Migrações

Migrations MUST ser forward-only, ordenadas e idempotentes segundo o runner atual.

Runtime MAY utilizar conexão pooled do Neon.

Operações que dependam de estado de sessão PostgreSQL SHOULD preferir conexão direta; migrations MUST ser compatíveis com a estratégia adotada pelo runner.

## Referências técnicas

- Next.js Authentication: https://nextjs.org/docs/app/guides/authentication
- Better Auth Database: https://better-auth.com/docs/concepts/database
- Better Auth Session Management: https://better-auth.com/docs/concepts/session-management
- PostgreSQL Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL Expression Indexes: https://www.postgresql.org/docs/current/indexes-expressional.html
- PostgreSQL Partial Indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- Redis EXPIRE: https://redis.io/docs/latest/commands/expire/
- OWASP Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP IDOR: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Definition of Done

A PROFILE V3 está concluída quando:

1. autenticação real alimenta o perfil;
2. identidade pública está persistida em `profile.*`;
3. social real está persistido em `social.*`;
4. presença efêmera é derivada de Redis e possui fallback `unavailable`;
5. atividade e histórico vêm de `game.*`;
6. privacidade é aplicada no servidor;
7. perfil público utiliza DTO próprio;
8. fixtures normais não aparecem em produção;
9. todos os blockers do `EVAL.md` passam;
10. requisitos visuais e de acessibilidade da V2 continuam verdes.
