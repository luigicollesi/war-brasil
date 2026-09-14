# SPEC — Economia, Loja e Cosméticos

## Autoridade do documento

Este documento é a fonte autoritativa do WAR Brasil para:

- moeda e saldo persistente;
- catálogo econômico;
- conjuntos anunciados na loja;
- storage de assets cosméticos;
- ownership de cosméticos;
- loadout cosmético;
- Intendência enquanto storefront;
- integração dos cosméticos com partida, dados e territórios.

Outros SPECs MUST referenciar este documento em vez de redefinir regras de moeda, saldo, catálogo, storage, inventário, loadout, aquisição ou compra.

O domínio de títulos cosméticos textuais do comandante continua pertencendo a `docs/pre-game/profile/SPEC.md` e não faz parte dos quatro slots definidos aqui.

## Objetivo da primeira entrega

A primeira entrega cria uma economia real, persistente e propositalmente inerte, com catálogo de loja orientado pelo PostgreSQL e assets físicos armazenados em object storage S3-compatible.

Ela MUST permitir:

- cada usuário possuir uma carteira real;
- saldo inicial real de `0`;
- nenhum método de ganhar dinheiro nesta etapa;
- nenhum método de gastar dinheiro nesta etapa;
- nenhum fluxo de compra nesta etapa;
- inventário persistente;
- quatro slots cosméticos independentes;
- equipagem persistente dos cosméticos possuídos;
- catálogo de conjuntos dirigido pelo banco, sem lista hardcoded no frontend;
- assets de dados obtidos do object storage;
- acesso à loja pela experiência de Profile/Intendência;
- propagação segura do loadout para partidas futuras.

A ausência de compra é requisito de produto desta versão, não uma indisponibilidade técnica a ser simulada.

## Princípios estruturais

### Item é ownership; conjunto é apresentação

Um conjunto é agrupamento de catálogo e marketing.

Ownership e equipagem MUST ocorrer por item individual.

O sistema MUST permitir combinações como:

- ataque Exército;
- defesa Lanças;
- neutro padrão;
- efeito territorial padrão.

Equipar um item de um conjunto MUST NOT exigir equipar os demais itens do mesmo conjunto.

### Banco é catálogo; object storage é bytes

O PostgreSQL MUST continuar sendo a fonte de verdade de:

- quais conjuntos existem;
- nome e descrição promocional;
- slug público;
- slug/prefixo físico do storage;
- status do catálogo;
- ordem de apresentação;
- quais itens pertencem ao conjunto;
- ownership;
- loadout.

O object storage MUST ser tratado somente como fonte física dos arquivos.

A storefront MUST NOT usar `ListObjects` ou equivalente para descobrir produtos durante uma request normal.

A existência de uma pasta no bucket MUST NOT, sozinha, tornar um conjunto visível na loja.

Um conjunto só pode aparecer quando existir como registro de catálogo com status compatível com storefront.

### Cosmético nunca altera gameplay

Cosméticos MUST NOT alterar:

- RNG;
- resultado de dados;
- distribuição probabilística;
- balanceamento adaptativo;
- colisão ou física dos dados;
- regras de combate;
- hitbox de território;
- seleção de território;
- número de tropas;
- ordem de turno;
- qualquer regra competitiva.

A camada econômica é estritamente visual nesta versão.

## Domínios e fontes de verdade

As responsabilidades MUST permanecer separadas:

- `auth.*` — identidade autenticada e sessão;
- `profile.*` — identidade pública e loadout equipado;
- `economy.*` — moedas, saldos e razão de movimentações;
- `catalog.*` — definições dos cosméticos, conjuntos e referências físicas de assets;
- `inventory.*` — ownership de cosméticos por usuário;
- `game.*` — snapshot cosmético congelado para uma partida;
- Cloudflare R2 — bytes dos assets referenciados pelo catálogo.

Não é necessário criar um domínio `store.*` duplicando catálogo nesta entrega. Metadados de apresentação e relacionamento de conjuntos permanecem em `catalog.*`.

MUST NOT existir saldo autoritativo duplicado em `profile.*`, `game.*` ou estado do cliente.

MUST NOT existir ownership autoritativo inferido a partir do loadout.

MUST NOT existir preço ou aquisição autoritativos definidos somente no frontend.

## Conexão com object storage

A aplicação MUST utilizar uma única variável de ambiente server-only para conectar ao bucket de assets:

`ASSET_STORAGE_URL`

O objetivo é reproduzir o modelo operacional de `DATABASE_URL`: uma connection string única contém tudo que o servidor precisa para criar o cliente S3.

Formato canônico da aplicação:

```text
s3://<ACCESS_KEY_ID>:<SECRET_ACCESS_KEY>@<ACCOUNT_ID>.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto
```

As credenciais MUST ser percent-encoded quando contiverem caracteres reservados de URL.

A aplicação MUST interpretar essa connection string e derivar internamente:

- Access Key ID;
- Secret Access Key;
- endpoint HTTPS `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`;
- bucket `war-brasil-assets-prod`;
- região S3, cujo valor esperado no R2 é `auto`.

A connection string `s3://` é um formato interno de configuração da aplicação. Ela MUST NOT ser enviada literalmente como URL HTTP para o Cloudflare.

Nesta entrega o runtime precisa somente de leitura dos objetos. A credencial de produção SHOULD ser limitada ao bucket necessário e ao menor conjunto de permissões possível, preferencialmente Object Read.

A aplicação MUST NOT exigir, para esta integração, variáveis adicionais como:

- `S3_ACCESS_KEY_ID`;
- `S3_SECRET_ACCESS_KEY`;
- `S3_BUCKET`;
- `S3_ENDPOINT`;
- `R2_ACCOUNT_ID`;
- `R2_ACCESS_KEY_ID`;
- `R2_SECRET_ACCESS_KEY`.

A única fonte de configuração da conexão do storage MUST ser `ASSET_STORAGE_URL`.

`ASSET_STORAGE_URL` MUST NOT:

- usar prefixo `NEXT_PUBLIC_`;
- entrar em bundle do browser;
- ser retornada por API/DTO;
- ser persistida em `catalog.*` ou `game.*`;
- ser escrita em logs;
- ser interpolada em mensagens de erro exibidas ao usuário;
- aparecer em snapshots de teste ou evidências E2E.

Ausência ou formato inválido de `ASSET_STORAGE_URL` em ambiente que exige assets remotos MUST produzir erro de configuração explícito no servidor, sem revelar credenciais.

## Entrega dos assets ao browser

O browser MUST NOT receber Access Key ID ou Secret Access Key.

Para objetos privados, o servidor SHOULD gerar URL S3 presigned de `GetObject` com expiração limitada e enviar somente essa URL derivada ao cliente quando o asset for necessário.

A URL presigned:

- MAY ser utilizada diretamente pelo browser para baixar o SVG do R2;
- MUST autorizar somente leitura do objeto solicitado;
- MUST possuir expiração finita;
- MUST NOT ser persistida como identidade do cosmético;
- MUST NOT substituir a object key no catálogo ou snapshot de partida.

Presigned URL é transporte efêmero. Object key é referência persistente.

Quando o browser acessar diretamente URL presigned, a configuração CORS do bucket MUST permitir somente as origens necessárias da aplicação.

## Moeda

A primeira versão possui uma única moeda ativa:

- ID: `campaign-credit`;
- nome: `Créditos de Campanha`;
- símbolo: `◈`;
- saldo inicial: `0`.

A aplicação de produção MUST NOT projetar uma segunda moeda enquanto não existir uma necessidade de produto aprovada no SPEC econômico.

`command-reserve` ou qualquer moeda premium existente apenas em fixtures anteriores MUST NOT ser tratada como moeda real desta entrega.

Valores monetários MUST ser armazenados como inteiros, nunca ponto flutuante.

Saldo MUST possuir constraint que impeça valor negativo.

## Estado inicial da carteira

Todo usuário autenticado com identidade de comandante MUST possuir carteira persistente.

Usuários novos MUST iniciar com:

`campaign-credit = 0`

Usuários existentes no momento da migration MUST receber exatamente o mesmo saldo inicial:

`campaign-credit = 0`

Nesta versão:

- vitória MUST NOT conceder créditos;
- derrota MUST NOT conceder créditos;
- login MUST NOT conceder créditos;
- criação de conta MUST NOT conceder bônus;
- tempo de jogo MUST NOT conceder créditos;
- anúncio ou evento MUST NOT conceder créditos;
- não existe endpoint público para conceder créditos;
- não existe endpoint público para gastar créditos.

Um saldo `0` após esta integração representa um valor real consultado de uma fonte persistente, e não indisponibilidade de backend.

## Ledger

