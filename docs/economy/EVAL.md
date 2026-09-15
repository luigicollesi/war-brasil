# EVAL — Economia V2, Loja e Cosméticos

Avaliar conforme `SPEC.md` e os padrões de qualidade vigentes do projeto.

Aprovação exige **todos os BLOCKERs verdes**. Compra com `campaign-credit` é parte funcional desta entrega. Compra de créditos com BRL permanece deliberadamente inativa e qualquer fluxo que conceda créditos após pagamento real é BLOCKER.

## Gates BLOCKER — moeda e wallet

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-WAL-01 | existe somente `campaign-credit` como moeda ativa de gameplay/comércio desta entrega | schema/contract |
| ECO-WAL-02 | todo novo comandante inicia com saldo persistente exatamente `0` | onboarding integration |
| ECO-WAL-03 | usuários existentes preservam saldo válido durante upgrade | upgrade integration |
| ECO-WAL-04 | saldo não pode ficar negativo por constraint | DB negative test |
| ECO-WAL-05 | saldo e valores econômicos são inteiros | schema/type review |
| ECO-WAL-06 | vitória, derrota, login, cadastro, tempo de jogo, evento e navegação não concedem créditos | integration/source review |
| ECO-WAL-07 | saldo exibido vem da wallet persistente, não de fallback sintético | DB→DTO→DOM |
| ECO-WAL-08 | não existe endpoint público de grant/reward/transferência ou ajuste arbitrário de saldo | route/security review |
| ECO-WAL-09 | browser não consegue enviar saldo final ou delta autoritativo | negative API test |

## Gates BLOCKER — representação visual da moeda

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-COIN-01 | `public/coin.svg` existe e é um SVG válido servido como `/coin.svg` | repository/asset test |
| ECO-COIN-02 | `/coin.svg` é a representação visual canônica de `campaign-credit` nas superfícies V2/V4 | DOM/visual/source review |
| ECO-COIN-03 | wallet exibe `/coin.svg` junto ao saldo numérico quando a moeda está disponível | E2E/DOM |
| ECO-COIN-04 | preço de offer em `campaign-credit` exibe `/coin.svg` junto ao valor | E2E/DOM |
| ECO-COIN-05 | quantidade de créditos em `credit_packs` usa `/coin.svg`, enquanto BRL permanece textual/formatado separadamente | E2E/DOM |
| ECO-COIN-06 | `coin.svg` não depende de R2, presigned URL, `ASSET_STORAGE_URL`, catálogo cosmético ou inventário | source/network negative test |
| ECO-COIN-07 | o glyph `◈` não é usado como identidade visual primária quando `/coin.svg` pode ser renderizado | DOM/source negative assertion |
| ECO-COIN-08 | saldo/preço possuem equivalente textual/acessível e não dependem apenas do ícone | accessibility test |
| ECO-COIN-09 | o path `/coin.svg` não precisa ser repetido em DTO econômico por item/offer | contract/source review |

## Gates BLOCKER — ledger

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-LED-01 | toda compra confirmada cria exatamente um débito no ledger | integration |
| ECO-LED-02 | delta do ledger é igual a `-price_paid` | DB integration |
| ECO-LED-03 | ledger referencia de forma estável o receipt da compra | DB/contract |
| ECO-LED-04 | equipagem, preview e navegação não criam lançamentos | integration |
| ECO-LED-05 | browser não possui mutação direta de ledger | route/source inspection |
| ECO-LED-06 | rollback de compra remove também qualquer ledger parcial | failure injection |
| ECO-LED-07 | retry idempotente não cria segundo lançamento | concurrency/integration |

## Gates BLOCKER — catálogo de cosméticos e conjuntos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CAT-01 | catálogo possui os quatro defaults com IDs estáveis e slots corretos | migration/query |
| ECO-CAT-02 | defaults são gratuitos e não dependem de offer | DB/service |
| ECO-CAT-03 | Exército, Lanças, Viking, Gato, Cachorro e Futebol são resolvidos pelo catálogo quando registrados | DB/storefront |
| ECO-CAT-04 | cada coleção de dados válida agrupa ataque, defesa e neutro | DB contract |
| ECO-CAT-05 | conjunto não representa ownership nem preço | schema/service review |
| ECO-CAT-06 | ID de cosmético é independente da object key | schema/contract |
| ECO-CAT-07 | item `retired` continua resolvível para ownership/snapshot existente | compatibility |
| ECO-CAT-08 | nome, descrição, status e ordem vêm do banco | DB→DTO |
| ECO-CAT-09 | frontend não possui allowlist temática de slugs | source review |
| ECO-CAT-10 | novo conjunto válido aparece sem branch React específica | integration/E2E |
| ECO-CAT-11 | item `available` sem offer ativa não se torna comprável por inferência | service/DTO negative test |

