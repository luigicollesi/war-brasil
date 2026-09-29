---
name: catalog-store
description: >
  Use esta skill para adicionar, alterar ou revisar itens do catálogo/loja do WAR Brasil,
  dentro ou fora de collections. Cobre entidades de catálogo, cosmetic sets, collections,
  products, entitlements, offers, pricing, profile backgrounds, observabilidade,
  migrations e validação pós-alteração.
---

# Catalog & Store — WAR Brasil

## Objetivo

Adicionar conteúdo à loja sem confundir:

~~~text
entidade de catálogo -> o que pode ser possuído/equipado
product              -> composição comercial estável
offer                -> disponibilidade comercial
collection           -> família temática/editorial persistente
campaign             -> apresentação/promocional temporária
ownership            -> registro de posse do usuário
~~~

A mesma entidade pode participar de uma oferta individual, de um bundle, de uma promoção,
de uma recompensa ou de um passe sem duplicar ownership.

Use como autoridades, nesta ordem:

1. código/runtime atual;
2. `docs/economy/SPEC.md`;
3. `docs/economy/store/SPEC.md`;
4. migrations gerenciadas atuais;
5. banco alvo, quando a tarefa autorizar inspeção.

Não copie cegamente uma migration histórica: IDs, slugs, preços, lifecycle e relações podem
ter sido reconciliados depois.

## Quando usar

Use esta skill para:

- adicionar dados, territory skins ou outros cosméticos de gameplay;
- adicionar profile backgrounds;
- adicionar item individual fora de collection;
- criar ou ampliar uma collection;
- criar singles, bundles, offers ou promoções;
- alterar pricing fixo/progressivo;
- associar itens a collections;
- configurar `catalog.cosmetic_sets`;
- preparar migration de catálogo;
- validar catálogo/loja depois da alteração;
- diagnosticar item que existe no banco mas não aparece ou não pode ser comprado.

Não use esta skill para alterar regras de gameplay sem relação com catálogo, para frontend
puramente visual, ou para lançar comércio de commander titles sem requisito explícito.

## Invariantes de arquitetura

### Entidade, product e offer são coisas diferentes

Para cosmético gameplay:

~~~text
catalog.cosmetics
  -> catalog.cosmetic_pricing
  -> catalog.cosmetic_stats
  -> catalog.products
  -> catalog.product_items
  -> catalog.product_entitlements
  -> catalog.offers
  -> inventory.cosmetics
~~~

Para profile background:

~~~text
catalog.profile_backgrounds
  -> catalog.profile_background_pricing
  -> catalog.profile_background_stats
  -> catalog.products
  -> catalog.product_entitlements
  -> catalog.offers
  -> profile.commander_backgrounds
~~~

`catalog.product_entitlements` é a autoridade genérica do que a compra concede.

Para produtos de gameplay, mantenha também `catalog.product_items`, porque o storefront
de cosméticos usa essa composição. Enquanto o legado existir, espelhe a composição de
gameplay em `catalog.offer_items`.

Para profile backgrounds, não crie `product_items` ou `offer_items`: o produto é
representado pelo entitlement `profile_background`.

### Cosmetic set não é collection

`catalog.cosmetic_sets` é a identidade visual/canônica de um conjunto de dados.
`catalog.collections` é a identidade comercial/editorial da loja.

Flags como:

~~~text
dice_pip_dark
dice_pip_compact
~~~

pertencem a `catalog.cosmetic_sets`, nunca a `catalog.collections`.

Dados de um mesmo tema devem apontar para um set canônico via
`catalog.cosmetic_set_items`. Um dado não deve ser movido entre sets por efeito colateral
de uma alteração comercial.

### Collection assets não são itens possuíveis

Uma collection visível exige exatamente três assets editoriais ativos:

~~~text
banner
background
logo
~~~

em `catalog.collection_assets`.