A fundação econômica SHOULD manter ledger desde a primeira migration, mesmo que permaneça vazio nesta entrega.

Cada movimentação futura deverá comportar pelo menos:

- usuário;
- moeda;
- delta inteiro;
- razão/tipo;
- referência de domínio quando aplicável;
- chave de idempotência quando aplicável;
- timestamp.

Nesta entrega nenhuma ação normal da aplicação MUST criar movimentações.

Saldo e ledger futuros MUST ser modificados na mesma transação.

## Quatro slots cosméticos

O loadout possui exatamente quatro slots nesta entrega:

1. `dice_attack` — dado usado quando o jogador ataca;
2. `dice_defense` — dado usado quando o jogador defende;
3. `dice_neutral` — dado usado em iniciativa/rolagens neutras;
4. `territory_effect` — acabamento visual dos territórios controlados pelo jogador.

Os slots são independentes.

O backend MUST validar que o tipo do item corresponde ao slot solicitado.

Um item de `dice_defense`, por exemplo, MUST NOT poder ser equipado em `dice_attack`.

## Cosméticos padrão

Todo comandante MUST possuir e começar com os quatro cosméticos padrão equipados:

- `dice.attack.default`;
- `dice.defense.default`;
- `dice.neutral.default`;
- `territory.effect.default`.

Os três dados padrão utilizam a pasta física:

`cosmetics/dice/default/`

com:

- `attack.svg`;
- `defense.svg`;
- `neutral.svg`.

Os defaults MUST funcionar como fallback seguro quando um estado legado/incompleto for lido.

O usuário MUST NOT precisar comprar ou desbloquear os defaults.

Remover um item default do catálogo MUST ser proibido enquanto ele for fallback de runtime.

## Catálogo de cosméticos

Cada cosmético SHOULD possuir pelo menos:

- ID estável;
- slug público;
- nome;
- descrição;
- slot;
- raridade opcional;
- object key do asset quando aplicável;
- referência de preview própria para storefront quando aplicável;
- chave de efeito quando for territorial;
- status de catálogo;
- indicador de default;
- timestamps de auditoria.

IDs de catálogo MUST ser independentes da object key física.

Renomear ou mover um arquivo MUST NOT exigir alterar ownership histórico.

`asset_ref`, ou seu sucessor semântico, MUST representar uma object key/prefixo controlado pela aplicação, nunca uma URL contendo credenciais e nunca uma URL presigned persistida.

Exemplo válido:

`cosmetics/dice/viking/attack.svg`

### Status de catálogo

O baseline possui:

- `draft` — interno e não exibido;
- `announced` — visível como novidade, mas não adquirível;
- `available` — elegível para um fluxo futuro de aquisição;
- `retired` — não oferecido para novas aquisições, preservado para ownership existente.

`announced` MUST NOT ser interpretado como comprável.

`retired` MUST NOT remover o item de inventários existentes nem quebrar partidas históricas.

## Conjuntos e catálogo dinâmico

Conjuntos MUST ser modelados separadamente dos itens.

Um conjunto de dados SHOULD possuir pelo menos:

- ID estável;
- slug público;
- `storage_slug` ou prefixo físico equivalente;
- nome de marketing;
- descrição promocional;
- status;
- ordem de apresentação;
- preview opcional;
- timestamps.

Um conjunto:

- referencia zero ou mais itens em ordem de apresentação;
- não representa ownership por si só;
- não representa loadout por si só;
- MAY agrupar menos ou mais que quatro slots.

A UI MUST renderizar os conjuntos retornados pelo catálogo. Ela MUST NOT possuir uma lista hardcoded de slugs conhecidos.

Adicionar um novo conjunto de dados anunciado SHOULD exigir somente:

1. enviar os três arquivos válidos ao R2;
2. registrar/atualizar os metadados no catálogo;
3. registrar os três itens e seus relacionamentos;
4. definir status `announced`.

Quando essas condições forem satisfeitas, o conjunto SHOULD aparecer na loja sem alteração específica de React para aquele tema.

### Estrutura física dos dados

O bucket de produção desta entrega é:

`war-brasil-assets-prod`

Prefixo de dados:

`cosmetics/dice/`

Cada coleção segue a convenção:

```text
cosmetics/dice/<storage_slug>/attack.svg
cosmetics/dice/<storage_slug>/defense.svg
cosmetics/dice/<storage_slug>/neutral.svg
```

