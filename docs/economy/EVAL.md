# EVAL — Economia, Loja e Cosméticos

Avaliar conforme `SPEC.md` e os padrões de qualidade vigentes do projeto.

Aprovação exige **todos os BLOCKERs verdes**. Nenhuma compra, recompensa ou grant econômico pode ser habilitado como atalho para satisfazer os cenários desta entrega.

## Gates BLOCKER — carteira e moeda

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-WAL-01 | existe somente `campaign-credit` como moeda real ativa desta entrega | schema/contract test |
| ECO-WAL-02 | todo usuário existente recebe saldo persistente exatamente `0` no upgrade | DB integration |
| ECO-WAL-03 | todo novo comandante inicia com saldo persistente exatamente `0` | onboarding integration |
| ECO-WAL-04 | saldo não pode ficar negativo por constraint | DB negative test |
| ECO-WAL-05 | valores monetários são inteiros | schema/type review |
| ECO-WAL-06 | nenhum fluxo normal concede créditos | source/API inspection |
| ECO-WAL-07 | nenhum fluxo normal gasta créditos | source/API inspection |
| ECO-WAL-08 | não existe endpoint público funcional de grant/reward/purchase/transferência | route inventory/security review |
| ECO-WAL-09 | saldo `0` projetado no Profile vem de fonte persistente disponível, não de fallback sintético | integration/DTO |
| ECO-WAL-10 | ledger permanece sem entradas após cadastro, login, vitória, derrota e navegação normal | integration |

## Gates BLOCKER — catálogo e conjuntos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CAT-01 | catálogo possui os quatro itens default com IDs estáveis e slots corretos | migration/query test |
| ECO-CAT-02 | catálogo possui Exército com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-03 | catálogo possui Lanças com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-04 | catálogo possui Viking com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-05 | catálogo possui Gato com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-06 | catálogo possui Cachorro com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-07 | catálogo possui Futebol com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-08 | cada conjunto de dados agrupa exatamente os três papéis esperados | DB test |
| ECO-CAT-09 | conjuntos anunciados iniciam como `announced` e não adquiríveis | DB/storefront test |
| ECO-CAT-10 | conjunto não cria ownership próprio nem implica ownership de todos os itens | schema/service review |
| ECO-CAT-11 | ID de cosmético é independente da object key física | schema/contract review |
| ECO-CAT-12 | item `retired` continua resolvível para ownership/snapshot já existente | compatibility test |
| ECO-CAT-13 | nome, descrição, ordem e status da remessa vêm do banco | repository/DTO test |
| ECO-CAT-14 | frontend não possui allowlist hardcoded de slugs de conjuntos | source review |
| ECO-CAT-15 | inserir novo conjunto `announced` válido no catálogo o torna visível sem alteração temática de React | integration/E2E |

