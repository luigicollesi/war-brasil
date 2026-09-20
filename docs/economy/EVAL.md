# EVAL — Economia V2, Loja e Cosméticos

Status: **contrato pai reconciliado com Storefront V2**

Avaliar este documento em conjunto com:

- `docs/economy/store/EVAL.md` para catálogo, produtos, ofertas, bundles, coleções, campanhas, pricing progressivo, disponibilidade temporal, merchandising e storage da storefront;
- `docs/economy/territory-skins/EVAL.md` para renderização/legibilidade de territory skins.

Aprovação exige todos os BLOCKERs aplicáveis verdes. Compra com `campaign-credit` é funcional. Compra de créditos com BRL permanece deliberadamente inativa.

## 1. Wallet e moeda

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-WAL-01 | `campaign-credit` é a moeda ativa desta entrega | schema/contract |
| ECO-WAL-02 | novo comandante inicia com saldo persistente `0` | integration |
| ECO-WAL-03 | upgrade preserva saldo válido existente | migration integration |
| ECO-WAL-04 | DB impede saldo negativo | DB negative test |
| ECO-WAL-05 | valores econômicos autoritativos são inteiros | schema/type review |
| ECO-WAL-06 | gameplay/login/cadastro/eventos não concedem créditos nesta entrega | source/integration |
| ECO-WAL-07 | saldo exibido vem da wallet persistente | DB→DTO→UI |
| ECO-WAL-08 | não existe endpoint público arbitrário de grant/reward/transfer | route/security review |
| ECO-WAL-09 | browser não informa saldo final/delta autoritativo | negative API/source |

## 2. Representação da moeda

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-COIN-01 | `public/coin.svg` existe e é servido como `/coin.svg` | asset/source test |
| ECO-COIN-02 | `/coin.svg` é identidade visual canônica de `campaign-credit` nas superfícies atuais | DOM/source |
| ECO-COIN-03 | wallet/preço/credit pack possuem valor textual acessível além do ícone | accessibility/DOM |
| ECO-COIN-04 | BRL permanece formatado separadamente de Créditos de Campanha | DOM/source |
| ECO-COIN-05 | moeda visual local não depende de R2 ou inventário | source/network negative |

## 3. Ledger e histórico

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-LED-01 | compra paga cria exatamente um débito | integration |
| ECO-LED-02 | `delta = -price_paid` | DB integration |
| ECO-LED-03 | rollback não deixa débito órfão | fault/integration |
| ECO-LED-04 | replay idempotente não cria novo débito | integration |
| ECO-HIST-01 | recibo preserva oferta/produto e total histórico | DB integration |
| ECO-HIST-02 | compra preserva subtotal/desconto comercial aplicável | DB integration |
| ECO-HIST-03 | itens concedidos preservam preço unitário histórico | DB integration |
| ECO-HIST-04 | alteração posterior do catálogo não reinterpreta recibo antigo | integration |

## 4. Ownership e loadout

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-INV-01 | ownership é por cosmetic item, não por bundle/product/collection/campaign | schema/integration |
| ECO-INV-02 | DB impede ownership duplicado `(user, cosmetic)` | constraint/concurrency |
| ECO-INV-03 | defaults válidos mantêm loadout inicial completo | migration/integration |
| ECO-INV-04 | slots canônicos são `dice_attack`, `dice_defense`, `dice_neutral`, `territory_skin` | schema/contract |
| ECO-INV-05 | `territory_effect` não aparece como slot novo de runtime | source negative |
| ECO-LOAD-01 | só cosmético possuído pode ser equipado | API/DB negative |
| ECO-LOAD-02 | slot incompatível é rejeitado | API/DB negative |
| ECO-LOAD-03 | loadout persiste e é recuperável | integration |
| ECO-LOAD-04 | territory skin é independente dos três slots de dado | integration |

## 5. Compra com campaign-credit