## Gates BLOCKER — offers e pricing

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-OFFER-01 | `catalog.offers` possui ID/slug estáveis, moeda, preço, status e ordem | schema/migration |
| ECO-OFFER-02 | todo offer `available` possui preço inteiro positivo | constraint/DB test |
| ECO-OFFER-03 | offers desta entrega usam `campaign-credit` | DB/contract |
| ECO-OFFER-04 | `catalog.offer_items` contém ao menos um cosmético por offer comprável | DB validation |
| ECO-OFFER-05 | composição da offer vem do banco e não do request do browser | API/service negative test |
| ECO-OFFER-06 | `draft` e `retired` não são adquiríveis | service integration |
| ECO-OFFER-07 | alterar preço no banco altera storefront sem rebuild/branch React | DB→DTO→DOM |
| ECO-OFFER-08 | frontend não hardcoda preço de produto | source inspection |
| ECO-OFFER-09 | receipt preserva `price_paid` histórico após mudança do preço atual da offer | integration |
| ECO-OFFER-10 | offer não cria ownership próprio | schema/repository review |
| ECO-OFFER-11 | baseline pode vender coleção de dados como bundle de três itens, mantendo ownership individual | integration |
| ECO-OFFER-12 | ownership parcial mostra estado derivado correto e compra cobra preço integral | integration/E2E |

## Gates BLOCKER — purchase

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-BUY-01 | compra exige sessão autenticada e ator deriva de `session.user.id` | route/service test |
| ECO-BUY-02 | payload não aceita `userId`, `price`, `currency`, `balance` ou `cosmeticIds` como autoridade | negative API test |
| ECO-BUY-03 | offer inexistente não altera wallet, ledger, purchase ou inventory | integration |
| ECO-BUY-04 | offer indisponível não altera estado econômico | integration |
| ECO-BUY-05 | saldo insuficiente não altera wallet, ledger, purchase ou inventory | integration |
| ECO-BUY-06 | compra válida debita exatamente o preço persistido | transaction integration |
| ECO-BUY-07 | compra válida cria exatamente um receipt confirmado | DB integration |
| ECO-BUY-08 | compra válida concede todos e somente os itens ausentes da offer | inventory integration |
| ECO-BUY-09 | offer totalmente possuída não gera novo débito | integration |
| ECO-BUY-10 | falha injetada após início da transação causa rollback completo | failure injection |
| ECO-BUY-11 | resposta de sucesso retorna wallet autoritativa atualizada e aquisição necessária à UI | API contract |
| ECO-BUY-12 | erros de compra não expõem SQL, connection string ou secrets | security test |

## Gates BLOCKER — idempotência e concorrência

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CON-01 | purchase exige `idempotencyKey` válida | route/service test |
| ECO-CON-02 | duas requests simultâneas com mesma chave e usuário produzem no máximo um receipt | concurrency integration |
| ECO-CON-03 | retry da mesma compra confirmada não debita novamente | idempotency integration |
| ECO-CON-04 | retry não duplica ledger | DB integration |
| ECO-CON-05 | retry não duplica ownership | DB integration |
| ECO-CON-06 | duas compras diferentes concorrentes serializam a wallet corretamente | concurrency integration |
| ECO-CON-07 | saldo nunca fica negativo sob corrida | concurrency + DB constraint |
| ECO-CON-08 | cenário saldo 500 / duas offers 400 confirma no máximo uma compra | concurrency integration |
| ECO-CON-09 | ownership continua único sob corrida | constraint/concurrency |
| ECO-CON-10 | chave de um usuário não concede autoridade ou receipt a outro | authorization concurrency test |

## Gates BLOCKER — inventário

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-INV-01 | novo comandante possui os quatro defaults | onboarding integration |
| ECO-INV-02 | ownership é único por usuário/item | constraint |
| ECO-INV-03 | compra grava `acquisition_source='purchase'` ou equivalente estável | DB integration |
| ECO-INV-04 | compra de ownership parcial insere somente itens ausentes | integration |
| ECO-INV-05 | browser não consegue conceder item arbitrário | route/security |
| ECO-INV-06 | retirar/aposentar offer não remove ownership existente | compatibility |
| ECO-INV-07 | reexecutar inicialização não duplica defaults nem altera saldo | idempotency integration |