## Gates BLOCKER — object storage / R2

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-ASSET-01 | `ASSET_STORAGE_URL` é a única variável necessária para conexão da aplicação ao storage | env/config source review |
| ECO-ASSET-02 | connection string possui credenciais, endpoint, bucket e região parseáveis | parser unit test |
| ECO-ASSET-03 | `ASSET_STORAGE_URL` aceita o formato `s3://<key>:<secret>@<endpoint>/<bucket>?region=auto` | parser contract test |
| ECO-ASSET-04 | credenciais percent-encoded são decodificadas corretamente pelo parser | parser edge-case test |
| ECO-ASSET-05 | endpoint HTTP efetivo derivado é HTTPS e não contém credenciais | unit/security test |
| ECO-ASSET-06 | bucket derivado é `war-brasil-assets-prod` no ambiente esperado | config test |
| ECO-ASSET-07 | região R2 resolvida é `auto` | config test |
| ECO-ASSET-08 | ausência ou formato inválido falha server-side sem expor segredo | negative test |
| ECO-ASSET-09 | `ASSET_STORAGE_URL` não possui prefixo `NEXT_PUBLIC_` e não entra no bundle do browser | build/source inspection |
| ECO-ASSET-10 | `ASSET_STORAGE_URL` original/completa e Secret Access Key não aparecem em API, DTO, HTML, log ou evidência E2E; Access Key ID pode aparecer somente onde SigV4 o exige, como `X-Amz-Credential` de URL presigned | secret scan/E2E negative assertion |
| ECO-ASSET-11 | catálogo/snapshot persistem object key ou referência estável, nunca URL com credenciais | DB/schema test |
| ECO-ASSET-12 | URL presigned não é persistida como identidade do cosmético | DB/source test |
| ECO-ASSET-13 | servidor consegue gerar GET presigned de objeto registrado sem expor Secret Access Key nem a connection string original | integration test controlado |
| ECO-ASSET-14 | URL presigned possui expiração finita e autoriza somente o objeto solicitado | signing contract test |
| ECO-ASSET-15 | browser não consegue solicitar assinatura de object key arbitrária fora do catálogo autoritativo | negative route/service test |
| ECO-ASSET-16 | storefront normal não executa `ListObjects` para descobrir produtos | source/integration inspection |
| ECO-ASSET-17 | objeto ausente/falha R2 produz fallback visual seguro sem alterar gameplay | failure test |
| ECO-ASSET-18 | acesso browser direto ao asset assinado funciona com CORS da aplicação | browser/network E2E |
| ECO-ASSET-19 | todo asset de dado do R2 possui object key terminada em `attack.webp`, `defense.webp` ou `neutral.webp` | DB/storage contract test |
| ECO-ASSET-20 | nenhuma object key ativa em `cosmetics/dice/` usa `.svg`, `.png`, `.jpg`, `.jpeg` ou outra extensão | DB/source negative test |
| ECO-ASSET-21 | `HeadObject` dos assets de dados retorna `Content-Type: image/webp` | storage integration |
| ECO-ASSET-22 | extensão `.webp` e MIME `image/webp` são validados em conjunto | storage negative test |
| ECO-ASSET-23 | baseline contém 21 objetos válidos: 7 diretórios × ataque/defesa/neutro | storage inventory test |
| ECO-ASSET-24 | runtime/browser não solicita `.svg` dentro de `cosmetics/dice/` após o cutover | browser network negative assertion |
| ECO-ASSET-25 | uma coleção não entra no cutover se qualquer um dos três WebPs estiver ausente ou inválido | migration/storage failure test |
| ECO-ASSET-26 | nenhuma coleção ativa fica parcialmente em local/SVG e parcialmente em R2/WebP | migration atomicity test |

## Gates BLOCKER — inventário

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-INV-01 | novo comandante possui os quatro defaults | integration |
| ECO-INV-02 | usuários existentes recebem somente os quatro defaults no backfill desta entrega | upgrade integration |
| ECO-INV-03 | ownership é único por usuário/item | constraint/concurrency test |
| ECO-INV-04 | nenhum conjunto `announced` é concedido automaticamente | integration |
| ECO-INV-05 | browser não consegue conceder item a si próprio | route/security test |
| ECO-INV-06 | reexecutar inicialização não duplica grants nem altera saldo | idempotency integration |

## Gates BLOCKER — loadout

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-LOAD-01 | existem exatamente quatro slots nesta entrega: ataque, defesa, neutro e efeito territorial | schema/contract |
| ECO-LOAD-02 | os quatro defaults começam equipados | onboarding/upgrade integration |
| ECO-LOAD-03 | usuário só equipa item que possui | service/DB negative test |
| ECO-LOAD-04 | usuário não equipa item em slot incompatível | service/DB negative test |
| ECO-LOAD-05 | equipar o mesmo item novamente é idempotente | integration |
| ECO-LOAD-06 | equipar um slot preserva os outros três | integration |
| ECO-LOAD-07 | mutação deriva ator de `session.user.id`, nunca de `userId` do browser | security/source inspection |
| ECO-LOAD-08 | equipagem nunca altera saldo nem ledger | integration |
| ECO-LOAD-09 | estado legado/incompleto resolve fallback default sem quebrar runtime | compatibility test |

