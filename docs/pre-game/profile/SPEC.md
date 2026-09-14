# SPEC — PROFILE V3 / Quartel do Comandante

**Rota própria:** `/profile`  
**Rota pública:** `/profile/[handle]`  
**Cena:** `profile`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

A integração de Tesouraria, Intendência, wallet, catálogo econômico, inventário e loadout jogável é regida por `../../economy/SPEC.md`. Este documento define apenas como essas capacidades se integram ao Quartel do Comandante; ele MUST NOT duplicar suas regras econômicas.

## Objetivo

A PROFILE é o **Quartel do Comandante**: identidade pública textual, rede social, presença, atividade de jogo, histórico e personalização não baseada em imagem de perfil, integrados ao fluxo real de autenticação do WAR Brasil.

A V3 preserva a composição visual da V2 e substitui progressivamente fixtures por fontes persistentes e auditáveis.

## Regra estrutural — nenhuma imagem de perfil

A PROFILE V3 MUST NOT possuir foto de perfil, avatar ou retrato de comandante.

A identidade visual do comandante MUST ser construída com:

- `displayName`;
- `handle`;
- bio opcional;
- título cosmético textual;
- presença;
- atividade;
- tipografia, monograma/iniciais e elementos gráficos derivados pela própria UI.

MUST NOT existir no domínio de Profile:

- upload de avatar;
- seleção de retrato;
- catálogo de retratos de usuário;
- fallback para imagem OAuth;
- URL de imagem de perfil em DTO público ou privado;
- referência persistente de imagem de perfil em `profile.*`;
- tratamento visual que simule uma fotografia genérica persistida.

Monogramas/iniciais MAY ser usados na interface, desde que sejam derivados de texto já autorizado e não sejam persistidos como imagem.

Assets decorativos do jogo, ícones, brasões de interface e arte de ambiente continuam permitidos quando não funcionarem como imagem identificadora do perfil do usuário.

O Better Auth/OAuth MAY manter internamente `auth."user".image` ou campo equivalente exigido pelo provider/biblioteca. War-Brasil MUST NOT:

- copiar esse valor para `profile.*`;
- projetá-lo em DTOs de Profile;
- renderizá-lo em `/profile`, `/profile/[handle]`, busca ou Rede de Comando;
- usar a existência ou ausência dessa imagem para alterar o contrato público do comandante.

## Estações preservadas do Quartel

A V3 MUST preservar a linguagem e as cinco estações funcionais da composição existente:

- **Dossiê do Comandante** — handle, nome público, bio, título, presença e atividade;
- **Tesouraria** — superfície de apresentação da carteira fornecida pelo domínio econômico;
- **Rede de Comando** — amizades, solicitações, busca, bloqueios e contatos recentes quando suportados;
- **Livro de Campanha** — histórico real e paginado derivado de `game.*`;
- **Intendência** — ponto de entrada e apresentação da loja/cosméticos fornecidos pelo domínio econômico.

A **Mesa de Comando** continua sendo o eixo visual e semântico entre as estações e a Foundation. A V3 altera fontes de dados e ações persistentes; não substitui a identidade visual já aprovada da V2.

## Fontes autoritativas

Cada dado MUST possuir uma única fonte de verdade:

- `auth.*` / Better Auth — login, email, providers, sessão e credenciais;
- `profile.*` — identidade pública textual, bio, título equipado, privacidade, `last_seen_at` e integração do loadout quando definida pelo domínio econômico;
- `social.*` — solicitações, amizades e bloqueios;
- Redis — presença efêmera online/offline;
- `game.*` — lobby, partida atual e histórico;
- `catalog.commander_titles` + `profile.commander_titles` — títulos cosméticos textuais do comandante;
- `economy.*`, `inventory.*` e catálogo de cosméticos jogáveis — conforme `../../economy/SPEC.md`.

MUST NOT duplicar estado autoritativo entre domínios. Em particular:

- MUST NOT persistir `is_online` como verdade em PostgreSQL;
- MUST NOT persistir `in_match` em `profile.commanders`;
- MUST NOT criar histórico paralelo quando os snapshots persistidos em `game.*` já atenderem o contrato;
- MUST NOT persistir avatar/retrato em `profile.*`;
- MUST NOT duplicar saldo, ownership ou regras de catálogo econômico dentro do domínio Profile.

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
- título cosmético equipado;
- presença;
- atividade;
- `lastSeenAt` quando permitido;
- timestamps de criação/atualização.

O perfil MUST NOT comportar imagem de perfil, avatar ou retrato.

`profile.commanders` MUST NOT manter colunas autoritativas equivalentes a `portrait_source`, `portrait_ref`, `avatar_url`, `profile_image` ou similar.

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

A representação textual/acessível MUST preservar as duas dimensões quando ambas forem relevantes, por exemplo `Offline · Em partida`.

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

## Títulos cosméticos

Título é cosmético e MUST permanecer semanticamente separado de rank, patente, nível ou habilidade competitiva.

O modelo MUST distinguir:

- catálogo de títulos;
- títulos desbloqueados pelo usuário;
- título atualmente equipado.

O banco SHOULD impedir equipar título não possuído por constraint/FK quando possível.

Títulos MAY ser personalizados visualmente por tipografia/cor/raridade, mas MUST NOT introduzir uma imagem de perfil substituta.

Títulos cosméticos textuais permanecem fora dos quatro slots jogáveis definidos por `../../economy/SPEC.md`.

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

Elementos da Rede MUST identificar comandantes por texto/monograma; MUST NOT depender de avatar ou imagem OAuth.

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
- imagem/avatar de provider;
- payloads internos de autorização.

O próprio perfil e o perfil público MUST usar o mesmo princípio de identidade sem imagem.

## Busca de comandantes

Busca MUST ser sob demanda, autenticada e limitada.

Baseline:

- mínimo de 2 caracteres;
- máximo de 64 caracteres;
- máximo de 8 resultados por chamada.

Resultado público SHOULD conter somente:

- handle;
- display name;
- título permitido;
- relação social necessária à UI;
- dados derivados não sensíveis necessários à apresentação, como contatos em comum.

Resultado MUST NOT conter avatar, retrato, URL de imagem OAuth ou campo de imagem de perfil equivalente.

## Histórico / Livro de Campanha

A fonte MUST ser o histórico real persistido em `game.*`, incluindo snapshots por partida quando necessários para preservar resultados após revanche/renomeação.

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

Snapshots históricos de nome/handle MUST ser preservados para que partidas antigas não mudem quando o usuário editar seu perfil.

Histórico MUST NOT passar a armazenar imagem de perfil como snapshot.

## DAL e DTO

A V3 MUST possuir boundary server-only entre UI/API e armazenamento.

Fluxo esperado:

`Page/Route Handler -> Service -> authorization/privacy -> Repository -> PostgreSQL/Redis -> DTO`.

React components MUST NOT consultar SQL diretamente.

Route Handlers MUST NOT retornar `SELECT *` de tabelas internas.

A página Server Component `/profile` SHOULD chamar o serviço diretamente; MUST NOT fazer fetch HTTP para a própria API apenas para montar o snapshot inicial.

DTOs de Profile MUST NOT conter propriedades equivalentes a `portrait`, `avatar`, `image`, `imageUrl` ou URL de imagem de usuário.

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

Fixtures de EVAL também MUST seguir o contrato sem imagem de perfil; não podem conservar propriedades de avatar apenas por conveniência visual.

## Boundary com Tesouraria e Intendência

Profile é responsável somente por:

- preservar Tesouraria e Intendência como estações do Quartel;
- apresentar os DTOs econômicos recebidos de forma acessível e coerente com a Foundation;
- fornecer navegação/entrada para a experiência de loja;
- manter a regra estrutural de não oferecer avatar, retrato ou imagem de perfil como identidade do comandante.