## Gates BLOCKER — loadout

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-LOAD-01 | existem exatamente quatro slots: ataque, defesa, neutro e território | schema/contract |
| ECO-LOAD-02 | quatro defaults começam equipados | onboarding/upgrade |
| ECO-LOAD-03 | usuário só equipa item possuído | service negative test |
| ECO-LOAD-04 | usuário não equipa item em slot incompatível | service/DB negative |
| ECO-LOAD-05 | reequipar o mesmo item é idempotente | integration |
| ECO-LOAD-06 | equipar um slot preserva os outros três | integration |
| ECO-LOAD-07 | ator deriva de `session.user.id` | security/source |
| ECO-LOAD-08 | equipagem nunca altera wallet ou ledger | integration |
| ECO-LOAD-09 | item recém-comprado pode ser equipado quando `available` | purchase→equip integration |
| ECO-LOAD-10 | estado legado incompleto resolve fallback default | compatibility |

## Gates BLOCKER — storefront

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-STORE-01 | storefront mostra saldo real da wallet acompanhado de `/coin.svg` | E2E/DOM |
| ECO-STORE-02 | catálogo e offers vêm de service/DTO real, não fixture | source/integration |
| ECO-STORE-03 | toda offer `available` retornada é renderizada | E2E/DOM |
| ECO-STORE-04 | preço mostrado corresponde ao valor persistido e usa `/coin.svg` para indicar `campaign-credit` | DB→DTO→DOM |
| ECO-STORE-05 | estado `COMPRAR`, `POSSUÍDO`, `EQUIPADO` ou indisponível corresponde ao backend | E2E |
| ECO-STORE-06 | offer parcialmente possuída informa progresso/estado sem inventar desconto | E2E |
| ECO-STORE-07 | clicar preview não altera wallet/inventory/loadout | interaction/integration |
| ECO-STORE-08 | novo offer válido aparece sem alteração temática de React | integration/E2E |
| ECO-STORE-09 | novo preço persistido aparece sem rebuild | integration/E2E |
| ECO-STORE-10 | storefront não depende de `ListObjects` | source/integration |
| ECO-STORE-11 | preview ausente possui fallback visual seguro | E2E |
| ECO-STORE-12 | compra confirmada atualiza saldo e estado de ownership a partir da resposta autoritativa | E2E |

## Gates BLOCKER — pacotes de créditos em BRL

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CASH-01 | pacotes demonstrativos vêm do banco | DB→DTO→DOM |
| ECO-CASH-02 | `credit_amount` é inteiro positivo | constraint |
| ECO-CASH-03 | `price_brl_cents` é inteiro positivo | constraint |
| ECO-CASH-04 | preço BRL exibido é derivado do valor persistido, não hardcoded no React | source/DOM |
| ECO-CASH-05 | pacotes desta entrega são inequívocos `EM BREVE`/disabled | E2E |
| ECO-CASH-06 | clicar/ativar pack não altera wallet ou ledger | interaction/integration |
| ECO-CASH-07 | não existe checkout funcional | route/source inspection |
| ECO-CASH-08 | não existe webhook de pagamento | route/source inspection |
| ECO-CASH-09 | não existe integração obrigatória com Stripe, Mercado Pago ou outro PSP | dependency/source review |
| ECO-CASH-10 | browser não consegue converter BRL em créditos por endpoint escondido | security negative test |
| ECO-CASH-11 | quantidade de `campaign-credit` do pack é apresentada com `/coin.svg`, sem confundir o ícone com o preço em BRL | E2E/visual |

## Gates BLOCKER — object storage / R2

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-ASSET-01 | `ASSET_STORAGE_URL` é a única variável necessária para conexão da aplicação ao storage | env/config review |
| ECO-ASSET-02 | parser aceita `s3://<key>:<secret>@<endpoint>/<bucket>?region=auto` | parser contract |
| ECO-ASSET-03 | credenciais percent-encoded são decodificadas corretamente | parser edge case |
| ECO-ASSET-04 | endpoint efetivo é HTTPS e sem credenciais | security unit |
| ECO-ASSET-05 | bucket esperado é `war-brasil-assets-prod` | config test |
| ECO-ASSET-06 | região R2 é `auto` | config test |
| ECO-ASSET-07 | configuração inválida falha sem expor segredo | negative test |
| ECO-ASSET-08 | connection string/Secret Access Key não entram em browser, DTO, HTML, log ou evidência E2E | secret scan |
| ECO-ASSET-09 | catálogo/snapshot persistem referência estável, nunca presigned URL | DB/source |
| ECO-ASSET-10 | URL de entrega possui expiração finita e acesso somente leitura ao objeto necessário | signing contract |
| ECO-ASSET-11 | browser não consegue solicitar object key arbitrária fora do catálogo | security negative |
| ECO-ASSET-12 | storefront normal não usa `ListObjects` | source inspection |
| ECO-ASSET-13 | objeto ausente produz fallback sem alterar economia/gameplay | failure E2E |
| ECO-ASSET-14 | dados ativos usam somente `attack.webp`, `defense.webp`, `neutral.webp` | DB/storage contract |
| ECO-ASSET-15 | não há referência ativa `.svg/.png/.jpg/.jpeg` em `cosmetics/dice/` | negative DB/source |
| ECO-ASSET-16 | WebP possui `Content-Type: image/webp` | storage integration |
| ECO-ASSET-17 | coleção ativa não fica parcialmente local/SVG e parcialmente R2/WebP | migration/storage atomicity |
| ECO-ASSET-18 | `/coin.svg` continua disponível como asset local mesmo quando R2/`ASSET_STORAGE_URL` está indisponível | failure/network E2E |