O storefront exige exatamente um asset ativo de cada role e exatamente três ativos no total.
Ao substituir assets, desative os antigos antes de ativar os novos.

O `background` editorial pode usar o mesmo object key de um profile background equipável,
mas são entidades distintas:

~~~text
catalog.collection_assets(role='background')
!=
catalog.profile_backgrounds
~~~

## Decisão inicial

Antes de escrever SQL, classifique o conteúdo.

### 1. Item de gameplay dentro de collection

Exemplos: dado ou territory skin temático.

Necessário:

- `catalog.collections`, se a collection ainda não existir;
- `catalog.collection_assets` para banner/background/logo;
- `catalog.cosmetics.collection_id = collection.<slug>`;
- `catalog.cosmetic_assets`;
- `catalog.cosmetic_pricing`;
- `catalog.cosmetic_stats`;
- `catalog.products.collection_id = collection.<slug>`;
- `catalog.product_items`;
- `catalog.product_entitlements` com `game_cosmetic`;
- `catalog.offers`;
- `catalog.offer_items` enquanto o legado existir;
- `catalog.cosmetic_sets` + `catalog.cosmetic_set_items` para dados.

### 2. Item de gameplay fora de collection

Não crie collection artificial.

Use:

~~~text
catalog.cosmetics.collection_id = NULL
catalog.products.collection_id = NULL
~~~

e ainda configure:

- asset;
- pricing/stats;
- product;
- product_items;
- product_entitlements;
- offer;
- offer_items;
- `catalog.cosmetic_sets` + `catalog.cosmetic_set_items` quando o item for dado.

Estar fora de collection não remove a identidade visual do dado: ele continua pertencendo ao
seu set canônico. O item aparecerá pelas superfícies de offers/categorias, não como card de
collection.

### 3. Profile background dentro de collection

Crie a entidade em `catalog.profile_backgrounds` com:

~~~text
profile_backgrounds.collection_id = collection.<slug>
~~~

mas mantenha o produto individual comercialmente independente:

~~~text
products.collection_id = NULL
~~~

Isso é deliberado. O vínculo no background representa tema/requisito de desbloqueio;
`products.collection_id` representa lifecycle/promoção comercial da collection.

Depois configure:

- `catalog.profile_background_pricing`;
- `catalog.profile_background_stats`;
- product single;
- `catalog.product_entitlements(entitlement_kind='profile_background')`;
- offer single.

Não use `product_items` ou `offer_items` para background.

### 4. Profile background fora de collection

Use:

~~~text
profile_backgrounds.collection_id = NULL
products.collection_id = NULL
~~~

e configure pricing, stats, product, entitlement e offer normalmente.

Sem `collection_id`, não existe gate de completar collection.

### 5. Commander title

O schema suporta `commander_title` em `product_entitlements` e possui capacidade de pricing,
mas o catálogo atual não lançou commander titles como produtos pagos.

Não crie pricing/product/offer de title apenas por estar adicionando conteúdo ao catálogo.
Faça isso somente quando houver requisito explícito de lançar comércio de títulos.

## Collections

Uma collection deve ter identidade estável:

~~~text
catalog.collections
id                       collection.<slug>
slug                     <slug>
name                     nome público
description              descrição pública
active                   lifecycle editorial
sort_order               ordem
featured                 destaque
promotion_discount_bps   promoção da collection
~~~

`promotion_discount_bps` usa basis points:

~~~text
1000 = 10%
2000 = 20%
4000 = 40%
~~~

Produtos associados comercialmente à collection recebem esse desconto no quote autoritativo.

### Collection dice-only

Para três dados:

~~~text
3 entidades gameplay
3 single products
3 single offers
1 bundle product
1 bundle offer
~~~

Se houver profile background temático:

~~~text
+ 1 profile background entity
+ 1 background single product
+ 1 background single offer
~~~

Resultado típico: 4 entidades possuíveis, 5 products e 5 offers.

### Collection mista