## Gates BLOCKER — storefront / Intendência

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-STORE-01 | Profile mostra saldo real `◈ 0` quando wallet está disponível | E2E/DOM |
| ECO-STORE-02 | Intendência possui entrada clara para a loja | E2E/DOM |
| ECO-STORE-03 | `/profile/store` é autenticada e utiliza a cena `profile` existente | route/Foundation E2E |
| ECO-STORE-04 | todos os conjuntos `announced` retornados pelo catálogo são renderizados | E2E/DOM |
| ECO-STORE-05 | baseline mostra Exército, Lanças, Viking, Gato, Cachorro e Futebol quando registrados | E2E/DOM |
| ECO-STORE-06 | itens `announced` possuem estado inequívoco `EM BREVE` ou equivalente | interaction review |
| ECO-STORE-07 | nenhum item sem fluxo de aquisição oferece CTA `COMPRAR` | E2E/DOM negative assertion |
| ECO-STORE-08 | nenhum clique em preview de item não possuído altera inventário/loadout | interaction/integration |
| ECO-STORE-09 | nenhum preço é inventado para anúncio sem oferta ativa | DTO/DOM review |
| ECO-STORE-10 | defaults aparecem como possuídos e podem ser equipados | E2E/integration |
| ECO-STORE-11 | storefront real não depende da fixture sintética de Profile | source/integration |
| ECO-STORE-12 | nome e descrição exibidos são os valores persistidos no catálogo | DB→DTO→DOM E2E |
| ECO-STORE-13 | adicionar/remover um conjunto da resposta de catálogo altera a UI sem branch temática no componente | component/integration |

## Gates BLOCKER — dados

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DICE-01 | iniciativa/rolagem neutra usa `dice_neutral` do jogador | integration/visual contract |
| ECO-DICE-02 | atacante usa `dice_attack` do próprio jogador | battle integration |
| ECO-DICE-03 | defensor usa `dice_defense` do próprio jogador | battle integration |
| ECO-DICE-04 | dois jogadores podem usar skins diferentes na mesma batalha | multi-player E2E |
| ECO-DICE-05 | fallback 2D e apresentação 3D resolvem o mesmo cosmético WebP | contract/E2E |
| ECO-DICE-06 | skin não altera RNG, valores ou balanceamento adaptativo | regression/property tests |
| ECO-DICE-07 | skin não altera geometria, collider, trajetória ou detecção de face | dice physics regression |
| ECO-DICE-08 | ausência/falha/expiração de asset não altera resultado autoritativo da rolagem | failure test |
| ECO-DICE-09 | renderer 2D aceita WebP remoto/presigned sem depender de SVG local | browser/component E2E |
| ECO-DICE-10 | renderer 3D consegue usar WebP remoto como base de textura mantendo pips/resultado | visual/physics E2E |

## Gates BLOCKER — efeitos territoriais

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-MAP-01 | `territory.effect.default` existe, é possuído e equipado por padrão | DB/integration |
| ECO-MAP-02 | efeito territorial preserva identificação inequívoca do `PlayerColor` | visual review nas seis cores |
| ECO-MAP-03 | efeito não altera hitbox, seleção, hover, foco ou alvo válido | interaction regression |
| ECO-MAP-04 | efeito não reduz legibilidade do marcador de tropas | desktop/mobile visual |
| ECO-MAP-05 | mapa não consulta inventário por território | source/performance review |
| ECO-MAP-06 | mudança cosmética não recria estado autoritativo dos 42 territórios | render/performance review |

## Gates BLOCKER — snapshot de partida

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-GAME-01 | loadout efetivo é congelado no início da partida | DB/start-game integration |
| ECO-GAME-02 | alterar Profile durante partida não altera cosméticos da partida ativa | multi-client E2E |
| ECO-GAME-03 | reconnect recupera exatamente o snapshot cosmético da partida | reconnect E2E |
| ECO-GAME-04 | todos os clientes veem a mesma configuração cosmética por jogador | multi-client E2E |
| ECO-GAME-05 | bots usam os quatro defaults | integration |
| ECO-GAME-06 | GameSnapshot expõe somente configuração visual necessária | DTO snapshot/security |
| ECO-GAME-07 | GameSnapshot não expõe saldo, ledger, inventário completo, `auth.user.id` ou `ASSET_STORAGE_URL` | security snapshot |
| ECO-GAME-08 | runtime não consulta Profile/store a cada batalha/renderização | architecture/source inspection |
| ECO-GAME-09 | snapshot congela object key WebP/referência persistente e nunca URL presigned efêmera | DB/source integration |
| ECO-GAME-10 | reconnect pode gerar nova URL de transporte para a mesma object key sem mudar o cosmético congelado | reconnect/storage E2E |