`preview.webp` é reservado para evolução futura e não é obrigatório nesta entrega.

O baseline físico informado para o bucket contém:

- `default`;
- `military-classic`;
- `medieval-spears`;
- `viking`;
- `cat`;
- `dog`;
- `football`.

`default` é reservado aos dados padrão. Os demais diretórios podem ser cadastrados como conjuntos de catálogo.

### Baseline inicial de conjuntos anunciados

O baseline da loja SHOULD cadastrar como `announced`, quando os respectivos três objetos existirem e forem válidos:

- Exército Clássico → `military-classic`;
- Lanças Medievais → `medieval-spears`;
- Viking → `viking`;
- Gato → `cat`;
- Cachorro → `dog`;
- Futebol → `football`.

IDs de domínio SHOULD permanecer independentes do nome físico da pasta. Exemplos:

- `set.exercito`;
- `set.lancas`;
- `set.viking`;
- `set.gato`;
- `set.cachorro`;
- `set.futebol`.

Nenhum item `announced` é concedido automaticamente aos usuários nesta entrega.

## Validação do storage

A aplicação MAY utilizar a S3 API para `HeadObject`, `GetObject` e validação controlada de objetos.

A storefront normal MUST NOT executar descoberta completa de bucket/prefixo para montar a lista de produtos.

Um processo de validação, migration, script operacional ou ferramenta administrativa MAY verificar se um conjunto possui:

- `attack.svg`;
- `defense.svg`;
- `neutral.svg`.

Um conjunto com metadata de catálogo mas asset ausente MUST falhar de forma visualmente segura e MUST NOT alterar regras de gameplay.

## Efeitos territoriais

`territory_effect` altera somente a apresentação da superfície territorial.

A cor jogável (`PlayerColor`) continua sendo a identidade visual primária e MUST permanecer inequivocamente reconhecível.

Um efeito territorial MAY alterar, dentro de limites de legibilidade:

- acabamento;
- gradação tonal;
- highlight;
- rim/borda;
- contraste;
- aparência metálica;
- detalhe visual leve.

Um efeito MUST NOT:

- trocar um `PlayerColor` por outro;
- ocultar seleção/hover/foco;
- reduzir legibilidade de tropas;
- alterar hitbox;
- alterar geometria interativa;
- exigir animação contínua pesada para existir.

Nesta entrega somente `territory.effect.default` precisa estar disponível.

O pipeline deve ficar preparado para novos efeitos sem exigir nova coluna por efeito.

## Inventário

Ownership MUST ser persistente e associado ao `auth.user` autenticado.

A relação de ownership SHOULD registrar:

- `user_id`;
- `cosmetic_id`;
- origem de aquisição;
- timestamp de aquisição.

Origens futuras MAY incluir:

- `default`;
- `purchase`;
- `reward`;
- `promotion`;
- `admin`.

Nesta entrega, somente `default` é utilizado pelo fluxo normal.

Ownership MUST ser único por `(user_id, cosmetic_id)`.

O browser MUST NOT conseguir conceder ownership a si próprio.

## Loadout

O loadout persistente MUST possuir uma entrada por usuário e slot.

A equipagem MUST:

- derivar o usuário de `session.user.id`;
- aceitar somente um item possuído;
- aceitar somente item ativo para novas equipagens, salvo regra de compatibilidade explicitamente definida;
- validar compatibilidade item/slot;
- ser idempotente;
- preservar os demais slots;
- nunca alterar saldo.

O banco SHOULD garantir ownership do item equipado por constraint/FK sempre que a modelagem permitir.

## Inicialização do comandante

A criação/ativação econômica de um comandante MUST ser idempotente.

Em uma única unidade transacional ela SHOULD garantir:

1. carteira `campaign-credit = 0`;
2. ownership dos quatro defaults;
3. os quatro defaults equipados.

A inicialização MUST NOT depender de trigger sobre as tabelas internas do Better Auth.

Reexecutar a inicialização MUST NOT duplicar ownership, saldo ou qualquer grant.

## Storefront / Intendência

A Intendência do Profile é o ponto de entrada para a loja.

A experiência completa SHOULD residir em `/profile/store` e continuar integrada à cena `profile` da Foundation.

O Profile MAY apresentar uma prévia dos destaques, mas a fonte funcional de catálogo/storefront pertence ao domínio econômico.

A primeira versão da loja MUST apresentar:

- saldo real `◈ 0`;
- loadout atual dos quatro slots;
- todos os conjuntos `announced` retornados pelo catálogo;
- itens default como possuídos/equipáveis;
- itens `announced` como `EM BREVE` ou equivalente inequívoco.

A ordem, nome e descrição das remessas MUST vir do banco, não de arrays temáticos hardcoded no frontend.

A UI MUST NOT exibir CTA `COMPRAR` para itens sem fluxo de aquisição implementado.

A UI MUST NOT simular sucesso de compra.

A UI MUST NOT alterar inventário ao clicar em preview de item não possuído.

A UI MUST NOT inventar preço para um item anunciado sem oferta comercial ativa.

## Preview e assets

Nesta etapa não existe requisito de `preview.webp`.

A listagem inicial SHOULD utilizar representação leve da coleção sem baixar os SVGs HQ.

Os SVGs completos dos dados não devem ser carregados em lote apenas para renderizar cards da loja.

Assets HQ MAY ser carregados:

- quando o usuário abre uma visualização detalhada;
- quando o item equipado é necessário no runtime da partida.

Ao abrir um detalhe, a UI SHOULD carregar somente o objeto necessário ao preview ativo. Trocar entre ataque, defesa e neutro MAY solicitar o respectivo objeto sob demanda.

MUST evitar preloading de todo o catálogo HQ.

## APIs e boundaries

A arquitetura MUST manter boundary server-only:

`Page/Route Handler -> Service -> Repository -> PostgreSQL -> DTO`

Para resolução de assets, a boundary é estendida por um serviço server-only:

`Service -> Asset Storage Resolver -> S3/R2`

React components MUST NOT consultar SQL diretamente.

React components MUST NOT receber `ASSET_STORAGE_URL` nem credenciais derivadas.

A primeira entrega MAY expor leitura equivalente a:

- wallet próprio;
- catálogo/storefront;
- inventário próprio;
- loadout próprio;
- URL presigned de leitura para objeto cosmético solicitado.

A primeira entrega MAY expor mutação somente para equipagem de item já possuído.

A primeira entrega MUST NOT expor endpoint funcional de:

- compra;
- venda;
- grant de dinheiro pelo usuário;
- recompensa;
- transferência de dinheiro;
- conversão de moeda;
- compra de moeda;
- grant de cosmético pelo usuário;
- upload arbitrário ao bucket pelo usuário.

Endpoints autenticados MUST derivar o ator exclusivamente da sessão.

## Integração com dados

A engine visual de dados MUST separar função do dado de cosmético equipado.

A função continua sendo uma destas:

- ataque;
- defesa;
- neutro.

O cosmético define somente a textura/material visual.

Regras:

- iniciativa/rolagem neutra usa `dice_neutral` do jogador;
- ataque usa `dice_attack` do atacante;
- defesa usa `dice_defense` do defensor.

Fallback 2D e apresentação 3D MUST resolver o mesmo cosmético.

Trocar skin MUST NOT alterar geometria, collider, lançamento, trajetória, valor predeterminado ou detecção da face superior.

Falha de object storage, URL expirada ou asset ausente MUST NOT alterar o resultado autoritativo da rolagem.

## Snapshot de cosméticos por partida

Partidas MUST congelar o loadout relevante no início.

O runtime de jogo MUST NOT consultar o Profile a cada batalha ou renderização.

No início da partida, o backend SHOULD copiar os quatro slots efetivos para um snapshot em `game.*` associado ao jogador da sala.

Para assets de dados, o snapshot MUST congelar a referência persistente/object key efetiva, não uma URL presigned efêmera.

Depois que a partida começou:

- mudar o Profile MUST NOT mudar aquela partida;
- alterar metadados de marketing MUST NOT mudar aquela partida;
- reconectar MUST recuperar o mesmo snapshot;
- o servidor MAY gerar uma nova URL presigned para a mesma object key em reconnect;
- observadores/clientes MUST ver os mesmos cosméticos;
- rematch/reinício que cria nova partida lógica SHOULD capturar novamente o loadout no novo início.

Bots MUST utilizar os quatro defaults nesta entrega.

## GameSnapshot

O contrato da partida MAY projetar os cosméticos efetivos por `GamePlayer`.

Ele MUST NOT expor por causa disso:

- `auth.user.id`;
- saldo;
- inventário completo;
- histórico de aquisição;
- ledger;
- `ASSET_STORAGE_URL`;
- Secret Access Key;
- dados privados do Profile.

