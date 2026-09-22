# SPEC — Economia V2, Loja e Cosméticos

Status: **contrato pai reconciliado com Storefront V2**

## 1. Autoridade e documentos especializados

Este documento é a autoridade pai para os invariantes econômicos do WAR Brasil:

- `campaign-credit`, wallet e saldo;
- ledger e auditabilidade;
- autenticação/autorização da economia;
- ownership individual de cosméticos;
- loadout persistente;
- recibos e histórico de compra;
- pacotes de créditos em BRL enquanto catálogo não adquirível;
- regras gerais de segurança e object storage.

Os detalhes de catálogo e comércio da Storefront V2 são definidos por:

- `docs/economy/store/SPEC.md` — produtos, ofertas, coleções, bundles, completion pricing, pricing progressivo, campanhas, disponibilidade temporal, merchandising e integração R2 da loja;
- `docs/economy/territory-skins/SPEC.md` — renderização, recoloração e legibilidade de territory skins durante gameplay.

Esses documentos especializados prevalecem em seus respectivos domínios. Não existe mais regra pai que proíba compra individual de dados, imponha preço integral após ownership parcial, proíba pricing progressivo ou use `territory_effect` como slot canônico.

O domínio de títulos textuais do comandante continua pertencendo a `docs/pre-game/profile/SPEC.md` e não é um slot cosmético jogável.

## 2. Objetivo econômico

A Economy V2 fornece uma economia persistente e server-authoritative para cosméticos, mantendo aquisição de créditos com dinheiro real fora desta entrega.

Ela MUST garantir:

- uma wallet persistente por comandante para `campaign-credit`;
- saldo inicial exatamente `0`;
- nenhuma fonte normal de ganho de créditos nesta entrega;
- preços e disponibilidade determinados no servidor/banco;
- débito auditável no ledger;
- recibo persistente e snapshots suficientes para explicar o valor histórico pago;
- ownership por cosmético individual, nunca por bundle;
- loadout persistente por slot;
- catálogo extensível sem allowlists de temas no frontend;
- armazenamento de object keys, não URLs específicas de ambiente;
- storefront que possa vender dados e territory skins individualmente ou em bundles conforme o SPEC especializado.

## 3. Moeda e wallet

### 3.1 Moeda

A moeda funcional desta entrega é:

```text
campaign-credit
```

Nome de apresentação: `Créditos de Campanha`.

Todos os valores autoritativos são inteiros. Floating point não pode ser usado para dinheiro ou descontos no caminho de compra.

### 3.2 Saldo inicial

Todo comandante inicia com:

```text
0 campaign-credit
```

Vitória, derrota, cadastro, login, tempo de jogo, evento ou navegação não concedem créditos nesta entrega.

### 3.3 Servidor como autoridade

O browser nunca informa saldo final nem delta de wallet. O servidor deriva o débito a partir do preço autoritativo calculado dentro da transação.

O banco impede saldo negativo.

## 4. Ledger

Toda compra confirmada com custo positivo deve produzir exatamente um débito de ledger relacionado ao recibo da compra.

Invariantes:

- `delta = -price_paid`;
- moeda do ledger = moeda da wallet;
- nenhuma compra confirmada deixa wallet e ledger divergentes;
- uma falha transacional não deixa débito órfão;
- replay idempotente não cria segundo débito.

O ledger não substitui o recibo comercial: ambos têm responsabilidades distintas.

## 5. Cosméticos, ownership e slots

### 5.1 Slots canônicos

Os quatro slots iniciais são:

```text
dice_attack
dice_defense
dice_neutral
territory_skin
```

`territory_effect` é somente nomenclatura histórica de migrations anteriores e não deve ser introduzido em contratos/runtime novos.

### 5.2 Ownership

Ownership é persistido por cosmético individual.

Um usuário não pode possuir o mesmo cosmético duas vezes. Essa garantia deve existir por constraint no banco, não apenas por lógica de aplicação.

Bundles, produtos, ofertas, coleções e campanhas não são ownership entities.

### 5.3 Defaults