Os detalhes de produto/pricing ficam em `docs/economy/store/EVAL.md`; estes gates verificam os invariantes econômicos compartilhados.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-BUY-01 | compra é autenticada e server-authoritative | route/service review |
| ECO-BUY-02 | request usa `offerId`, idempotency key e `expectedPrice`; não envia grant/saldo final | contract/negative API |
| ECO-BUY-03 | preço final é recalculado dentro da transação | integration/source |
| ECO-BUY-04 | mismatch de `expectedPrice` não debita nem concede item | integration |
| ECO-BUY-05 | saldo insuficiente não debita nem concede item | integration |
| ECO-BUY-06 | wallet, ledger, grants, counters e histórico são atômicos | fault/integration |
| ECO-BUY-07 | replay idempotente retorna compra persistida sem nova mutação | integration |
| ECO-BUY-08 | mesma chave para operação incompatível gera conflito | integration |
| ECO-BUY-09 | itens já possuídos são excluídos de completion pricing/grant | store EVAL + integration |
| ECO-BUY-10 | bundle pode ser parcial; preço não permanece artificialmente integral | store EVAL |
| ECO-BUY-11 | compra individual de attack/defense/neutral é válida | store EVAL |
| ECO-BUY-12 | territory skin pode ser comprada pelo mesmo pipeline quando houver oferta ativa | integration |

Regras antigas que proibiam dados individuais ou obrigavam preço integral com ownership parcial estão revogadas.

## 6. Pricing, tiers e disponibilidade

Delegação principal: `docs/economy/store/EVAL.md`.

O pai exige no mínimo:

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-PRICE-01 | dinheiro/desconto usam aritmética inteira determinística | unit/integration |
| ECO-PRICE-02 | pricing fixo continua suportado | migration/unit |
| ECO-PRICE-03 | pricing progressivo usa tiers explícitos e não sobrepostos | DB/unit |
| ECO-PRICE-04 | counters avançam somente para grants efetivos | integration |
| ECO-PRICE-05 | concorrência em boundary de tier não aceita silenciosamente preço obsoleto | concurrent DB integration |
| ECO-OFFER-01 | `starts_at`, `ends_at` e `active` são validados no servidor | integration |
| ECO-OFFER-02 | expiração exata impede compra | integration |
| ECO-OFFER-03 | oferta expirada no detalhe causa refresh/reconfirmação, não compra obsoleta | UI/source + API integration |
| ECO-OFFER-04 | uma nova offer pode recolocar o mesmo product em rotação sem recriar ownership | integration/model review |

Pricing dinâmico por tiers é permitido. A antiga proibição genérica de pricing dinâmico não se aplica à Storefront V2.

## 7. Coleções, produtos, ofertas e campanhas

Delegação principal: `docs/economy/store/EVAL.md`.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CAT-01 | product e cosmetic são entidades distintas | schema/test |
| ECO-CAT-02 | single e bundle compartilham cosmetic items sem duplicar ownership | integration |
| ECO-CAT-03 | coleção pode ser dice-only, territory-only ou mista | integration |
| ECO-CAT-04 | Football é fixture dice-only de 3 dados | migration/integration |
| ECO-CAT-05 | coleção V1 usa exatamente `banner/background/logo` ativos | constraint/integration |
| ECO-CAT-06 | campanha é temporal/editorial e independente da coleção | integration |
| ECO-CAT-07 | expirar campanha não remove coleção/cosméticos/products | integration |

## 8. Territory skins

Além dos gates econômicos abaixo, todo blocker de `docs/economy/territory-skins/EVAL.md` permanece obrigatório.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-TS-01 | slot canônico é `territory_skin` | contract/schema |
| ECO-TS-02 | skins não default podem possuir product/offer e pricing no catálogo | migration/integration |
| ECO-TS-03 | compra concede ownership individual e registra histórico/ledger | integration |
| ECO-TS-04 | equipagem de skin não altera slots de dado | integration |
| ECO-TS-05 | skin ausente/quebrada não corrompe estado econômico | fallback/source |