Somente a configuração visual necessária para reproduzir a partida deve atravessar a boundary do jogo.

## Segurança

A implementação MUST seguir deny-by-default.

O cliente não é autoridade para:

- saldo;
- ownership;
- status de catálogo;
- disponibilidade de item;
- object key arbitrária;
- preço futuro;
- concessão;
- validade de equipagem.

Toda mutação de loadout MUST validar sessão, ownership e slot no servidor.

Toda object key recebida do cliente MUST ser ignorada ou validada contra catálogo autoritativo; o browser não pode solicitar assinatura arbitrária de qualquer chave do bucket.

Toda futura mutação financeira MUST possuir contrato transacional e idempotente antes de ser habilitada.

## Migrações e compatibilidade

Migrations MUST ser forward-only, ordenadas e idempotentes segundo o runner atual.

A implementação planejada deve comportar, conceitualmente:

- fundação `economy.*` para moeda/saldo/ledger;
- catálogo e conjuntos em `catalog.*`;
- referência de `storage_slug`/prefixo por conjunto;
- object key persistente para cosméticos de dados;
- ownership em `inventory.*`;
- loadout em `profile.*`;
- snapshot cosmético em `game.*`.

A migration de storage MUST converter referências locais `/dados/...` para object keys R2 sem alterar IDs de catálogo ou ownership.

A migration MUST ser validada em:

- banco limpo;
- upgrade do baseline atual;
- usuários existentes;
- novos usuários.

Backfill MUST ser determinístico e conceder somente os defaults previstos.

## Observabilidade

Falhas de economia, inventário e object storage SHOULD ser distinguíveis de falhas de Profile e de gameplay.

Logs MUST NOT expor session token, `ASSET_STORAGE_URL`, Access Key ID, Secret Access Key, query parameters de assinatura ou dados financeiros desnecessários.

Logs de asset SHOULD usar somente identificadores seguros como `cosmetic_id`, `set_id` e object key quando necessário.

Eventos futuros de movimentação econômica SHOULD possuir correlação/idempotência suficiente para auditoria.

## Fora de escopo desta entrega

Explicitamente fora de escopo:

- checkout;
- compra de cosméticos;
- preço monetário real;
- pagamento com dinheiro real;
- moeda premium;
- recompensas por vitória/partida;
- missões que concedam créditos;
- daily rewards;
- battle pass;
- marketplace entre usuários;
- trading;
- gifting;
- refund;
- promoções que concedam ownership;
- painel administrativo de grants;
- upload de assets pelo browser;
- edição de bucket pela storefront;
- descoberta automática de novos produtos baseada somente nas pastas do R2;
- títulos cosméticos do comandante.

Esses recursos futuros MUST estender este domínio em vez de criar uma economia paralela.

## Definition of Done

A fundação econômica desta etapa está concluída quando:

1. existe uma única moeda real ativa, `campaign-credit`;
2. usuários novos e existentes possuem saldo real `0`;
3. nenhuma ação normal consegue ganhar ou gastar moeda;
4. os quatro defaults são possuídos e equipados;
5. ownership e loadout são persistentes e separados;
6. catálogo e conjuntos são dirigidos pelo PostgreSQL, sem lista temática hardcoded no frontend;
7. o baseline anunciado inclui os conjuntos registrados e válidos para `military-classic`, `medieval-spears`, `viking`, `cat`, `dog` e `football`;
8. Intendência/Profile consome fontes reais de wallet/store/inventory;
9. `/profile/store` oferece a experiência de loja sem compra simulada;
10. `ASSET_STORAGE_URL` é a única connection string do object storage usada pela aplicação;
11. nenhuma credencial do R2 chega ao browser, DTO, log ou snapshot persistente;
12. assets são resolvidos a partir de object keys e entregues sob demanda, preferencialmente por URL presigned de leitura;
13. equipagem valida sessão, ownership e slot server-side;
14. partidas congelam object keys/loadout no início, não URLs presigned efêmeras;
15. dados 2D/3D respeitam os três slots de dados sem alterar física ou resultado;
16. território respeita `territory_effect` sem perder `PlayerColor` ou interação;
17. bots utilizam defaults;
18. storefront não baixa em lote os assets HQ;
19. adicionar um conjunto `announced` válido ao catálogo não exige alteração temática específica no frontend;
20. todos os BLOCKERs de `EVAL.md` estão verdes.