Cada slot possui fallback/default seguro. Defaults fazem parte do inventário inicial quando necessário para garantir loadout válido, mas não são produtos comerciais.

### 5.4 Equipagem

Um cosmético só pode ser equipado quando:

- pertence ao usuário;
- corresponde ao slot solicitado;
- está em estado equipável conforme o catálogo.

A constraint relacional deve impedir loadout apontando para cosmético incompatível ou não possuído.

## 6. Produto, oferta, coleção e campanha

A Storefront V2 separa explicitamente:

```text
cosmetic item -> entidade possuída/equipada
product       -> composição vendida (single ou bundle)
offer         -> disponibilidade comercial e pricing
collection    -> família temática persistente
campaign      -> apresentação/editorial temporária
```

A mesma cosmetic item pode participar de produto individual e bundle sem duplicar ownership.

Coleções podem ser:

- dice-only;
- territory-only;
- mistas.

Campanhas expiram sem remover ou recriar a coleção e seus cosméticos.

As regras completas são definidas em `docs/economy/store/SPEC.md`.

## 7. Pricing e compra

### 7.1 Pricing autoritativo

O preço mostrado no storefront é preview. A compra sempre recalcula preço dentro da transação.

O request inclui:

```json
{
  "offerId": "...",
  "idempotencyKey": "...",
  "expectedPrice": 1200
}
```

Se o preço recalculado diferir de `expectedPrice`, nenhuma mutação econômica é permitida e o servidor retorna conflito de preço, atualmente `409 ECONOMY_PRICE_CHANGED`.

### 7.2 Ownership parcial

Ownership parcial reduz preço de bundles/completion products.

Somente itens faltantes entram no subtotal. O desconto do bundle é aplicado sobre esse subtotal faltante com aritmética inteira conforme `docs/economy/store/SPEC.md`.

Não existe mais regra de “preço integral mesmo já possuindo parte do conjunto”.

### 7.3 Pricing progressivo

Pricing progressivo é permitido quando configurado explicitamente em tiers não sobrepostos.

O contador é por cosmetic item e avança somente para itens realmente concedidos. Compras concorrentes ao cruzar um tier devem ser serializadas de forma que preço obsoleto não seja silenciosamente consumido.

### 7.4 Disponibilidade temporal

`starts_at`, `ends_at` e `active` são validados pelo servidor. Countdown ou estado do CTA no browser é informativo e nunca torna uma oferta comprável.

### 7.5 Transação

Uma compra segue, conceitualmente:

1. inicia transação;
2. valida e trava estado relevante da oferta/produto;
3. lê ownership atual;
4. determina itens faltantes;
5. trava counters necessários em ordem estável;
6. calcula preços/tiers/subtotal/desconto;
7. compara `expectedPrice`;
8. valida wallet;
9. grava recibo/contexto comercial;
10. debita wallet e ledger;
11. concede apenas cosméticos faltantes;
12. avança counters somente para grants efetivos;
13. grava snapshots de preço por item;
14. commit.

Qualquer falha causa rollback integral.

## 8. Histórico e idempotência

Toda compra possui uma chave de idempotência por usuário.

Replay da mesma chave para a mesma compra retorna o resultado persistido sem novo débito, ownership ou counter.

Reuso da chave para operação incompatível gera conflito.

O histórico preserva pelo menos:

- oferta/produto adquirido;
- valor total pago;
- subtotal comercial aplicável;
- desconto aplicado;
- itens concedidos;
- preço unitário histórico dos itens concedidos.

Mudanças futuras no catálogo não reescrevem compras passadas.

## 9. Territory skins

`territory_skin` é um cosmético de primeira classe e usa o mesmo pipeline econômico dos demais slots.

Uma skin pode ser:

- descoberta no catálogo sem oferta comercial ativa;
- vendida por produto single;
- incluída em bundle/coleção mista;
- equipada independentemente dos dados.

A renderização deve continuar obedecendo `docs/economy/territory-skins/SPEC.md`: ownership color e estados de gameplay são semanticamente mais fortes que a camada cosmética.

