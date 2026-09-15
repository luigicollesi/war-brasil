# SPEC — Economia V2, Loja e Cosméticos

## Autoridade do documento

Este documento é a fonte autoritativa do WAR Brasil para:

- moeda e saldo persistente;
- ledger econômico;
- catálogo de cosméticos e conjuntos;
- ofertas comerciais e preços em moeda do jogo;
- compras com `campaign-credit`;
- catálogo demonstrativo de pacotes de créditos em BRL;
- ownership de cosméticos;
- loadout cosmético;
- Intendência enquanto storefront;
- storage e entrega de assets cosméticos;
- integração dos cosméticos com partidas, dados e territórios.

Outros SPECs MUST referenciar este documento em vez de redefinir moeda, saldo, preço, oferta, compra, ledger, catálogo, storage, inventário, loadout ou aquisição.

O domínio de títulos cosméticos textuais do comandante continua pertencendo a `docs/pre-game/profile/SPEC.md` e não faz parte dos quatro slots jogáveis definidos aqui.

## Objetivo da Economy V2

A Economy V2 evolui a fundação persistente existente para uma loja funcional com moeda do jogo, mantendo dinheiro real fora do runtime transacional desta entrega.

Ela MUST permitir:

- cada comandante autenticado possuir uma carteira real de `campaign-credit`;
- saldo inicial persistente exatamente `0`;
- nenhuma fonte normal de ganho de créditos nesta entrega;
- compras reais de cosméticos usando somente `campaign-credit`;
- preços e ofertas definidos pelo banco, nunca pelo frontend;
- ledger auditável para todo débito de compra;
- recibo persistente de cada compra confirmada;
- inventário persistente por item individual;
- quatro slots cosméticos independentes e equipagem persistente;
- conjuntos e ofertas dirigidos pelo PostgreSQL, sem allowlist temática no React;
- assets de dados obtidos do object storage exclusivamente em WebP;
- exposição de pacotes de créditos com valor em BRL apenas como catálogo visual não adquirível;
- propagação segura do loadout para partidas futuras.

Nesta entrega:

- `campaign-credit -> cosmético` MUST funcionar;
- `BRL -> campaign-credit` MUST NOT funcionar;
- vitória, derrota, login, cadastro, tempo de jogo, evento ou navegação MUST NOT conceder créditos;
- não existe endpoint público de grant, reward, transferência ou alteração arbitrária de saldo.

## Princípios estruturais

### Item é ownership; conjunto é apresentação; offer é comércio

As três responsabilidades MUST permanecer separadas:

- `catalog.cosmetics` define itens cosméticos individuais;
- `catalog.cosmetic_sets` agrupa itens para apresentação e marketing;
- `catalog.offers` define o que pode ser comprado e por qual preço.

Ownership e equipagem MUST ocorrer por cosmético individual.

Comprar uma offer que contenha vários cosméticos MUST conceder os itens individualmente em `inventory.cosmetics`.

Um conjunto MUST NOT representar ownership e MUST NOT ser usado como substituto de offer.

O sistema MUST continuar permitindo combinações independentes como:

- ataque Viking;
- defesa Gato;
- neutro Futebol;
- efeito territorial Azulejo.

### Banco é autoridade; object storage é bytes

PostgreSQL MUST ser a fonte de verdade para:

- moedas;
- saldo;
- ledger;
- cosméticos;
- conjuntos;
- offers;
- preço;
- composição das offers;
- pacotes de créditos demonstrativos;
- status comercial;
- ordem de apresentação;
- ownership;
- loadout;
- recibos de compra.

Cloudflare R2 MUST ser tratado somente como fonte física dos assets.

A storefront MUST NOT usar `ListObjects` ou equivalente para descobrir produtos durante request normal.

A existência de arquivos no bucket MUST NOT tornar automaticamente um item, conjunto ou offer visível.

### Cosmético nunca altera gameplay

Cosméticos MUST NOT alterar RNG, resultado de dados, distribuição probabilística, balanceamento adaptativo, física, collider, regras de combate, hitbox, seleção de território, tropas, ordem de turno ou qualquer regra competitiva.

A camada econômica é estritamente visual.

## Domínios e fontes de verdade

As responsabilidades MUST permanecer separadas:

- `auth.*` — identidade autenticada e sessão;
- `profile.*` — identidade pública e loadout equipado;
- `economy.*` — moedas, wallets, ledger e compras confirmadas;
- `catalog.*` — cosméticos, conjuntos, offers, pacotes demonstrativos e referências de assets;
- `inventory.*` — ownership de cosméticos por usuário;
- `game.*` — snapshot cosmético congelado para a partida;
- Cloudflare R2 — bytes dos assets referenciados pelo catálogo.

MUST NOT existir saldo autoritativo duplicado em `profile.*`, `game.*` ou estado do cliente.

MUST NOT existir ownership autoritativo inferido do loadout.

MUST NOT existir preço, desconto, composição de offer ou aquisição autoritativos definidos somente no frontend.

## Moeda e wallet

A Economy V2 possui uma única moeda ativa de gameplay/comércio:

- ID: `campaign-credit`;
- nome: `Créditos de Campanha`;
- representação visual canônica: `/coin.svg`, proveniente de `public/coin.svg`;
- saldo inicial: `0`.

O glyph textual `◈` MAY permanecer em schema/contratos legados como fallback semântico ou de compatibilidade, mas MUST NOT ser tratado como a identidade visual principal da moeda nas superfícies V2/V4.

Valores monetários MUST ser inteiros. `economy.wallets.balance` MUST continuar impedido de ficar negativo por constraint.

Todo comandante autenticado MUST possuir uma wallet persistente para `campaign-credit`.

Um saldo `0` representa valor real consultado da fonte persistente e MUST NOT ser usado como fallback para indisponibilidade.

### Representação visual canônica da moeda

`public/coin.svg` é o asset estrutural canônico para representar `campaign-credit` na UI.

A aplicação MUST utilizar `/coin.svg` junto ao valor numérico em superfícies visuais de moeda, incluindo:

- saldo da wallet;
- preço de offer em `campaign-credit`;
- quantidade de créditos em `credit_packs`;
- feedback visual de débito/aquisição quando a moeda for mostrada.

`coin.svg`:

- MUST permanecer um asset local estável servido pela aplicação;
- MUST NOT depender de Cloudflare R2, presigned URL ou catálogo cosmético;
- MUST NOT ser persistido por usuário, inventário ou loadout;
- MUST NOT ser tratado como cosmético;
- MUST ser reutilizado como a mesma identidade visual em Profile, Arsenal, Intendência e futuras superfícies econômicas.

O caminho `/coin.svg` é convenção estrutural de UI e não precisa ser enviado em cada DTO econômico. O backend continua enviando valores e identidade monetária autoritativos; a camada de apresentação associa `campaign-credit` ao asset local canônico.

O valor monetário MUST permanecer legível textualmente. O ícone não pode ser a única forma de comunicar saldo ou preço. Quando o SVG for puramente decorativo ao lado de texto equivalente, SHOULD ser ocultado da árvore acessível; quando carregar nome de moeda, MUST possuir nome acessível equivalente a `Créditos de Campanha`.

## Fontes de crédito

Nesta entrega nenhuma ação normal concede créditos.

MUST NOT conceder créditos por:

- cadastro;
- login;
- vitória;
- derrota;
- participação;
- tempo de jogo;
- evento;
- daily reward;
- missão;
- anúncio;
- abertura da loja.

Testes e ferramentas administrativas MAY preparar saldo diretamente em ambiente controlado, mas isso MUST NOT introduzir endpoint público de grant nem ser reutilizado pelo browser de produção.

## Ledger

`economy.ledger_entries` passa a ser parte ativa da Economy V2.

Toda alteração de saldo realizada pela aplicação MUST possuir entrada correspondente no ledger e ocorrer na mesma transação PostgreSQL.

Compra confirmada MUST criar exatamente um débito com:

- usuário;
- `campaign-credit`;
- `delta < 0` igual ao preço efetivamente pago;
- razão `purchase` ou equivalente estável;
- referência para o recibo de compra;
- chave de idempotência interna ou referência única suficiente para impedir duplicação;
- timestamp.

Equipagem, preview, abertura de página e consulta de catálogo MUST NOT criar ledger.

Ledger é append-only do ponto de vista da aplicação normal. O browser MUST NOT possuir API para inserir, atualizar ou remover lançamentos.

## Quatro slots cosméticos

O loadout possui exatamente quatro slots:

1. `dice_attack` — dado ofensivo;
2. `dice_defense` — dado defensivo;
3. `dice_neutral` — iniciativa e rolagens neutras;
4. `territory_effect` — acabamento visual dos territórios controlados pelo jogador.