## Gates BLOCKER — segurança e boundary

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-SEC-01 | wallet, inventory e loadout próprios exigem sessão autenticada | route/service tests |
| ECO-SEC-02 | browser não é autoridade para saldo, ownership, status, slot, oferta ou object key arbitrária | negative tests/source review |
| ECO-SEC-03 | React components não executam SQL nem instanciam cliente S3 com credenciais | architecture inspection |
| ECO-SEC-04 | Route Handlers não retornam `SELECT *` de tabelas econômicas internas | source/DTO review |
| ECO-SEC-05 | catálogo público não vaza ownership privado de outros usuários | API snapshot |
| ECO-SEC-06 | outros jogadores recebem somente cosméticos congelados necessários à partida | DTO/security |
| ECO-SEC-07 | não existe mutação financeira parcial ou não transacional escondida no runtime | source inspection |
| ECO-SEC-08 | não existe `NEXT_PUBLIC_ASSET_STORAGE_URL` nem alias público equivalente | source/env scan |
| ECO-SEC-09 | mensagens de erro sanitizam connection string e assinatura S3 | failure/log test |

## Gates BLOCKER — performance de assets

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-PERF-01 | listagem da loja não baixa automaticamente o catálogo inteiro de WebPs HQ | browser network evidence |
| ECO-PERF-02 | cards usam representação leve sem exigir `preview.webp` nesta entrega | asset/network review |
| ECO-PERF-03 | WebP HQ é carregado sob demanda ou quando necessário ao item equipado | network evidence |
| ECO-PERF-04 | abrir um detalhe solicita somente o asset selecionado, não os três papéis de todos os conjuntos | network evidence |
| ECO-PERF-05 | troca de estação/seleção da loja não força remontagem desnecessária da Foundation | React/browser evidence |
| ECO-PERF-06 | mapa permanece sem fetch por território ou por frame | network/source inspection |
| ECO-PERF-07 | storefront não lista bucket/prefixos no R2 para montar catálogo | source/network evidence |
| ECO-PERF-08 | presign é feito somente quando necessário e não em massa para itens fora da viewport/detalhe | source/network evidence |
| ECO-PERF-09 | nenhum request normal do runtime para `cosmetics/dice/` solicita SVG após migração | browser network assertion |

## Gates BLOCKER — migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DB-01 | migrations aplicam em banco limpo | integration DB |
| ECO-DB-02 | migrations aplicam sobre baseline atual | upgrade integration |
| ECO-DB-03 | migrations são idempotentes segundo o runner atual | repeat migration test |
| ECO-DB-04 | usuários existentes recebem wallet zero + quatro defaults sem perda de dados | upgrade fixture |
| ECO-DB-05 | novos usuários são inicializados de forma idempotente | onboarding integration |
| ECO-DB-06 | constraints impedem saldo negativo, ownership duplicado e equipagem inválida conforme modelagem final | DB negative tests |
| ECO-DB-07 | catálogo seed é determinístico | clean/repeat DB test |
| ECO-DB-08 | referências locais `/dados/...` são migradas para object keys `.webp` sem alterar IDs/ownership | upgrade integration |
| ECO-DB-09 | metadata de conjunto inclui `storage_slug`/prefixo suficiente para resolver a pasta física | schema/query test |
| ECO-DB-10 | cutover só ocorre depois de validar os três WebPs da coleção no R2 | migration/storage integration |
| ECO-DB-11 | nenhuma coleção fica com referências mistas SVG/local e WebP/R2 | atomicity/upgrade test |

## Cenários obrigatórios

### Carteira

- `ECO-S1`: usuário existente recebe `◈ 0` após upgrade;
- `ECO-S2`: novo usuário completa onboarding e recebe `◈ 0`;
- `ECO-S3`: usuário vence partida e continua com `◈ 0`;
- `ECO-S4`: usuário perde partida e continua com `◈ 0`;
- `ECO-S5`: usuário faz logout/login e saldo continua `◈ 0`;
- `ECO-S6`: tentativa de criar saldo negativo é rejeitada.

### Inventário e loadout

- `ECO-S7`: novo usuário possui os quatro defaults;
- `ECO-S8`: usuário equipa novamente um default;
- `ECO-S9`: usuário tenta equipar item anunciado sem possuir;
- `ECO-S10`: usuário tenta equipar dado de defesa no slot de ataque;
- `ECO-S11`: atualização de ataque preserva defesa, neutro e território;
- `ECO-S12`: inicialização executada duas vezes não duplica nada.

### Loja

- `ECO-S13`: abrir Intendência pelo Profile;
- `ECO-S14`: abrir `/profile/store`;
- `ECO-S15`: visualizar todos os conjuntos `announced` retornados pelo catálogo;
- `ECO-S16`: verificar baseline Exército, Lanças, Viking, Gato, Cachorro e Futebol;
- `ECO-S17`: abrir preview detalhada sem adquirir item;
- `ECO-S18`: confirmar ausência de CTA de compra e preço inventado;
- `ECO-S19`: inserir conjunto de teste `announced` no catálogo e confirmar aparecimento sem alterar React.