## Gates BLOCKER — dados e território

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DICE-01 | iniciativa usa `dice_neutral` do jogador | integration |
| ECO-DICE-02 | atacante usa `dice_attack` do próprio jogador | battle integration |
| ECO-DICE-03 | defensor usa `dice_defense` do próprio jogador | battle integration |
| ECO-DICE-04 | jogadores podem usar skins diferentes na mesma batalha | multi-client E2E |
| ECO-DICE-05 | skin não altera RNG, valores ou balanceamento | regression/property |
| ECO-DICE-06 | skin não altera geometria, collider ou detecção de face | physics regression |
| ECO-DICE-07 | falha de asset não altera resultado autoritativo | failure test |
| ECO-MAP-01 | efeito territorial preserva identificação inequívoca do `PlayerColor` | visual seis cores |
| ECO-MAP-02 | efeito não altera hitbox, seleção, hover ou foco | interaction regression |
| ECO-MAP-03 | efeito não reduz legibilidade de tropas | visual desktop/mobile |
| ECO-MAP-04 | mapa não consulta inventário por território | source/performance |

## Gates BLOCKER — snapshot de partida

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-GAME-01 | loadout efetivo é congelado no início da partida | DB/start-game |
| ECO-GAME-02 | alterar Arsenal durante partida não altera partida ativa | multi-client E2E |
| ECO-GAME-03 | reconnect recupera exatamente o snapshot cosmético | reconnect E2E |
| ECO-GAME-04 | todos os clientes veem a mesma configuração por jogador | multi-client E2E |
| ECO-GAME-05 | bots usam defaults | integration |
| ECO-GAME-06 | GameSnapshot não expõe saldo, ledger, purchases, inventory completo ou secrets | security snapshot |
| ECO-GAME-07 | runtime não consulta storefront/profile a cada batalha/renderização | architecture inspection |
| ECO-GAME-08 | snapshot persiste referência estável, não URL presigned | DB/source |

## Gates BLOCKER — segurança e boundary

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-SEC-01 | wallet, purchase, inventory e loadout exigem sessão | route/service tests |
| ECO-SEC-02 | browser não é autoridade para saldo, preço, moeda, offer, composição, ownership, status, slot ou object key | negative tests |
| ECO-SEC-03 | React não executa SQL nem instancia S3 com credenciais | architecture inspection |
| ECO-SEC-04 | Route Handlers não retornam `SELECT *` de tabelas econômicas | source/DTO review |
| ECO-SEC-05 | catálogo público não vaza ownership privado de outros usuários | API snapshot |
| ECO-SEC-06 | nenhuma mutação financeira ocorre fora de transação | source/integration |
| ECO-SEC-07 | não existe `NEXT_PUBLIC_ASSET_STORAGE_URL` ou alias equivalente | env/source scan |
| ECO-SEC-08 | mensagens de erro sanitizam secrets e URLs sensíveis | failure/security |

## Gates BLOCKER — migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DB-01 | migration V2 aplica sobre banco que já possui Economy V1 | upgrade integration |
| ECO-DB-02 | migration V2 aplica em banco limpo via sequência normal | clean integration |
| ECO-DB-03 | migration é forward-only e não reescreve 038/039/040 | repository review |
| ECO-DB-04 | wallets, inventory, loadout e snapshots existentes são preservados | upgrade integration |
| ECO-DB-05 | constraints de offers/purchases impedem preço inválido e receipts duplicados | DB negative tests |
| ECO-DB-06 | índices novos possuem relação direta com consultas/locks previstos | query review |
| ECO-DB-07 | adoção de `/coin.svg` não exige migration de saldo/ledger/inventory nem altera autoridade monetária | migration/schema review |

## Cenários obrigatórios

### Wallet / purchase