Os slots são independentes.

O backend MUST validar ownership e compatibilidade do slot em toda equipagem.

## Cosméticos padrão

Todo comandante MUST possuir e começar com os quatro defaults equipados:

- `dice.attack.default`;
- `dice.defense.default`;
- `dice.neutral.default`;
- `territory.effect.default`.

Os defaults MUST permanecer gratuitos, sempre possuídos e nunca depender de offer comercial.

Os dados padrão utilizam:

```text
cosmetics/dice/default/attack.webp
cosmetics/dice/default/defense.webp
cosmetics/dice/default/neutral.webp
```

Defaults MUST continuar servindo como fallback seguro para estado legado/incompleto.

## Catálogo de cosméticos

Cada cosmético SHOULD possuir ao menos:

- ID estável;
- slug público;
- nome;
- descrição;
- slot;
- raridade opcional;
- `asset_ref` persistente quando aplicável;
- `preview_ref` opcional;
- `effect_key` quando aplicável;
- status;
- indicador de default;
- timestamps.

IDs de catálogo MUST permanecer independentes das object keys físicas.

Para dados, `asset_ref` MUST apontar para object key WebP válida e MUST NOT persistir URL presigned.

### Status de cosmético

O catálogo de cosméticos mantém:

- `draft` — interno;
- `announced` — pode aparecer como novidade, mas não é elegível para nova aquisição;
- `available` — elegível para aquisição quando fizer parte de offer `available`;
- `retired` — não elegível para novas aquisições, preservado para ownership e snapshots existentes.

Item `available` sem offer ativa MUST NOT ser comprável por inferência.

Item `retired` MUST continuar equipável para quem já o possui, salvo regra futura explícita em contrário.

## Conjuntos

`catalog.cosmetic_sets` continua sendo agrupamento de apresentação.

Um conjunto SHOULD possuir:

- ID estável;
- slug público;
- `storage_slug` quando aplicável;
- nome;
- descrição;
- status;
- ordem de apresentação;
- preview opcional;
- timestamps.

Um conjunto:

- referencia cosméticos em ordem de apresentação;
- não possui saldo;
- não possui ownership;
- não define preço;
- não concede itens por si só.

A UI MUST renderizar conjuntos retornados pelo backend e MUST NOT possuir branch temática por slug conhecido.

## Offers comerciais

A Economy V2 introduz `catalog.offers` como unidade comercial autoritativa.

Uma offer MUST possuir ao menos:

- `id` estável;
- `slug` público;
- `name`;
- descrição opcional;
- `currency_code`;
- `price` inteiro positivo;
- `status`;
- indicador de destaque opcional;
- posição/ordem de apresentação;
- timestamps.

Status de offer:

- `draft` — não exibida para compra;
- `available` — exibida e comprável;
- `retired` — indisponível para nova compra, preservando recibos históricos.

A única moeda aceita pelas offers desta entrega é `campaign-credit`.

O frontend MUST exibir o preço retornado pelo backend acompanhado da representação visual `/coin.svg` e MUST NOT calcular, inferir ou sobrescrever preço.

O SPEC não fixa valores comerciais numéricos dos produtos. Preços de produção são dados de catálogo e podem ser alterados sem rebuild do frontend. Todo offer `available` MUST, porém, possuir preço inteiro positivo persistido.

## Composição de offer

`catalog.offer_items` relaciona offers a cosméticos individuais.

Uma offer MUST conter ao menos um cosmético.

A composição retornada pelo servidor é autoritativa. O browser MUST NOT enviar a lista de itens que deseja receber.

O baseline comercial SHOULD vender cada coleção de dados como bundle dos três slots de dado correspondentes:

- ataque;
- defesa;
- neutro.

Depois da compra, ownership continua individual e a equipagem dos três itens continua independente.

A arquitetura MUST permitir offers futuras de item único ou bundles diferentes sem alteração de schema de ownership.

## Ownership parcial de uma offer

Para uma offer de `N` itens:

- `0/N` possuídos: compra normal disponível;
- `N/N` possuídos: compra MUST ser bloqueada como já possuída;
- `1..N-1/N` possuídos: compra MAY prosseguir pelo preço integral da offer e MUST conceder somente itens ainda ausentes.

Nesta versão não existe desconto proporcional, crédito de volta ou preço dinâmico por ownership parcial.

A UI MUST conseguir informar ownership parcial quando aplicável.

## Compras confirmadas