### Object storage

- `ECO-S30`: inicializar parser com uma única `ASSET_STORAGE_URL` válida;
- `ECO-S31`: validar credenciais percent-encoded e derivação de endpoint/bucket/region;
- `ECO-S32`: configuração inválida falha sem imprimir segredo;
- `ECO-S33`: resolver item registrado para GET presigned e carregar WebP no browser;
- `ECO-S34`: confirmar que `ASSET_STORAGE_URL` original/completa e Secret Access Key não aparecem em HTML, JSON ou console/log capturado; o Access Key ID é permitido apenas no `X-Amz-Credential` da URL SigV4 assinada;
- `ECO-S35`: alterar/expirar URL presigned e confirmar que a object key persistente continua sendo a identidade do item;
- `ECO-S36`: object key não registrada não pode obter assinatura arbitrária por solicitação do browser;
- `ECO-S37`: validar `attack.webp`, `defense.webp` e `neutral.webp` em cada um dos sete diretórios do baseline;
- `ECO-S38`: rejeitar asset de dado `.svg` ou com MIME diferente de `image/webp`;
- `ECO-S39`: confirmar por network trace que preview e partida solicitam WebP e não SVG do namespace de dados;
- `ECO-S40`: simular coleção com somente dois WebPs válidos e impedir cutover para R2.

### Partida

- `ECO-S20`: dois jogadores iniciam partida com defaults;
- `ECO-S21`: jogador com skin de teste autorizada usa ataque personalizado e defesa padrão;
- `ECO-S22`: atacante e defensor usam skins diferentes simultaneamente;
- `ECO-S23`: jogador muda loadout no Profile durante partida e partida ativa não muda;
- `ECO-S24`: jogador reconecta e mantém visual congelado;
- `ECO-S25`: bot participa usando defaults;
- `ECO-S26`: fallback 2D mostra a mesma escolha WebP que 3D.

### Território

- `ECO-S27`: cada uma das seis cores com efeito default permanece reconhecível;
- `ECO-S28`: aplicar efeito de teste não altera seleção/hover;
- `ECO-S29`: troca de cosmético entre partidas não altera dados autoritativos do território.

## Testes de concorrência obrigatórios

Mesmo sem compra, executar pelo menos:

1. duas inicializações simultâneas do mesmo usuário;
2. duas equipagens simultâneas do mesmo slot;
3. equipagens concorrentes em slots diferentes;
4. leitura de loadout concorrente com equipagem;
5. início de partida concorrente com alteração de loadout.

O resultado MUST ser determinístico. O snapshot da partida deve refletir uma configuração transacionalmente consistente e permanecer congelado depois de criado.

## Auditoria de superfícies mutáveis

A auditoria MUST enumerar todos os endpoints/serviços capazes de alterar:

- `economy.*`;
- `inventory.*`;
- catálogo cosmético;
- loadout cosmético em `profile.*`;
- snapshot cosmético em `game.*`;
- object storage.

Nesta entrega, o resultado esperado para dinheiro é: **nenhuma mutação exposta ao usuário**.

Para inventário, o resultado esperado é: grants somente pela inicialização/migration controlada dos defaults.

Para loadout, a única mutação normal esperada é equipar item já possuído.

Para R2, o resultado esperado no runtime da loja é leitura/presign; upload, delete e alteração de bucket não são operações de usuário desta entrega.

## Auditoria de dados

Para cada campo econômico ou cosmético visível registrar:

- fonte autoritativa;
- disponibilidade;
- política de acesso;
- DTO de saída;
- se é persistente, derivado ou snapshot.

Para assets registrar adicionalmente:

- `cosmetic_id`;
- `set_id`;
- `storage_slug`;
- object key `.webp` persistida;
- `Content-Type: image/webp` esperado;
- URL presigned apenas como valor efêmero quando aplicável.

`0`, lista vazia e `não possuído` somente podem ser exibidos como fatos quando a respectiva fonte real foi consultada com sucesso.

## Evidência visual mínima

Capturar pelo menos:

- Profile/Tesouraria com `◈ 0`;
- Profile/Intendência com todas as remessas `announced` do baseline;
- `/profile/store` desktop 1440x900;
- `/profile/store` mobile 390x844;
- detalhe de pelo menos três coleções distintas carregando WebP do R2 sob demanda;
- loadout com os quatro defaults;
- batalha com skins WebP distintas de atacante/defensor em harness controlado;
- território nas seis cores com efeito default.

Reduced-motion e fallback da Foundation continuam obrigatórios onde aplicáveis.

## Performance

Validar por DevTools ou evidência automatizada:

- nenhum carregamento em lote de todos os WebPs HQ apenas ao abrir a loja;
- nenhuma descoberta do catálogo por `ListObjects` em request normal da storefront;
- preview detalhado solicita somente os objetos efetivamente abertos;
- nenhuma request normal para `cosmetics/dice/**/*.svg` após o cutover;
- ausência de N+1 para inventário/loadout;
- ausência de consulta Profile por território;
- ausência de consulta Profile por frame/rolagem;
- resolução de catálogo e loadout em número limitado de queries;
- presign não é gerado em massa para todo o catálogo;
- mudança cosmética não causa regressão perceptível de interação do mapa.

## Plano técnico de cutover SVG → WebP

A implementação só pode ser finalizada depois de executar e validar esta sequência:

1. converter os assets atuais de dados para WebP mantendo transparência e qualidade visual;
2. subir `attack.webp`, `defense.webp` e `neutral.webp` para `default`, `military-classic`, `medieval-spears`, `viking`, `cat`, `dog` e `football`;
3. validar os 21 objetos via S3 API, incluindo extensão e `Content-Type: image/webp`;
4. implementar parser/cliente de `ASSET_STORAGE_URL` e resolução/presign server-only;
5. criar migration que troca as referências locais/legadas por object keys `.webp` somente após validação do conjunto completo;
6. garantir que snapshot de partida congele object key WebP e não URL assinada;
7. ajustar renderers 2D/3D e previews para WebP remoto/presigned;
8. executar E2E de storefront, network, iniciativa, batalha, multi-client, reconnect e bots;
9. provar zero request SVG para dados remotos;
10. remover referências runtime e, após gates verdes, arquivos SVG de dados locais que ficaram obsoletos.

O cutover MUST ser atômico por coleção e MUST evitar estado híbrido de uma mesma coleção.

## Fora do EVAL desta entrega

Não avaliar como funcionalidade implementada:

- compra;
- checkout;
- preço real;
- pagamento;
- moeda premium;
- ganho de créditos;
- recompensa de partida;
- daily reward;
- battle pass;
- marketplace;
- trading;
- gifting;
- refund;
- upload de assets pelo browser;
- edição administrativa do bucket pela storefront;
- descoberta automática de produtos baseada somente em pastas do R2.

Qualquer uma dessas funcionalidades aparecendo como ativa nesta entrega sem SPEC adicional é regressão.

## Gate de conclusão

A entrega econômica só pode ser considerada pronta quando:

- todos os BLOCKERs acima estiverem verdes;
- wallet real substituir o estado `unavailable` no Profile;
- storefront real substituir a fixture/estado `unavailable` da Intendência;
- usuários novos e existentes tiverem saldo real `0`;
- defaults estiverem possuídos/equipados;
- catálogo anunciado vier do PostgreSQL e não de lista hardcoded no frontend;
- baseline registrado de Exército, Lanças, Viking, Gato, Cachorro e Futebol estiver anunciado e não adquirível;
- `ASSET_STORAGE_URL` for a única configuração de conexão S3/R2;
- Secret Access Key e `ASSET_STORAGE_URL` original/completa não forem expostos ao browser, DTO, logs ou snapshots persistentes; Access Key ID em `X-Amz-Credential` de URL SigV4 presigned é permitido;
- todos os dados do storage forem WebP com object key `.webp` e MIME `image/webp`;
- nenhum dado de runtime vindo do storage usar SVG ou outro formato;
- os 21 assets de dados do baseline forem validados antes do cutover;
- referências físicas forem object keys estáveis e URLs presigned forem somente transporte efêmero;
- browser carregar assets R2 sob demanda sem bulk-load do catálogo;
- partida utilizar snapshot cosmético congelado por object key WebP/referência persistente;
- nenhuma regra competitiva tiver sido alterada;
- nenhum endpoint de compra/recompensa/grant econômico tiver sido introduzido;
- migrations passarem em banco limpo e upgrade.