- `ECO2-S1`: usuário com saldo `1000` compra offer de `400`; saldo final `600`, um receipt, um ledger e ownership esperado.
- `ECO2-S2`: usuário com saldo `100` tenta offer de `400`; nada é alterado.
- `ECO2-S3`: offer inexistente.
- `ECO2-S4`: offer `draft`.
- `ECO2-S5`: offer `retired`.
- `ECO2-S6`: produto integralmente possuído.
- `ECO2-S7`: bundle 1/3 possuído; preço integral é cobrado e somente 2 itens são inseridos.
- `ECO2-S8`: preço da offer muda após compra; receipt histórico mantém `price_paid` original.
- `ECO2-S9`: tentativa de forjar `price`, `currency`, `cosmeticIds` ou `userId` no request não altera autoridade server-side.

### Idempotência / concorrência

- `ECO2-S10`: duplo clique com mesma idempotency key.
- `ECO2-S11`: retry após resposta perdida.
- `ECO2-S12`: duas abas usam a mesma chave simultaneamente.
- `ECO2-S13`: saldo 500, offers A/B de 400 em paralelo; somente uma confirma.
- `ECO2-S14`: duas compras concorrentes tentam inserir o mesmo ownership.
- `ECO2-S15`: falha injetada depois da criação do receipt antes do commit; nenhuma mutação parcial persiste.

### Storefront / Arsenal

- `ECO2-S16`: storefront recebe saldo, offers e ownership reais e representa `campaign-credit` com `/coin.svg`.
- `ECO2-S17`: alterar preço no banco altera UI sem rebuild.
- `ECO2-S18`: inserir offer válida altera UI sem branch temática React.
- `ECO2-S19`: compra confirmada muda card para estado possuído e atualiza wallet.
- `ECO2-S20`: item comprado é equipado e permanece após reload.
- `ECO2-S21`: item não possuído não pode ser equipado.
- `ECO2-S21A`: offer de `campaign-credit` mostra `/coin.svg` ao lado do preço e mantém o valor acessível textualmente.

### BRL inativo

- `ECO2-S22`: pack mostra quantidade de créditos com `/coin.svg` e preço BRL persistido separadamente.
- `ECO2-S23`: CTA do pack está disabled/EM BREVE.
- `ECO2-S24`: ativação por mouse, teclado ou request manual não altera wallet.
- `ECO2-S25`: inventário de rotas confirma ausência de checkout/webhook funcional.

### Assets / runtime

- `ECO2-S26`: preview WebP válido carrega do R2.
- `ECO2-S27`: asset cosmético ausente usa fallback sem alterar compra/gameplay.
- `ECO2-S28`: dois jogadores com skins diferentes batalham sem alterar RNG/física.
- `ECO2-S29`: reconnect mantém cosmético congelado com nova URL efêmera quando necessário.
- `ECO2-S30`: R2 indisponível não impede carregamento de `/coin.svg` nem transforma saldo real em indisponível.

## Testes de concorrência obrigatórios

Executar, no mínimo:

1. duas compras simultâneas com a mesma idempotency key;
2. duas compras diferentes disputando saldo insuficiente para ambas;
3. retry da compra depois do commit;
4. duas inserções concorrentes do mesmo ownership;
5. compra concorrente com leitura/refresh da storefront.

O estado final MUST ser determinístico e consistente entre `wallets`, `ledger_entries`, `purchases` e `inventory.cosmetics`.

## Score / 100

Todos os BLOCKERs são obrigatórios. O score mede qualidade adicional:

- 20 — atomicidade, ledger e receipts;
- 20 — idempotência e concorrência;
- 15 — catálogo/offers/storefront dinâmicos;
- 10 — inventário e loadout;
- 10 — segurança e boundaries;
- 10 — R2/assets e representação canônica da moeda;
- 5 — integração de partida;
- 5 — performance/observabilidade;
- 5 — qualidade de migrations e evidências.

Meta de qualidade: **>= 90/100**, além de todos os BLOCKERs verdes.

## Evidência mínima de aprovação

A revisão final MUST incluir:

- testes unitários de parsing/contratos relevantes;
- teste/inspeção de `public/coin.svg` e sua entrega em `/coin.svg`;
- testes DOM/E2E do ícone em wallet, preço de offer e pack de créditos;
- testes DB de constraints e transactions;
- testes de integração de compra/equipagem;
- testes de concorrência reais contra PostgreSQL;
- E2E do storefront e Arsenal;
- inspeção de rotas para confirmar ausência de checkout real;
- evidência desktop/mobile dos estados comerciais principais;
- secret scan para storage/economia;
- regressão de dados/território/snapshot.