Exemplo com três dados + territory skin + profile background:

~~~text
4 entidades gameplay
4 single products
4 single offers
1 gameplay bundle product
1 gameplay bundle offer
1 profile background entity
1 profile background product
1 profile background offer
~~~

Resultado típico: 5 entidades possuíveis, 6 products e 6 offers.

## Background de collection e gate

Um profile background com `collection_id` só pode ser comprado quando o usuário possuir
todos os cosméticos de gameplay da collection que estejam:

~~~text
is_default = FALSE
status IN ('announced', 'available')
~~~

O runtime retorna `ECONOMY_COLLECTION_INCOMPLETE` quando o requisito não está completo.

Por isso, no modelo atual, não coloque o background gated dentro do mesmo gameplay bundle
que completa a collection. O gate é validado antes dos grants e o bundle seria bloqueado.

Mantenha:

~~~text
bundle da collection -> cosméticos gameplay
background            -> oferta individual posterior
~~~

O produto do background continua com `products.collection_id = NULL`, então ele não herda
automaticamente `promotion_discount_bps` da collection e pode permanecer comercialmente
disponível mesmo quando a collection não está sendo promovida.

## Products, entitlements e offers

### Product

`catalog.products` descreve a composição vendida.

~~~text
product_type = single | bundle
bundle_discount_bps = 0 para single
~~~

Bundle não é item possuído. Ownership fica nos componentes concedidos.

### Entitlement

Para gameplay:

~~~text
entitlement_kind = game_cosmetic
cosmetic_id      = ...
~~~

Para background:

~~~text
entitlement_kind = profile_background
background_id    = ...
~~~

Não misture colunas de entitlement: o constraint exige a forma correta para cada kind.

### Offer

`catalog.offers` controla disponibilidade:

- `status`;
- `active`;
- `starts_at`;
- `ends_at`;
- `priority`;
- `is_featured`;
- moeda;
- product associado.

Uma entidade/product pode existir sem offer ativa.

O mesmo product pode receber novas offers futuras sem recriar a entidade ou ownership.

## Pricing autoritativo

Não trate `catalog.offers.price` como fonte autoritativa.

Para gameplay, o preço final é recalculado com:

~~~text
preço dos itens faltantes
-> bundle_discount_bps
-> collection.promotion_discount_bps
-> finalPrice
~~~

A fonte do preço unitário é:

- `catalog.cosmetic_pricing` para gameplay;
- `catalog.profile_background_pricing` para background;
- tiers quando o modelo for `progressive`.

`offers.price` deve permanecer coerente como valor de catálogo/compatibilidade, mas o
servidor recalcula o quote dentro da transação.

Ownership parcial reduz o subtotal de bundles. Não cobre itens já possuídos novamente.

A compra usa:

~~~text
offerId
idempotencyKey
expectedPrice
~~~

e deve falhar sem mutação em caso de `ECONOMY_PRICE_CHANGED`.

## Assets e object storage

Grave object keys, nunca URL completa de CDN, nas tabelas de catálogo.

Padrões atuais relevantes:

~~~text
cosmetics/dice/<storage-slug>/attack.webp
cosmetics/dice/<storage-slug>/defense.webp
cosmetics/dice/<storage-slug>/neutral.webp

cosmetics/territory-skins/<slug>.webp

store/collections/<slug>/banner.webp
store/collections/<slug>/background.webp
store/collections/<slug>/logo.webp
~~~

Respeite constraints atuais do schema. Não invente underscore/hífen ou alias histórico sem
verificar o padrão permitido.

## Observabilidade e auditabilidade

A observabilidade econômica persistente é baseada em:

~~~text
economy.purchases
economy.purchase_items
economy.purchase_entitlements
economy.ledger_entries
~~~

Uma compra deve preservar, conforme o fluxo atual:

- `offer_id`;
- `product_id`;
- `price_paid`;
- `subtotal_price`;
- `discount_bps`;
- `promotion_discount_bps`;
- preços unitários dos grants;
- entitlement kind/ID;
- ledger de débito;
- idempotency key.

Nunca edite histórico de compra/ledger para "corrigir catálogo". Corrija catálogo por migration
forward e preserve recibos históricos.

O runtime atual possui forte auditabilidade no banco, mas a telemetria operacional genérica
de Economy é mais limitada que a de subsistemas como Battle Pass. Uma simples adição de rows
não exige inventar eventos novos. Se a tarefa criar um novo fluxo, novo erro ou novo boundary
de compra, adicione observabilidade estruturada coerente com os módulos existentes, contendo
somente IDs/contexto não sensível necessários, por exemplo:

~~~text
offerId
productId
collectionId
expectedPrice
authoritativePrice
purchaseId
result
errorCode
durationMs
~~~

Para gates de background, também é útil:

~~~text
backgroundId
ownedCount
requiredCount
~~~

Não logue secrets, tokens ou payloads sensíveis.

## Migration e convergência

Siga `AGENTS.md`.

Para alterações persistentes de catálogo:

1. determine a próxima migration gerenciada no momento da tarefa;
2. use `src/lib/db/migrations/managed/NNN-description.sql`;
3. inclua `-- Up Migration`;
4. prefira forward-only quando apagar histórico/ownership seria inseguro;
5. use operações idempotentes quando houver chance de hotfix prévio;
6. use `ON CONFLICT ... DO UPDATE` quando a migration precisa convergir estado existente;
7. não escreva em `ops.pgmigrations` dentro da migration;
8. se uma alteração mudar o schema, mantenha `src/lib/db/schema.sql` alinhado;
9. se for apenas conteúdo/rows, não altere schema sem necessidade.

Hotfix direto em banco é excepcional. Se for explicitamente autorizado, ainda deve existir
uma migration source-managed idempotente que represente o estado desejado. Não finja que o
runner executou uma migration apenas inserindo manualmente seu nome em `ops.pgmigrations`.

Antes da próxima migration, compare ledger de migrations e estrutura/dados físicos quando
houver suspeita de drift.

## Convenções de IDs

Prefira IDs estáveis e semanticamente separados:

~~~text
collection.<slug>
set.<slug>

dice.attack.<slug>
dice.defense.<slug>
dice.neutral.<slug>
territory.effect.<slug>

profile.background.<slug>

product.single.<entity-id>
product.<slug>

offer.single.<entity-id>
offer.<slug>
~~~

Não renomeie uma entidade existente apenas para deixar IDs "mais bonitos". IDs históricos
podem ser referenciados por inventory, receipts, rewards ou profiles.

## Receita: nova collection com dados

Ordem recomendada:

1. collection;
2. três collection assets;
3. entidades de dados;
4. cosmetic assets;
5. cosmetic set;
6. cosmetic set items;
7. pricing;
8. stats;
9. single products;
10. single product_items;
11. single product_entitlements;
12. single offers;
13. single offer_items;
14. bundle product;
15. bundle product_items;
16. bundle product_entitlements;
17. bundle offer;
18. bundle offer_items;
19. profile background, se existir;
20. background pricing/stats;
21. background product;
22. background entitlement;
23. background offer.

Para territory skin, insira a entidade no mesmo fluxo de gameplay antes do bundle quando
ela fizer parte da collection.

## Receita: item standalone fora de collection

Para gameplay:

1. `catalog.cosmetics` com `collection_id=NULL`;
2. asset;
3. se for dado, criar/associar o `cosmetic_set` canônico e seu `cosmetic_set_item`;
4. pricing/stats;
5. product single com `collection_id=NULL`;
6. product_item;
7. product_entitlement;
8. offer;
9. offer_item.

Para background:

1. `catalog.profile_backgrounds` com `collection_id=NULL`;
2. pricing/stats;
3. product single com `collection_id=NULL`;
4. product_entitlement `profile_background`;
5. offer.

