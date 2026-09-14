# SPEC — Economia, Loja e Cosméticos

## Autoridade do documento

Este documento é a fonte autoritativa do WAR Brasil para:

- moeda e saldo persistente;
- catálogo econômico;
- conjuntos anunciados na loja;
- ownership de cosméticos;
- loadout cosmético;
- Intendência enquanto storefront;
- integração dos cosméticos com partida, dados e territórios.

Outros SPECs MUST referenciar este documento em vez de redefinir regras de moeda, saldo, catálogo, inventário, loadout, aquisição ou compra.

O domínio de títulos cosméticos textuais do comandante continua pertencendo a `docs/pre-game/profile/SPEC.md` e não faz parte dos quatro slots definidos aqui.

## Objetivo da primeira entrega

A primeira entrega cria uma economia real, persistente e propositalmente inerte.

Ela MUST permitir:

- cada usuário possuir uma carteira real;
- saldo inicial real de `0`;
- nenhum método de ganhar dinheiro nesta etapa;
- nenhum método de gastar dinheiro nesta etapa;
- nenhum fluxo de compra nesta etapa;
- inventário persistente;
- quatro slots cosméticos independentes;
- equipagem persistente dos cosméticos possuídos;
- anúncio dos conjuntos de dados já existentes em `dev`;
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
- `catalog.*` — definições dos cosméticos e conjuntos;
- `inventory.*` — ownership de cosméticos por usuário;
- `game.*` — snapshot cosmético congelado para uma partida.

MUST NOT existir saldo autoritativo duplicado em `profile.*`, `game.*` ou estado do cliente.

MUST NOT existir ownership autoritativo inferido a partir do loadout.

MUST NOT existir preço ou aquisição autoritativos definidos somente no frontend.

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

A fundação econômica SHOULD criar um ledger desde a primeira migration, mesmo que permaneça vazio nesta entrega.

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
- referência do asset quando aplicável;
- referência de preview própria para storefront quando aplicável;
- chave de efeito quando for territorial;
- status de catálogo;
- indicador de default;
- timestamps de auditoria.

IDs de catálogo MUST ser independentes do caminho físico do asset.

Renomear ou mover um arquivo MUST NOT exigir alterar ownership histórico.

### Status de catálogo

O baseline possui:

- `draft` — interno e não exibido;
- `announced` — visível como novidade, mas não adquirível;
- `available` — elegível para um fluxo futuro de aquisição;
- `retired` — não oferecido para novas aquisições, preservado para ownership existente.

`announced` MUST NOT ser interpretado como comprável.

`retired` MUST NOT remover o item de inventários existentes nem quebrar partidas históricas.

## Conjuntos

Conjuntos MUST ser modelados separadamente dos itens.

Um conjunto:

- possui identidade, nome, descrição e arte de divulgação próprios;
- referencia zero ou mais itens em ordem de apresentação;
- não representa ownership por si só;
- não representa loadout por si só;
- MAY agrupar menos ou mais que quatro slots.

Nesta primeira entrega existem três conjuntos anunciados.

### Exército Clássico

ID de conjunto sugerido: `set.exercito`

Itens:

- `dice.attack.exercito` → `/dados/exercito/ataque.svg`;
- `dice.defense.exercito` → `/dados/exercito/defesa.svg`;
- `dice.neutral.exercito` → `/dados/exercito/neutro.svg`.

Status inicial: `announced`.

Nenhum desses itens é concedido automaticamente aos usuários nesta entrega.

### Lanças Medievais

ID de conjunto sugerido: `set.lancas`

Itens:

- `dice.attack.lancas` → `/dados/lancas/ataque.svg`;
- `dice.defense.lancas` → `/dados/lancas/defesa.svg`;
- `dice.neutral.lancas` → `/dados/lancas/neutro.svg`.

Status inicial: `announced`.

Nenhum desses itens é concedido automaticamente aos usuários nesta entrega.

### Viking

ID de conjunto sugerido: `set.viking`

Itens:

- `dice.attack.viking` → `/dados/viking/ataque.svg`;
- `dice.defense.viking` → `/dados/viking/defesa.svg`;
- `dice.neutral.viking` → `/dados/viking/neutro.svg`.

Status inicial: `announced`.

Nenhum desses itens é concedido automaticamente aos usuários nesta entrega.

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
- conjunto Exército Clássico como nova remessa;
- conjunto Lanças Medievais como nova remessa;
- conjunto Viking como nova remessa;
- itens default como possuídos/equipáveis;
- itens `announced` como `EM BREVE` ou equivalente inequívoco.

A UI MUST NOT exibir CTA `COMPRAR` para itens sem fluxo de aquisição implementado.

A UI MUST NOT simular sucesso de compra.

A UI MUST NOT alterar inventário ao clicar em preview de item não possuído.