A Economy V2 introduz `economy.purchases` como recibo persistente de compra confirmada.

Cada compra MUST registrar ao menos:

- ID estável do receipt;
- `user_id` derivado da sessão;
- `offer_id`;
- `currency_code` efetivamente usada;
- `price_paid` inteiro;
- `idempotency_key` fornecida para a operação;
- timestamp.

`price_paid` MUST registrar o preço no momento da compra. Alterar posteriormente `catalog.offers.price` MUST NOT modificar recibos históricos.

A combinação necessária para tornar retries idempotentes MUST possuir constraint única no banco. No baseline, `(user_id, idempotency_key)` SHOULD ser única.

Somente compras confirmadas criam rows em `economy.purchases`.

## Fluxo transacional de compra

O fluxo autoritativo MUST ocorrer server-side em uma única transação PostgreSQL:

```text
BEGIN
  autenticar session.user.id
  validar payload e idempotency key
  resolver offer e composição pelo banco
  validar offer available
  validar cosméticos elegíveis
  lock da wallet do usuário para campaign-credit
  resolver ownership atual
  rejeitar offer totalmente possuída
  validar balance >= price
  criar receipt de compra
  debitar wallet exatamente por price
  criar ledger de débito
  inserir apenas ownerships ausentes
COMMIT
```

Qualquer falha MUST executar rollback de wallet, ledger, purchase e inventory.

A ordem interna MAY variar para acomodar constraints/idempotência, desde que os invariantes finais sejam preservados.

## Idempotência

A API de compra MUST exigir `idempotencyKey` não vazia e com formato/tamanho validados.

Repetir a mesma operação com o mesmo usuário e a mesma `idempotencyKey` MUST:

- retornar semanticamente o mesmo resultado confirmado quando a compra anterior já foi concluída;
- não criar segundo débito;
- não criar segundo receipt;
- não duplicar ownership;
- não criar ledger duplicado.

Uma mesma chave usada por usuários diferentes não pode transferir autoridade entre contas.

## Concorrência

Wallet MUST ser serializada com lock transacional ou mecanismo equivalente que impeça gasto concorrente acima do saldo.

Exemplo obrigatório:

```text
saldo inicial = 500
offer A = 400
offer B = 400
```

Duas compras concorrentes não podem resultar em saldo negativo nem em dois débitos confirmados. Uma operação pode concluir e a outra deve observar o saldo restante e falhar por saldo insuficiente.

Concorrência também MUST preservar unicidade de receipts idempotentes e ownership.

## API de compra

A superfície HTTP planejada é:

```http
POST /api/economy/purchases
```

Payload mínimo:

```json
{
  "offerId": "offer.viking",
  "idempotencyKey": "<client-generated-id>"
}
```

O payload MUST NOT aceitar `userId`, `price`, `currency`, `balance`, `cosmeticIds` ou qualquer outro campo que torne o browser autoridade econômica.

Resposta bem-sucedida SHOULD conter somente o necessário para atualizar a UI, por exemplo:

- `purchaseId`;
- wallet autoritativa atualizada;
- itens recém-adquiridos;
- estado comercial necessário para a offer afetada.

A API MUST possuir erros distintos e seguros para, no mínimo:

- payload inválido;
- offer inexistente;
- offer indisponível;
- offer já integralmente possuída;
- saldo insuficiente;
- inconsistência interna de catálogo.

Mensagens não podem expor SQL, connection strings, secrets ou detalhes internos sensíveis.

## Storefront DTO V2

O snapshot da loja MUST permitir renderizar a experiência sem regras comerciais hardcoded no cliente.

Ele SHOULD projetar semanticamente:

- wallet;
- loadout;
- ownership necessário ao usuário atual;
- conjuntos;
- offers e sua composição/apresentação;
- estado derivado de ownership da offer;
- pacotes demonstrativos de créditos.

O DTO MAY projetar URLs de entrega efêmeras para assets, mas MUST manter object key/segredo fora do contrato público quando não forem necessários.

O caminho `/coin.svg` MUST NOT precisar ser duplicado em cada payload monetário: ele é um asset estrutural estável associado no frontend ao `currency_code='campaign-credit'`.

O cliente MAY fazer optimistic presentation apenas quando reversível; saldo, ownership e compra confirmada MUST ser reconciliados pela resposta autoritativa do servidor.

## Pacotes de créditos em BRL