Profile MUST NOT redefinir:

- moedas ou saldo inicial;
- regras de ledger;
- catálogo de dados/efeitos territoriais;
- conjuntos;
- ownership;
- loadout jogável;
- status de disponibilidade comercial;
- preço;
- aquisição;
- compra;
- snapshot cosmético de partida.

Essas regras pertencem exclusivamente a `../../economy/SPEC.md` e são avaliadas por `../../economy/EVAL.md`.

A Intendência MUST NOT oferecer retratos, avatares ou qualquer cosmético cujo papel seja substituir imagem de perfil.

## Foundation / visual

Todos os requisitos visuais da PROFILE V2 permanecem, adaptados à identidade sem imagem:

- Quartel militar espacial e assimétrico;
- identidade do comandante legível sem retrato/avatar;
- monograma/iniciais MAY ocupar áreas antes destinadas a retrato, desde que derivados em runtime;
- desktop 1440x900 sem scroll global obrigatório para uso principal;
- mobile 390x844 como Terminal de Campo;
- reduced-motion;
- fallback WebGL;
- Foundation acessada somente pela API pública semântica;
- PROFILE MUST NOT importar Three/R3F/Canvas/câmera.

A remoção de avatar MUST resultar em recomposição visual intencional; MUST NOT deixar moldura vazia de fotografia ou espaço reservado para futura imagem.

## Performance

MUST evitar N+1 de presença/social.

Leitura de presença de roster SHOULD ser feita em lote.

Índices adicionais MUST ser justificados por padrões de consulta e, para histórico, preferencialmente por `EXPLAIN (ANALYZE, BUFFERS)` com dataset representativo.

A remoção de imagem de perfil SHOULD reduzir payloads e dependências de renderização; nenhuma nova chamada de imagem remota deve ser necessária para renderizar identidade de comandante.

Performance específica de storefront, previews, assets de dados, inventário e loadout é regida por `../../economy/SPEC.md`.

## Migrações

Migrations MUST ser forward-only, ordenadas e idempotentes segundo o runner atual.

Como `portrait_source` e `portrait_ref` já podem ter sido introduzidos por migration anterior, sua remoção MUST ocorrer por nova migration forward-only.

A migration de remoção MUST:

- remover colunas de retrato/avatar do domínio `profile.*`;
- preservar identidade textual, título, privacidade e `last_seen_at`;
- não alterar manualmente o schema core do Better Auth apenas para remover `auth."user".image`;
- ser coberta em banco limpo e upgrade do estado atual.

Runtime MAY utilizar conexão pooled do Neon.

Operações que dependam de estado de sessão PostgreSQL SHOULD preferir conexão direta; migrations MUST ser compatíveis com a estratégia adotada pelo runner.

Migrações econômicas, inventário e snapshot cosmético não pertencem ao Definition of Done de Profile; são regidas por `../../economy/SPEC.md`.

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

## Definition of Done

A PROFILE V3 está concluída quando:

1. autenticação real alimenta o perfil;
2. identidade pública textual está persistida em `profile.*`;
3. nenhum estado autoritativo de imagem de perfil existe em `profile.*`;
4. nenhum DTO/API/componente de Profile projeta ou renderiza avatar/retrato/imagem OAuth;
5. social real está persistido em `social.*`;
6. presença efêmera é derivada de Redis e possui fallback `unavailable`;
7. atividade e histórico vêm de `game.*`;
8. privacidade é aplicada no servidor;
9. perfil público utiliza DTO próprio sem imagem de perfil;
10. fixtures normais não aparecem em produção;
11. Tesouraria e Intendência respeitam a boundary de `../../economy/SPEC.md` sem duplicar sua autoridade;
12. todos os blockers do `EVAL.md` passam;
13. requisitos visuais e de acessibilidade da V2 continuam verdes após a recomposição sem avatar.
