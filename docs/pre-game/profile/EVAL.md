# EVAL — PROFILE V3 / Quartel do Comandante

Avaliar conforme `../quality-standard.md`, `../traceability.md` e `SPEC.md`.

Aprovação exige **todos os BLOCKERs verdes** e score >= 85/100.

## Gates BLOCKER — legado visual e de integridade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO-01 | nenhum rank/stat/saldo social/comercial é apresentado como real sem fonte | data-source review |
| PRO-02 | loading, parcial, vazio social, vazio histórico e erro possuem estados explícitos | state coverage |
| PRO-03 | nenhum identificador sensível/interno é exibido | security review |
| PRO-04 | conteúdo principal é utilizável sem WebGL | fallback/manual |
| PRO-05 | mobile 390x844 não depende de hover/perspectiva | touch/manual |
| PRO-06 | reduced-motion preserva hierarquia | snapshot/manual |
| PRO-07 | cada seção possui `source`/availability ou equivalente auditável | contract review |
| PRO-08 | guest/auth preserva comportamento vigente | regression |
| PRO-09 | histórico é limitado e possui continuação explícita | contract/performance |
| PRO-10 | retrato/insígnia mantém leitura desktop/mobile/fallback | visual |
| PRO-11 | nome e título são semanticamente distintos | DOM/accessibility |
| PRO-12 | estados vazios continuam parte do Quartel | visual review |
| PRO-13 | duas moedas têm símbolo, label e tratamento distintos | visual/DOM |
| PRO-14 | saldo indisponível não vira zero | contract test |
| PRO-15 | Rede cobre amigos, busca, recentes e vazio | state/interaction |
| PRO-16 | busca social é sob demanda | architecture review |
| PRO-17 | presença possui equivalente textual | accessibility |
| PRO-18 | Intendência não simula compra inexistente | interaction review |
| PRO-19 | preço identifica moeda por contrato | data/DOM |
| PRO-20 | estação ativa controla Foundation somente via API pública | source inspection |
| PRO-21 | PROFILE não importa Three/R3F/Canvas/câmera | automated inspection |
| PRO-22 | uso principal desktop cabe em 1440x900 sem scroll global obrigatório | visual/manual |
| PRO-23 | mobile reorganiza para Terminal de Campo | 390x844 visual |
| PRO-24 | fallback mantém sistemas operáveis | fallback/manual |

## Gates BLOCKER — autenticação e autorização

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-AUTH-01 | `/profile` deriva o usuário autenticado de `session.user.id` | code/integration |
| PRO3-AUTH-02 | nenhuma mutação usa `userId` do browser como identidade do ator | security test |
| PRO3-AUTH-03 | Route Handlers protegidos validam sessão independentemente do Proxy | route test |
| PRO3-AUTH-04 | acesso não autenticado retorna redirect/401 coerente | E2E |
| PRO3-AUTH-05 | autorização segue deny-by-default em estados inesperados | negative tests |

## Gates BLOCKER — identidade e privacidade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-ID-01 | `profile.commanders` mantém vínculo 1:1 com `auth.user` | migration test |
| PRO3-ID-02 | handle é único case-insensitive | DB integration |
| PRO3-ID-03 | usuário não edita perfil alheio | negative API test |
| PRO3-ID-04 | título equipado precisa pertencer ao usuário | DB/service test |
| PRO3-PRIV-01 | presença/atividade/histórico respeitam política persistida | integration |
| PRO3-PRIV-02 | privacidade é aplicada antes do DTO chegar ao cliente | source/security review |
| PRO3-PRIV-03 | DTO público não contém email, user ID interno, sessão, provider IDs, IP ou player_session | snapshot/security |