A Economy V2 MAY manter `catalog.credit_packs` para apresentar futuramente compra de créditos com dinheiro real.

Cada pack SHOULD possuir:

- ID estável;
- slug;
- quantidade inteira positiva de `campaign-credit`;
- `price_brl_cents` inteiro positivo;
- status;
- ordem de apresentação;
- timestamps.

Status inicial da entrega MUST ser não adquirível, por exemplo `announced`.

A UI MAY mostrar:

- quantidade de créditos acompanhada por `/coin.svg`;
- preço formatado em BRL derivado de `price_brl_cents`;
- estado `EM BREVE` ou equivalente.

Nesta entrega MUST NOT existir:

- checkout funcional;
- integração Stripe, Mercado Pago ou outro PSP;
- endpoint que converta BRL em créditos;
- webhook de pagamento;
- geração de saldo após clicar em pack;
- simulação falsa de compra aprovada.

Os valores de BRL são dados de catálogo, não constantes React. Este SPEC não fixa os preços comerciais numéricos dos packs.

## Inventário

`inventory.cosmetics` permanece a única autoridade de ownership jogável.

Ownership MUST ser único por usuário/item.

Compra MUST inserir somente itens ausentes e usar `acquisition_source='purchase'` ou equivalente estável.

O browser MUST NOT possuir endpoint de grant arbitrário.

Remover ou aposentar offer/set MUST NOT apagar ownership existente.

## Loadout

Toda equipagem MUST:

- exigir sessão;
- derivar ator de `session.user.id`;
- validar ownership server-side;
- validar slot;
- preservar os outros três slots;
- não alterar wallet;
- não criar ledger;
- ser idempotente ao reequipar o mesmo item.

Item comprado deve poder ser equipado imediatamente após a compra quando seu status permitir.

## Conexão com object storage

A aplicação MUST utilizar uma única variável server-only para conectar ao bucket:

`ASSET_STORAGE_URL`

Formato canônico:

```text
s3://<ACCESS_KEY_ID>:<SECRET_ACCESS_KEY>@<ACCOUNT_ID>.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto
```

A aplicação MUST derivar internamente Access Key ID, Secret Access Key, endpoint HTTPS, bucket e região.

MUST NOT criar aliases públicos ou `NEXT_PUBLIC_*` equivalentes.

A connection string e o Secret Access Key MUST NOT aparecer em browser bundle, HTML, DTOs, logs, erros, banco ou evidências E2E.

`public/coin.svg` é explicitamente um asset estrutural local da aplicação e MUST NOT ser migrado para esse fluxo R2 apenas por representar moeda. A disponibilidade do ícone de moeda não pode depender de credenciais ou conectividade do object storage cosmético.

## Entrega de assets ao browser

Para objetos privados, o servidor SHOULD gerar GET presigned com expiração limitada ou outra URL de entrega controlada equivalente.

URL efêmera:

- MAY conter Access Key ID onde o protocolo SigV4 exigir;
- MUST NOT conter Secret Access Key;
- MUST NOT conter `ASSET_STORAGE_URL` original;
- MUST autorizar somente leitura do objeto necessário;
- MUST possuir expiração finita;
- MUST NOT ser persistida como identidade do cosmético.

Presigned URL é transporte. Object key é identidade persistente do asset.

## Formato obrigatório dos dados

Todo asset de dado servido do R2 MUST ser WebP.

Dentro de `cosmetics/dice/`, runtime aceita somente:

```text
cosmetics/dice/<storage_slug>/attack.webp
cosmetics/dice/<storage_slug>/defense.webp
cosmetics/dice/<storage_slug>/neutral.webp
```

`.svg`, `.png`, `.jpg`, `.jpeg` ou outra extensão MUST ser rejeitada para referências ativas desse namespace.

Objeto WebP MUST possuir `Content-Type: image/webp` e transparência quando exigida pelo design.

`preview.webp`, quando usado, é asset de storefront separado dos três assets de runtime.

## Catálogo dinâmico e previews

Frontend MUST NOT possuir lista hardcoded de Exército, Lanças, Viking, Gato, Cachorro, Futebol ou qualquer coleção futura.

Adicionar uma nova coleção/offer válida ao banco deve permitir sua apresentação sem alteração temática específica no componente React.

`preview_ref` SHOULD ser usado para thumbnail/hero quando existir. A ausência de preview dedicado MAY usar fallback derivado de item válido, sem transformar object storage em fonte de descoberta.

