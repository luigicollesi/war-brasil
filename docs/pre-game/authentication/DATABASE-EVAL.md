# EVAL — Authentication/Profile Database

Este EVAL complementa `EVAL.md` e valida especificamente o modelo descrito em `DATABASE-PLAN.md`.

Aprovação exige todos os BLOCKERs aplicáveis. Score visual não compensa inconsistência de dados, vazamento, ausência de constraint ou duplicação de source of truth.

## 1. Ownership e separação de domínio

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-01 | `auth`, `profile`, `social`, `economy`, `catalog`, `game` permanecem domínios separados | schema review |
| DB-02 | `auth.user` não recebe saldo, amizade, rank, inventário ou histórico | migration/source |
| DB-03 | identidade pública autoritativa vem de `profile.commanders` | integration |
| DB-04 | email não é persistido em `profile.commanders` | schema |
| DB-05 | DTO normal da PROFILE não depende de IDs internos do auth/game/social | contract test |

## 2. Identidade pública e onboarding

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-06 | `profile.commanders.user_id` referencia auth user e é PK | migration |
| DB-07 | handle possui unicidade case-insensitive/trim-aware no banco | constraint test |
| DB-08 | duas contas não conseguem reservar handles equivalentes por corrida concorrente | integration concurrency |
| DB-09 | perfil OAuth incompleto pode existir sem handle até onboarding | integration |
| DB-10 | `command-open` não é liberado para conta sem handle/display name completos | e2e |
| DB-11 | busca pública usa handle/display name e nunca email | source/e2e |
| DB-12 | busca é limitada e não exporta diretório completo | query/e2e |

## 3. Profile cosmetics/loadout

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-13 | catálogo contém categorias `portrait`, `frame`, `title`, `insignia` | migration/seed |
| DB-14 | slug cosmético é público/estável e único | constraint |
| DB-15 | ownership usa `(user_id,item_id)` único | constraint |
| DB-16 | loadout não permite equipar item não possuído | integration/constraint |
| DB-17 | service rejeita item de categoria incompatível com slot | integration |
| DB-18 | título cosmético permanece separado de rank/patente competitiva | schema/contract |
| DB-19 | OAuth image é fallback, não substitui ownership/loadout cosmético | source |

## 4. Tesouraria / economia

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-20 | moedas `campaign-credit` e `command-reserve` existem no catálogo | seed test |
| DB-21 | cada conta provisionada possui duas wallets reais | provisioning integration |
| DB-22 | wallet disponível com saldo zero retorna zero real | integration |
| DB-23 | erro/indisponibilidade não é convertido em zero | failure injection |
| DB-24 | saldo e preço usam inteiro, nunca float | schema/source |
| DB-25 | saldo não pode ficar negativo | check + concurrency test |
| DB-26 | toda mutação de saldo cria ledger na mesma transação | integration |
| DB-27 | ledger usa idempotency key única | constraint/integration |
| DB-28 | repetição da mesma operação não aplica saldo duas vezes | adversarial integration |
| DB-29 | duas mutações concorrentes são serializadas de forma segura | concurrency test |
| DB-30 | leitura PROFILE não precisa somar ledger inteiro para cada request | query/source |

## 5. Rede de Comando

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-31 | existe no máximo uma relação social canônica por par de usuários | PK/constraint |
| DB-32 | self relationship é impossível | check/integration |
| DB-33 | duas solicitações opostas concorrentes não criam dois registros | concurrency |
| DB-34 | direção de request é preservada | integration |
| DB-35 | bloqueio preserva identidade de quem bloqueou sem expor isso indevidamente ao outro usuário | integration/privacy |
| DB-36 | `totalFriends` é derivado, não coluna persistida | schema/source |
| DB-37 | `mutualContacts` é derivado, não coluna persistida | schema/source |
| DB-38 | `isFriend` não é copiado para histórico | schema/source |
| DB-39 | bloqueados são excluídos da busca/contatos conforme policy | integration |

## 6. Presença

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-40 | presença não é coluna permanente de `profile.commanders` | schema |
| DB-41 | leases possuem expiry e índices para lookup/cleanup | schema/query plan |
| DB-42 | ausência de lease saudável produz `offline` | integration temporal |
| DB-43 | provider indisponível não produz `offline` falso | failure injection |
| DB-44 | múltiplas leases agregam prioridade `in-match > in-lobby > online` | integration |
| DB-45 | token Better Auth/`war_brasil_player` não é gravado em presence | schema/source |
| DB-46 | `room_id` de presença não é exposto sem necessidade pública | DTO inspection |

## 7. Conta ↔ assento

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-47 | `game.players.user_id` referencia auth user e usa `ON DELETE SET NULL` | migration |
| DB-48 | bots permanecem `user_id=NULL` | integration |
| DB-49 | novos humanos autenticados recebem `user_id` | integration |
| DB-50 | unique partial `(room_id,user_id)` impede duas seats da mesma conta | constraint/concurrency |
| DB-51 | `player_session` continua separado de `user_id` | schema/source |
| DB-52 | account A + seat B é rejeitado | adversarial integration |
| DB-53 | snapshots públicos de participante não funcionam como autorização | adversarial integration |

## 8. Livro de Campanha

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-54 | PROFILE não possui tabela paralela de match history | schema review |
| DB-55 | `operationCode` vem de `game.rooms.code` | contract integration |
| DB-56 | `playedAt` vem de `finished_at` | integration |
| DB-57 | vitória/derrota é derivada de `winner_player_id` | integration |
| DB-58 | duração é derivada de timestamps e nunca estimada silenciosamente | integration legacy |
| DB-59 | `match_mode` distingue `classic`/`custom` | migration/integration |
| DB-60 | participantes usam `game.players` e snapshots públicos necessários | integration |
| DB-61 | `isFriend` reflete relação atual, não snapshot histórico | integration |
| DB-62 | histórico usa LIMIT + cursor/keyset | query/e2e |
| DB-63 | cursor não expõe IDs internos como informação de UI | contract inspection |
| DB-64 | índice suporta lookup por user e ordenação de partidas finalizadas | explain/query review |
| DB-65 | histórico legado sem duração suficiente retorna indisponível/null ou é omitido conforme contrato | legacy integration |