## Validação obrigatória

Depois da alteração, confirme no mínimo:

### Collection

- collection ativa quando deve aparecer;
- exatamente 3 `collection_assets` ativos;
- exatamente um banner, background e logo;
- cosméticos esperados apontam para a collection;
- nenhum item não relacionado foi associado acidentalmente.

### Dados

- trio aponta para o set correto;
- posições do set são determinísticas;
- `dice_pip_dark/compact` estão no set;
- asset refs respeitam o padrão WebP.

### Commerce

- todo item vendável possui pricing e stats;
- singles têm product, entitlement e offer;
- gameplay singles têm product_item;
- bundles contêm exatamente os componentes desejados;
- products de collection possuem o `collection_id` correto;
- background products mantêm `collection_id=NULL`;
- offer está `available/active` e dentro da janela temporal;
- `offers.price` não contradiz grosseiramente o quote esperado;
- nenhum default item foi tornado comprável.

### Background

- entidade existe em `profile_backgrounds`;
- asset/preview resolvem;
- pricing/stats existem;
- entitlement é `profile_background`;
- se pertencer a collection, o gate reflete somente os cosméticos gameplay válidos;
- não foi inserido no gameplay bundle gated.

### Auditoria

- purchase continua gravando receipt;
- snapshots comerciais continuam possíveis;
- grants escrevem ownership na tabela correta;
- debit gera ledger;
- nenhum SQL da migration altera recibos/ledger históricos.

## Verificações e testes

Antes de executar scripts, confira `package.json`.

Checks finitos úteis conforme o escopo:

~~~text
npm run test:compile
npm run test:run
npm run test:blackbox:db
npm run assets:validate
npm run lint
~~~

Prefira os testes focados de economy/store quando a alteração for só de catálogo.
Não inicie `npm run dev` ou outro servidor para validar.

Quando houver acesso ao banco alvo, faça também queries de integridade para conferir:

- collection -> assets -> entities;
- entity -> pricing/stats;
- product -> items/entitlements;
- offer -> product;
- background -> collection gate;
- ausência de órfãos e duplicações.

## Anti-padrões

Não:

- usar `catalog.collections` para flags visuais de dado;
- criar uma collection só para vender um item standalone;
- tratar bundle como entidade de inventory;
- duplicar cosmético para vender individual e em bundle;
- usar `offers.price` como única autoridade de preço;
- colocar profile background gated dentro do bundle que completa a própria collection;
- associar product de background à collection só para herdar promoção;
- criar `product_items`/`offer_items` para background;
- lançar commander title pago por acidente;
- armazenar URL CDN completa onde o schema espera object key;
- deixar mais de três collection assets ativos;
- apagar ownership, receipts ou ledger em down migration;
- escrever manualmente em `ops.pgmigrations`;
- copiar IDs/slugs de migrations históricas sem verificar o estado canônico atual.

## Referências internas

Consulte apenas quando necessário ao escopo:

- `docs/economy/SPEC.md`;
- `docs/economy/store/SPEC.md`;
- `src/lib/db/migrations/managed/063-profile-background-commerce.sql`;
- `src/lib/db/migrations/managed/064-profile-appearance-collections.sql`;
- `src/lib/db/migrations/managed/065-profile-background-collection-gates.sql`;
- `src/lib/db/migrations/managed/079-dice-pip-cosmetic-set-style.sql`;
- `src/lib/db/migrations/managed/080-gunslinger-dice-collection.sql`;
- `src/lib/server/economy/economy-storefront-repository.ts`;
- `src/lib/server/economy/storefront-quote-repository.ts`;
- `src/lib/server/economy/entitlement-repository.ts`;
- `src/lib/server/economy/economy-service.ts`.

Siga sempre `AGENTS.md` e preserve as autoridades atuais do runtime.