Falha de asset MUST produzir fallback visual seguro e MUST NOT alterar ownership, purchase, saldo ou gameplay.

## Snapshot de partida

Loadout efetivo MUST ser congelado no início da partida em `game.*`.

Alterar Profile/Arsenal durante uma partida MUST NOT alterar cosméticos da partida ativa.

Reconnect MUST resolver o mesmo cosmético persistente, podendo gerar nova URL de transporte efêmera.

Game snapshot MUST NOT expor wallet, ledger, histórico de compras ou inventário completo.

## Integração com dados e território

- iniciativa usa `dice_neutral` do jogador;
- atacante usa `dice_attack` do próprio jogador;
- defensor usa `dice_defense` do próprio jogador;
- efeito territorial usa `territory_effect` do proprietário.

Dois jogadores MAY usar cosméticos diferentes na mesma batalha.

Skin/effect MUST NOT alterar resultado autoritativo, física, collider, pips, hitbox ou interação do mapa.

## Segurança

Toda mutação econômica MUST seguir deny-by-default e autenticação server-side.

Browser nunca é autoridade para:

- saldo;
- preço;
- moeda da offer;
- status comercial;
- composição da offer;
- ownership;
- cosméticos concedidos;
- object key arbitrária;
- identidade do ator.

React components MUST NOT executar SQL nem instanciar cliente S3 com credenciais.

Route Handlers MUST trabalhar via service/repository boundary e DTO explícito.

## Migrações

Migrations econômicas MUST ser:

- forward-only;
- ordenadas;
- compatíveis com o runner atual;
- seguras em upgrade e banco limpo;
- sem reescrever migrations já aplicadas.

A migration da V2 SHOULD criar, conforme necessário:

- `catalog.offers`;
- `catalog.offer_items`;
- `economy.purchases`;
- `catalog.credit_packs`;
- constraints e índices correspondentes;
- seeds de offers/packs necessários para a storefront.

Dados V1 existentes de wallet, inventory, loadout, catalog e snapshots MUST ser preservados.

Nenhuma migration é necessária apenas para referenciar `/coin.svg`, salvo se implementação futura decidir remover um glyph textual legado do catálogo de moedas. A identidade visual canônica permanece responsabilidade da apresentação.

## Observabilidade

Falhas econômicas SHOULD possuir códigos estáveis para diagnóstico, sem secrets.

A aplicação SHOULD permitir distinguir em logs server-side, sem dados sensíveis:

- purchase confirmada;
- saldo insuficiente;
- offer indisponível;
- retry idempotente;
- rollback por erro interno.

Logs MUST NOT incluir connection strings, credentials, presigned URLs completas ou payloads sensíveis.

## Performance

A storefront SHOULD obter catálogo, offers e ownership em consultas previsíveis e evitar N+1 por item.

A compra MUST manter a seção crítica de lock da wallet curta.

Grid/preview SHOULD lazy-load assets fora do viewport e evitar baixar todos os WebPs de runtime apenas para mostrar thumbnails.

`coin.svg` SHOULD ser reaproveitado pelo cache normal de asset estático e não duplicado inline em cada card quando isso aumentar desnecessariamente o markup.

## Fora de escopo

Explicitamente fora de escopo nesta V2:

- qualquer método normal de ganhar `campaign-credit`;
- recompensas por partida;
- missões e daily rewards;
- gifting e transferência entre jogadores;
- marketplace entre usuários;
- descontos personalizados;
- preço proporcional a ownership parcial;
- refund automático;
- assinatura;
- checkout com dinheiro real;
- integração com PSP;
- webhook de pagamento;
- moeda premium adicional;
- vantagem competitiva comprável.

## Critério de conclusão

A Economy V2 só está pronta quando:

- compra com créditos é atômica, idempotente e concorrente-segura;
- preço exibido é o preço persistido da offer e usa `/coin.svg` como representação visual da moeda;
- wallet, preços e packs representam `campaign-credit` de forma consistente com `public/coin.svg`;
- saldo, ledger, receipt e inventory permanecem consistentes;
- itens comprados aparecem no Arsenal e podem ser equipados;
- catálogo continua dinâmico e orientado pelo banco;
- pacotes BRL são somente informativos e não alteram saldo;
- `coin.svg` permanece local e independente do R2 cosmético;
- R2 continua seguro e cosmético não altera gameplay;
- todos os BLOCKERs de `EVAL.md` estão verdes.