## Gates BLOCKER — social

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-SOC-01 | usuário não pode solicitar amizade a si próprio | DB/API test |
| PRO3-SOC-02 | friendship não possui duplicata/inversão | constraint test |
| PRO3-SOC-03 | não existem requests pendentes simultâneos A→B e B→A | concurrency/constraint |
| PRO3-SOC-04 | aceitar request é transacional e idempotente | integration/concurrency |
| PRO3-SOC-05 | somente destinatário aceita request pendente | authorization test |
| PRO3-SOC-06 | block impede novo pedido entre o par | integration |
| PRO3-SOC-07 | block remove/cancela relação social pendente conforme contrato | transaction test |
| PRO3-SOC-08 | busca permanece sob demanda e limitada | architecture/API |
| PRO3-SOC-09 | busca não retorna dados privados | response snapshot |

## Gates BLOCKER — presença

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-PRES-01 | heartbeat exige sessão e atualiza apenas o próprio usuário | API test |
| PRO3-PRES-02 | heartbeat renova TTL de presença | Redis integration |
| PRO3-PRES-03 | ausência de heartbeat eventualmente resulta em offline | Redis integration |
| PRO3-PRES-04 | Redis indisponível resulta em `unavailable`, não `offline` | failure injection |
| PRO3-PRES-05 | PostgreSQL não recebe write em cada heartbeat | instrumentation/integration |
| PRO3-PRES-06 | leitura de roster evita N chamadas HTTP por amigo | architecture/performance |

## Gates BLOCKER — atividade e histórico

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-ACT-01 | browser não declara `in-match`/`in-lobby` como verdade | source inspection |
| PRO3-ACT-02 | atividade é derivada de `game.players.user_id` + `game.rooms` | integration |
| PRO3-ACT-03 | `waiting/order_roll -> lobby`, `playing -> match`, ausência -> idle | contract test |
| PRO3-HIST-01 | histórico usa `game.*` real | integration |
| PRO3-HIST-02 | resultado deriva de dados reais da partida | integration |
| PRO3-HIST-03 | histórico usa LIMIT + cursor/keyset | source/query test |
| PRO3-HIST-04 | histórico profundo não usa OFFSET | source inspection |
| PRO3-HIST-05 | snapshots históricos de nome/handle permanecem estáveis após edição de perfil | integration |

## Gates BLOCKER — retrato/upload

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-IMG-01 | banco armazena referência, não bytes/base64 | schema review |
| PRO3-IMG-02 | upload inválido por MIME/tamanho é rejeitado | API test |
| PRO3-IMG-03 | filename do usuário não define storage path | security test |
| PRO3-IMG-04 | SVG upload permanece bloqueado enquanto não houver sanitização específica | test/config |

## Gates BLOCKER — banco e migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-DB-01 | migration 034 aplica sobre estado atual e em banco limpo | integration |
| PRO3-DB-02 | migration 034 é idempotente no runner atual | integration |
| PRO3-DB-03 | migration 035 aplica sem perder dados existentes | integration |
| PRO3-DB-04 | constraints sociais impedem estados inválidos sob concorrência | DB test |
| PRO3-DB-05 | nenhum dado de auth é movido para social/profile sem necessidade | schema review |
| PRO3-DB-06 | novos índices possuem função observável/justificada | query review |

## Score / 100

- 20 — autenticação, autorização e privacidade;
- 15 — identidade persistente e DTOs;
- 20 — social e integridade transacional;
- 10 — presença e tolerância a falha;
- 10 — atividade/histórico;
- 10 — visual, mobile e Foundation;
- 5 — avatar/personalização;
- 10 — performance, migrations e testes.

## Cenários obrigatórios

### Identidade/auth

- `PRO3-S1`: visitante tenta `/profile`;
- `PRO3-S2`: login válido + profile existente;
- `PRO3-S3`: onboarding cria commander;
- `PRO3-S4`: editar próprio display name;
- `PRO3-S5`: tentar editar outro usuário;
- `PRO3-S6`: tentativa de forjar `userId` no payload.

### Social