## 9. Pacotes de créditos em BRL

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-BRL-01 | `credit_packs` podem ser exibidos como catálogo demonstrativo | DB→UI |
| ECO-BRL-02 | checkout/CTA real permanece desabilitado | DOM/source |
| ECO-BRL-03 | não há webhook/payment order/grant de créditos por dinheiro real | route/source negative |
| ECO-BRL-04 | usuário não consegue transformar `credit_packs` em saldo pela API | negative API |

Qualquer implementação de checkout real nesta entrega é BLOCKER.

## 10. Object storage e segurança de assets

A storefront especializada adiciona gates específicos em `docs/economy/store/EVAL.md`.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-ASSET-01 | DB persiste object keys, não URLs específicas de ambiente | DB/source |
| ECO-ASSET-02 | runtime resolve objeto por chave exata, sem `ListObjects` para construir catálogo | source/network |
| ECO-ASSET-03 | credenciais R2 são server-only | env/build/source audit |
| ECO-ASSET-04 | bucket é configurável por ambiente e dev/prod não compartilham namespace mutável | env/deploy evidence |
| ECO-ASSET-05 | endpoint HTTPS moderno usa `ASSET_STORAGE_BUCKET` explícito | config test |
| ECO-ASSET-06 | objeto ausente degrada com fallback/log seguro | unit/integration |
| ECO-ASSET-07 | secret/access key não aparecem em DTO, browser bundle ou erro | build/source negative |
| ECO-ASSET-08 | validação de catálogo usa `HEAD`/exact key e não exige list permission | validator test/source |

Não existe mais requisito pai de hardcode de `war-brasil-assets-prod` para todos os ambientes.

## 11. Auth e boundary

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-AUTH-01 | endpoints econômicos privados exigem sessão autenticada | route test |
| ECO-AUTH-02 | mutações rejeitam origem não confiável conforme auth atual | route/security test |
| ECO-AUTH-03 | usuário A não compra/equipa para usuário B via payload | negative API |
| ECO-AUTH-04 | user id é derivado da sessão, não aceito como autoridade no body | source/negative API |
| ECO-AUTH-05 | erros não expõem DB/R2/auth secrets | security review |

## 12. Migração e regressão

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-MIG-01 | migration nova usa número posterior ao maior existente | repository audit |
| ECO-MIG-02 | upgrade preserva ownership/defaults/loadout válidos | migration integration |
| ECO-MIG-03 | rerun/prepare segue convenção idempotente do projeto | migration integration |
| ECO-MIG-04 | constraints novas não invalidam dados válidos existentes | migration integration |
| ECO-MIG-05 | migrations históricas não são reescritas para esconder evolução | git/repository review |
| ECO-REG-01 | testes de economy anteriores continuam verdes ou são reconciliados somente quando o contrato foi deliberadamente substituído | test suite |
| ECO-REG-02 | gameplay continua consumindo loadout cosmético sem dar autoridade econômica ao cliente | regression |

## 13. Matriz obrigatória delegada

A conclusão deve também executar as matrizes descritas no store EVAL, incluindo:

- bundle 0/3, 1/3, 2/3, 3/3;
- coleção dice-only e coleção mista;
- ownership parcial misto;
- tier boundary concorrente;
- stale `expectedPrice`;
- oferta scheduled/active/expired/disabled/retornada;
- territory skin sob seis player colors e estados de gameplay;
- viewports desktop/mobile da storefront.

## 14. Definition of Done

Economy V2 está pronta para merge somente quando:

1. estes blockers estiverem verdes;
2. `docs/economy/store/EVAL.md` estiver verde para o escopo Storefront V2;
3. `docs/economy/territory-skins/EVAL.md` permanecer verde;
4. migrations estiverem verificadas contra a cadeia atual;
5. `npm test`/testes DB/build/lint aplicáveis tiverem evidência fresca;
6. verificação R2 dev exigida pelo store EVAL tiver sido executada em ambiente autorizado;
7. revisão visual dos viewports requeridos estiver registrada;
8. nenhum segredo tiver sido exposto.