A UI MUST NOT inventar preço para um item anunciado sem oferta comercial ativa.

## Preview e assets

Storefront MUST possuir assets de preview adequados ao contexto da loja.

Os SVGs completos dos dados não devem ser carregados em lote apenas para renderizar cards da loja.

Assets HQ MAY ser carregados:

- quando o usuário abre uma visualização detalhada;
- quando o item equipado é necessário no runtime da partida.

A listagem inicial SHOULD utilizar preview reduzido/otimizado.

MUST evitar preloading de todo o catálogo HQ.

## APIs e boundaries

A arquitetura MUST manter boundary server-only:

`Page/Route Handler -> Service -> Repository -> PostgreSQL -> DTO`

React components MUST NOT consultar SQL diretamente.

A primeira entrega MAY expor leitura equivalente a:

- wallet próprio;
- catálogo/storefront;
- inventário próprio;
- loadout próprio.

A primeira entrega MAY expor mutação somente para equipagem de item já possuído.

A primeira entrega MUST NOT expor endpoint funcional de:

- compra;
- venda;
- grant de dinheiro pelo usuário;
- recompensa;
- transferência de dinheiro;
- conversão de moeda;
- compra de moeda;
- grant de cosmético pelo usuário.

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

## Snapshot de cosméticos por partida

Partidas MUST congelar o loadout relevante no início.

O runtime de jogo MUST NOT consultar o Profile a cada batalha ou renderização.

No início da partida, o backend SHOULD copiar os quatro slots efetivos para um snapshot em `game.*` associado ao jogador da sala.

Depois que a partida começou:

- mudar o Profile MUST NOT mudar aquela partida;
- reconectar MUST recuperar o mesmo snapshot;
- observadores/clientes MUST ver os mesmos cosméticos;
- rematch/reinício que cria nova partida lógica SHOULD seguir a regra explicitamente definida pelo fluxo de start, preferencialmente capturando novamente o loadout no novo início.

Bots MUST utilizar os quatro defaults nesta entrega.

## GameSnapshot

O contrato da partida MAY projetar os cosméticos efetivos por `GamePlayer`.

Ele MUST NOT expor por causa disso:

- `auth.user.id`;
- saldo;
- inventário completo;
- histórico de aquisição;
- ledger;
- dados privados do Profile.

Somente a configuração visual necessária para reproduzir a partida deve atravessar a boundary do jogo.

## Segurança

A implementação MUST seguir deny-by-default.

O cliente não é autoridade para:

- saldo;
- ownership;
- status de catálogo;
- disponibilidade de item;
- preço futuro;
- concessão;
- validade de equipagem.

Toda mutação de loadout MUST validar sessão, ownership e slot no servidor.

Toda futura mutação financeira MUST possuir contrato transacional e idempotente antes de ser habilitada.

## Migrações e compatibilidade

Migrations MUST ser forward-only, ordenadas e idempotentes segundo o runner atual.

A implementação planejada deve comportar, conceitualmente:

- fundação `economy.*` para moeda/saldo/ledger;
- catálogo e conjuntos em `catalog.*`;
- ownership em `inventory.*`;
- loadout em `profile.*`;
- snapshot cosmético em `game.*`.

A migration MUST ser validada em:

- banco limpo;
- upgrade do baseline atual;
- usuários existentes;
- novos usuários.

Backfill MUST ser determinístico e conceder somente os defaults previstos.

## Observabilidade

Falhas de economia e inventário SHOULD ser distinguíveis de falhas de Profile e de gameplay.

Logs MUST NOT expor session token, credentials ou dados financeiros desnecessários.

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
- títulos cosméticos do comandante.

Esses recursos futuros MUST estender este domínio em vez de criar uma economia paralela.

## Definition of Done

A fundação econômica desta etapa está concluída quando:

1. existe uma única moeda real ativa, `campaign-credit`;
2. usuários novos e existentes possuem saldo real `0`;
3. nenhuma ação normal consegue ganhar ou gastar moeda;
4. os quatro defaults são possuídos e equipados;
5. ownership e loadout são persistentes e separados;
6. Exército, Lanças e Viking existem como conjuntos anunciados, não adquiríveis;
7. Intendência/Profile consome fontes reais de wallet/store/inventory;
8. `/profile/store` oferece a experiência de loja sem compra simulada;
9. equipagem valida sessão, ownership e slot server-side;
10. partidas congelam o loadout no início;
11. dados 2D/3D respeitam os três slots de dados sem alterar física ou resultado;
12. território respeita `territory_effect` sem perder `PlayerColor` ou interação;
13. bots utilizam defaults;
14. storefront não baixa em lote os assets HQ;
15. todos os BLOCKERs de `EVAL.md` estão verdes.