- `PRO3-S7`: busca por handle;
- `PRO3-S8`: busca sem resultado;
- `PRO3-S9`: A envia request para B;
- `PRO3-S10`: B aceita A;
- `PRO3-S11`: A e B aparecem como amigos;
- `PRO3-S12`: requests simultâneos A→B / B→A;
- `PRO3-S13`: aceitar request duas vezes;
- `PRO3-S14`: remover amizade;
- `PRO3-S15`: bloquear usuário;
- `PRO3-S16`: bloqueado tenta solicitar amizade.

### Presence/activity

- `PRO3-S17`: usuário recebe presença online após heartbeat;
- `PRO3-S18`: heartbeat expira;
- `PRO3-S19`: Redis indisponível;
- `PRO3-S20`: usuário entra no lobby;
- `PRO3-S21`: usuário entra em partida;
- `PRO3-S22`: usuário fecha navegador durante partida;
- `PRO3-S23`: presence offline + activity match permanece representável.

### Histórico

- `PRO3-S24`: partida concluída aparece no histórico;
- `PRO3-S25`: vitória/derrota correta;
- `PRO3-S26`: paginação por cursor;
- `PRO3-S27`: edição posterior do nome não altera snapshot histórico.

### Privacidade/retrato

- `PRO3-S28`: `presence_visibility=private`;
- `PRO3-S29`: `history_visibility=friends` para não amigo;
- `PRO3-S30`: avatar válido;
- `PRO3-S31`: avatar MIME falso;
- `PRO3-S32`: avatar acima do limite;
- `PRO3-S33`: título possuído/equipado;
- `PRO3-S34`: tentativa de equipar título não possuído.

### Visual legado

Continuam obrigatórios:

- guest;
- loaded;
- partial-data;
- empty-history;
- empty-social;
- error;
- reduced-motion;
- scene fallback;
- 390x844;
- 1440x900.

## Testes de concorrência obrigatórios

Executar ao menos:

1. duas criações simultâneas do mesmo request;
2. A→B e B→A simultaneamente;
3. dois `accept` simultâneos para a mesma solicitação;
4. `accept` concorrente com `block`;
5. `remove friend` repetido.

O resultado final MUST ser determinístico e respeitar constraints.

## Auditoria de dados

Para cada campo visível identificar:

- fonte autoritativa;
- política de privacidade;
- disponibilidade;
- DTO de saída.

`offline`, lista vazia, zero e ausência de histórico são valores reais apenas quando a fonte consultada está disponível e retornou esse resultado.

## Performance

Validar:

- busca limitada;
- roster sem N+1 HTTP;
- presença em lote;
- histórico por keyset cursor;
- payload público mínimo;
- índices novos revisados por padrão de consulta.

Antes de adicionar índice de histórico por otimização, registrar `EXPLAIN (ANALYZE, BUFFERS)` ou justificativa equivalente com dataset representativo.

## Interaction regression

Além da V2, validar:

1. editar identidade sem perder estação ativa;
2. enviar/aceitar/remover amizade sem recarregar toda a página;
3. presença atualizar sem resetar UI local;
4. perfil de outro jogador respeitar relacionamento atual;
5. bloqueio remover ações incompatíveis imediatamente após confirmação do servidor;
6. paginação de histórico preservar registro selecionado quando aplicável.

## Referências técnicas

- Next.js Authentication: https://nextjs.org/docs/app/guides/authentication
- Better Auth Session Management: https://better-auth.com/docs/concepts/session-management
- PostgreSQL Partial Indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL Expression Indexes: https://www.postgresql.org/docs/current/indexes-expressional.html
- Redis EXPIRE/TTL: https://redis.io/docs/latest/commands/expire/ e https://redis.io/docs/latest/commands/ttl/
- OWASP Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP IDOR: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Gate de conclusão

A PROFILE V3 só pode ser considerada pronta quando:

- todos os blockers acima estiverem verdes;
- score >= 85;
- migrations passarem em banco limpo e upgrade do baseline suportado;
- testes auth existentes continuarem verdes;
- nenhum fluxo de jogo/realtime existente regredir;
- evidência visual V2 continuar aprovada.