## 9. Contatos recentes

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-66 | contatos recentes são derivados de partidas, não tabela duplicada inicial | schema/source |
| DB-67 | self, bots, duplicatas e bloqueados são filtrados | integration |
| DB-68 | ordem usa encontro mais recente | integration |
| DB-69 | `ally` só é emitido quando existir fonte de time/aliança real | contract/source |

## 10. Intendência/storefront

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-70 | showcase é separado de item catalogado | schema |
| DB-71 | preço referencia currency id válido | FK/integration |
| DB-72 | UI não infere compra/ownership apenas porque inventory existe no banco | e2e/contract |
| DB-73 | item indisponível/inativo não aparece no showcase normal | integration |
| DB-74 | `owned/purchased` não entra no DTO atual sem mudança explícita de SPEC | contract test |

## 11. Provisionamento

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-75 | credentials provisiona commander + duas wallets | integration |
| DB-76 | Google provisiona mesmo modelo | integration/provider fixture |
| DB-77 | GitHub provisiona mesmo modelo | integration/provider fixture |
| DB-78 | provisionamento é idempotente | repeated integration |
| DB-79 | falha parcial pode ser reparada sem duplicar saldo/item/relação | failure-recovery test |
| DB-80 | provisionamento não executa DDL | source/static |

## 12. Deleção e retenção

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-81 | exclusão de auth user remove dados pessoais de profile/social conforme política | integration |
| DB-82 | exclusão da conta não apaga fatos da partida | integration |
| DB-83 | `game.players.user_id` vira NULL e snapshots mínimos preservam histórico | integration |
| DB-84 | ledger não é apagado silenciosamente sem policy explícita | source/policy review |

## 13. Não duplicação / dados deliberadamente ausentes

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-85 | não existe coluna/tabela prematura para rank/patente | schema |
| DB-86 | não existe win-rate persistida sem read model explícito | schema |
| DB-87 | não existe contador duplicado de partidas/vitórias apenas para PROFILE | schema |
| DB-88 | não existe checkout/payment model fingindo funcionalidade não implementada | schema/product review |
| DB-89 | cada dado numérico visível possui source real ou availability explícita | contract/e2e |

## 14. Migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-90 | `auth` core usa migration gerenciada e compatível com versão Better Auth fixada | migration/CI |
| DB-91 | `profile/social/economy` são criados em migrations próprias | migration review |
| DB-92 | upgrade do baseline atual preserva game rooms/players | database integration |
| DB-93 | clean install cria todos os schemas/constraints/seed necessários | `npm run test:db` |
| DB-94 | migrations respeitam política de idempotência do projeto | repeated migration test |
| DB-95 | nenhuma migration depende de dado local/fixture de PROFILE | migration inspection |

## 15. Performance/query gates

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DB-96 | busca de comandante utiliza índice compatível com a query real | `EXPLAIN`/integration |
| DB-97 | histórico não degrada para scan ilimitado por usuário | `EXPLAIN`/integration |
| DB-98 | lista de amigos/request usa índices por user/status | schema/query |
| DB-99 | cleanup de presence usa índice por expiry | schema/query |
| DB-100 | PROFILE principal não carrega diretório social, ledger inteiro ou histórico ilimitado | request/query instrumentation |

## 16. Cenários adversariais obrigatórios

### DB-A1 — Handle race

Duas transações tentam registrar `GeneralSul` e ` generalsul ` simultaneamente.

Esperado: somente uma vence; outra recebe conflito tratável.

### DB-A2 — Double spend

Wallet possui 100 créditos. Duas operações concorrentes tentam debitar 80.

Esperado: uma confirma, outra falha; saldo final nunca é -60 e ledger contém somente transações válidas.

### DB-A3 — Duplicate social request

A solicita B enquanto B solicita A simultaneamente.

Esperado: uma única relação canônica, nenhum par contraditório.

### DB-A4 — Double room seat

Duas requests da mesma conta tentam entrar na mesma sala em paralelo.

Esperado: uma única seat humana para `(room_id,user_id)`.

### DB-A5 — Deleted account history

Conta com partidas antigas é removida.

Esperado: profile/social são removidos conforme policy; game history permanece íntegro com `user_id=NULL` e snapshot público mínimo.

### DB-A6 — Presence provider failure

Forçar falha no provider/consulta de presença.

Esperado: PROFILE entra em `partial-data`/presence unavailable; não converte todos em `offline`.

### DB-A7 — Legacy match without `finished_at`

Carregar partida legada sem timestamp suficiente.

Esperado: duração não é fabricada como `0`; contrato retorna unavailable/null ou omite a entrada conforme decisão final.

## 17. Definition of Done do modelo de dados

A camada de dados está pronta quando:

1. todos os gates aplicáveis deste arquivo passam;
2. `EVAL.md` de autenticação continua verde;
3. `profile/EVAL.md` consegue trocar fixtures pelos providers reais sem alterar sua hierarquia visual;
4. cada campo do `ProfileCommandSnapshot` possui fonte/derivação documentada;
5. nenhuma nova variável pública ou segredo é necessária para consultar dados de PROFILE;
6. migrations passam clean install + upgrade + concorrência crítica;
7. ausência/erro continuam semanticamente distintos de zero/vazio/offline.