## 10. Pacotes de créditos em BRL

`credit_packs` continuam exclusivamente demonstrativos nesta entrega.

A UI pode exibir:

- quantidade de Créditos de Campanha;
- preço em BRL;
- estado `EM BREVE`/equivalente.

Não pode existir nesta entrega:

- checkout real;
- webhook de pagamento;
- criação de ordem de pagamento;
- grant automático de créditos após pagamento;
- endpoint público para compra real de créditos.

## 11. Object storage / Cloudflare R2

### 11.1 Configuração server-only

Em produção Cloudflare, o Worker usa o binding `ASSET_STORAGE` como capability
direta para o R2 e não precisa de credenciais S3 no runtime.

As variáveis S3 permanecem server-only para desenvolvimento Node, validação e
tooling administrativo fora do Worker:

```text
ASSET_STORAGE_URL
ASSET_STORAGE_REGION=auto
ASSET_STORAGE_BUCKET
ASSET_STORAGE_ACCESS_KEY_ID
ASSET_STORAGE_SECRET_ACCESS_KEY
```

Nenhuma credencial pode usar prefixo público/client-side.

### 11.2 Isolamento de ambiente

Os ambientes devem usar buckets mutáveis distintos, por exemplo:

```text
dev  -> war-brasil-assets-dev
prod -> war-brasil-assets-prod
```

O bucket não é hardcoded como produção no contrato HTTPS moderno.

### 11.3 Object keys

PostgreSQL armazena object keys, por exemplo:

```text
cosmetics/dice/football/attack.webp
cosmetics/territory-skins/azulejo_brasil.webp
store/collections/football/banner.webp
```

Não armazena URL completa dependente de host/ambiente.

Runtime resolve objetos por chave exata. Catálogo, collection detail e render de partida não podem depender de `ListObjects` ou de inferência por diretórios do bucket.

### 11.4 Falha de asset

Asset remoto ausente ou inválido deve degradar para fallback visual seguro e logging acionável, sem quebrar wallet, ownership, compra ou demais itens da storefront.

## 12. Segurança

Endpoints econômicos mutáveis exigem usuário autenticado e proteção de origem conforme a infraestrutura de auth atual.

O cliente não é autoridade para:

- saldo;
- ownership;
- preço final;
- disponibilidade;
- tier;
- desconto;
- counters;
- grant;
- loadout de item não possuído.

Segredos do banco/R2/autenticação não entram em DTO, browser bundle ou mensagens de erro.

## 13. Migração e compatibilidade

A evolução de Economy V2 é forward-safe e aditiva sempre que possível.

Regras:

- migrations nunca são renumeradas retroativamente;
- nova migration usa número estritamente posterior ao maior existente;
- backfills preservam ownership e defaults válidos;
- destructive cleanup é postergado quando há dúvida de compatibilidade;
- nomenclatura histórica pode existir dentro de migrations antigas, mas runtime novo usa os contratos canônicos atuais.

A Storefront V2 introduz/evolui products, product items, collections, collection assets, pricing/counters, campaigns e territory-skin commerce conforme migrations específicas do repositório.

## 14. Não objetivos desta entrega

Fora de escopo:

- ganho normal de Créditos de Campanha;
- compra de créditos com dinheiro real;
- trading/gifting/resale;
- marketplace entre jogadores;
- NFT/tokenização;
- loot box;
- serialização de raridade por unidade;
- CMS administrativo completo;
- slots cosméticos além dos quatro definidos.

## 15. Critério de conclusão

A Economy V2 só pode ser considerada pronta para merge quando:

1. `docs/economy/EVAL.md` estiver verde;
2. todos os blockers de `docs/economy/store/EVAL.md` aplicáveis à Storefront V2 estiverem verdes;
3. `docs/economy/territory-skins/EVAL.md` continuar verde;
4. migrations forem verificadas contra a cadeia atual;
5. nenhuma regra documental contraditória permanecer;
6. qualquer verificação dependente de infraestrutura externa real (por exemplo R2 dev) possuir evidência autorizada antes do rollout.
