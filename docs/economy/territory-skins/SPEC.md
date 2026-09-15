# Territory Skins — SPEC v1

## 1. Status e autoridade

Este documento é a especificação normativa do subtipo de cosmético `territory_effect` responsável pela superfície visual dos territórios.

Ele complementa `docs/economy/SPEC.md` e `docs/pre-game/profile/SPEC.md`.

Em caso de conflito:

- `docs/economy/SPEC.md` governa carteira, ofertas, compra, inventário e atomicidade econômica;
- este documento governa representação, storage, equipagem, snapshot e renderização de territory skins;
- `docs/pre-game/profile/SPEC.md` governa composição e UX do Dossiê, Arsenal e Intendência.

Esta versão NÃO implementa código, migration ou conteúdo comercial. Ela congela o contrato necessário para implementação.

## 2. Objetivo

Permitir que um usuário possua, compre e equipe um acabamento visual para os territórios que controla, sem alterar regra de jogo, geometria, hitbox, ownership territorial ou protocolo de interação.

O sistema MUST suportar duas famílias de implementação:

1. `procedural`: acabamento definido por renderer seguro em código;
2. `image`: textura WebP armazenada no catálogo e entregue pelo storage de assets.

A extensão futura de qualquer uma das famílias MUST reutilizar o mesmo slot econômico `territory_effect` e o mesmo fluxo de ownership/loadout.

## 3. Não objetivos

Esta entrega MUST NOT:

- criar um inventário separado de skins territoriais;
- criar uma tabela exclusiva de ownership para texturas;
- permitir CSS arbitrário vindo do banco;
- permitir JavaScript/shader arbitrário vindo do banco;
- alterar regras, tropas, fronteiras, conquista ou cálculo de batalha;
- persistir URL temporária/presigned URL em snapshot de partida;
- consultar o banco a cada render, hover, seleção ou conquista;
- listar objetos do R2 em runtime para descobrir cosméticos;
- definir preços comerciais dos quatro assets iniciais sem decisão explícita de produto.

## 4. Modelo de domínio

### 4.1 Slot econômico

Todos os acabamentos territoriais MUST continuar sendo registros de `catalog.cosmetics` com:

```text
slot = territory_effect
```

Ownership MUST continuar sendo representado por `inventory.cosmetics`.

Equipagem MUST continuar sendo representada pelo slot `territory_effect` do `profile.cosmetic_loadout`.

Partidas MUST consumir o snapshot congelado correspondente em `game.player_cosmetic_loadouts` ou no contrato sucessor equivalente.

### 4.2 Modos de renderização

Para `slot = territory_effect`, cada cosmético MUST estar em exatamente um dos estados válidos abaixo:

```text
PROCEDURAL
  effect_key IS NOT NULL
  asset_ref IS NULL

IMAGE
  effect_key IS NULL
  asset_ref IS NOT NULL
```

O banco SHOULD impor a exclusividade acima com constraint limitada ao slot `territory_effect`.

A constraint MUST NOT ser aplicada de modo que quebre outros slots, em especial os dados (`dice_attack`, `dice_defense`, `dice_neutral`).

Estados ambíguos são inválidos:

```text
effect_key != NULL + asset_ref != NULL  -> inválido

effect_key = NULL + asset_ref = NULL    -> inválido para territory_effect
```

### 4.3 Contrato de runtime

O cliente SHOULD projetar o cosmético equipado em um discriminated union equivalente a:

```ts
type TerritorySkinRender =
  | {
      kind: "procedural";
      cosmeticId: string;
      effectKey: string;
    }
  | {
      kind: "image";
      cosmeticId: string;
      imageUrl: string;
    };
```

Nomes concretos MAY variar. As responsabilidades são normativas:

- `kind` diferencia implementação procedural e imagem;
- `cosmeticId` fornece identidade estável para cache/signature;
- uma skin procedural resolve por chave segura;
- uma skin de imagem recebe URL de entrega válida somente no cliente.

## 5. Acabamento padrão

O acabamento já existente do mapa é o cosmético padrão e gratuito.

Contrato conceitual:

```text
id/slug: territory.effect.default
slot: territory_effect
effect_key: default
asset_ref: NULL
is_default: true
status: available
```

O nome público MAY ser ajustado, mas sua identidade funcional MUST permanecer estável.

Todo usuário MUST:

- possuir o acabamento padrão sem compra;
- iniciar com ele equipado quando não houver escolha explícita válida;
- conseguir reequipá-lo a qualquer momento;
- nunca perder acesso a ele por compra, falha de storage ou retirada de outro cosmético.

O acabamento `default` representa o tratamento metálico procedural atualmente usado pelo mapa.

## 6. Catálogo inicial de imagens

A primeira entrega de image territory skins contém exatamente estes assets R2:

| Cosmético | Identidade sugerida | `asset_ref` |
| --- | --- | --- |
| Azulejo Brasil | `territory.effect.azulejo-brasil` | `cosmetics/territory-skins/azulejo_brasil.webp` |
| Azulejo Ornamental | `territory.effect.azulejo-ornamental` | `cosmetics/territory-skins/azulejo_ornamental.webp` |
| Céu Estrelado | `territory.effect.ceu-estrelado` | `cosmetics/territory-skins/ceu_estrelado.webp` |
| Solar Ornamental | `territory.effect.solar-ornamental` | `cosmetics/territory-skins/solar_ornamental.webp` |

Os quatro MUST usar:

```text
slot = territory_effect
effect_key = NULL
asset_ref = object key acima
is_default = false
```

A migration/catalog seed MAY escolher IDs internos UUID diferentes. Slug e identidade pública MUST continuar estáveis após publicação.

Nenhum preço é definido por esta SPEC.

## 7. Storage R2

### 7.1 Namespace

Image territory skins MUST usar o namespace:

```text
cosmetics/territory-skins/
```

A forma válida de object key SHOULD obedecer a:

```regex
^cosmetics/territory-skins/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$
```

### 7.2 Formato

Assets de imagem desta versão MUST:

- terminar em `.webp`;
- ser entregues como `image/webp`;
- manter `asset_ref` como object key canônica, não URL absoluta;
- ser resolvidos pelo mesmo serviço de entrega/autorização de assets cosméticos usado pela aplicação.

### 7.3 Descoberta

O catálogo é a fonte de verdade.

A aplicação MUST NOT executar `ListObjects`/listagem de bucket para decidir quais skins existem, quais estão disponíveis ou quais pertencem ao jogador.

Adicionar uma nova image skin SHOULD exigir somente:

1. upload do asset válido;
2. registro em catálogo;
3. criação/ativação da oferta quando aplicável.

A UI não SHOULD precisar de branch temática ou slug hardcoded por novo asset de imagem.

## 8. Ownership, oferta e compra

### 8.1 Unidade de ownership

Cada territory skin é um cosmético individual e MUST gerar ownership individual.

### 8.2 Ofertas

As quatro image skins iniciais SHOULD ser expostas como ofertas individuais pela camada comercial definida em `docs/economy/SPEC.md`.

Uma oferta MUST referenciar o cosmético por relacionamento de catálogo, nunca por caminho R2 hardcoded no componente React.

Preço, moeda, disponibilidade e janela comercial pertencem à oferta e não ao renderer.

### 8.3 Compra

Compra bem-sucedida MUST:

- obedecer à transação econômica do Economy V2;
- registrar ledger/carteira conforme contrato pai;
- criar ownership de `inventory.cosmetics` com acquisition source compatível com `purchase`;
- NÃO equipar automaticamente a skin, salvo se um requisito futuro explicitamente mudar essa regra.

Falha por saldo, oferta, idempotência ou ownership MUST preservar atomicidade definida na Economy SPEC.

## 9. Arsenal e equipagem

O Arsenal MUST possuir um bay de equipamento `TERRITÓRIO` correspondente a `territory_effect`.

Ele MUST:

- mostrar a skin atualmente equipada;
- mostrar somente alternativas pertencentes ao usuário;
- permitir equipar qualquer skin possuída e disponível;
- permitir voltar ao acabamento metálico padrão;
- usar preview coerente com o renderer real sempre que possível;
- bloquear equipagem de item não possuído.

Itens não possuídos pertencem à experiência de Store/Intendência, não ao seletor de ownership do Arsenal.

## 10. Store / Intendência

A Store MUST poder agrupar dinamicamente `territory_effect` como categoria de apresentação, por exemplo `Texturas de Território`.

A categoria MUST ser dirigida por dados do catálogo/ofertas.

Cards MUST poder apresentar:

- nome;
- preview real ou preview derivado;
- preço em moeda de jogo quando a oferta estiver ativa;
- estados `owned`, `equipped`, `available` e estados de indisponibilidade previstos pela Economy SPEC.

A Store MUST NOT manter um array React hardcoded com os quatro slugs iniciais como fonte de verdade.

## 11. Renderer do mapa

### 11.1 Princípio de composição

O renderer MUST preservar esta hierarquia conceitual:

```text
1. base/material do PlayerColor
2. acabamento/textura cosmética
3. estado de interação
4. conteúdo funcional: tropas, markers e demais HUDs
```

A skin modifica a superfície. Ela MUST NOT substituir a semântica de ownership dada pela cor do jogador.

### 11.2 Image skins em SVG

Como a face territorial é um `<path>` SVG, image skins SHOULD ser implementadas por recurso SVG reutilizável, preferencialmente um `<pattern>` contendo `<image>` ou mecanismo funcionalmente equivalente que preserve a geometria existente.

A implementação MUST:

- reutilizar a geometria da face territorial;
- manter a camada cosmética sem captura de pointer (`pointer-events: none` ou equivalente);
- NÃO duplicar hitbox interativa;
- NÃO criar um React component completo por território apenas para trocar textura;
- manter atualizações incrementais baseadas em assinatura/material quando nada visual mudou.

Valores concretos de opacity, blend mode, scale e transform da textura são decisões de implementação e tuning visual, não invariantes desta SPEC.

### 11.3 PlayerColor dominante

Para uma mesma skin, os seis PlayerColors jogáveis MUST continuar distinguíveis sem depender do tooltip:

```text
forest
ocean
sun
ruby
violet
orange
```

O acabamento MAY modular tonalidade/luz, mas MUST preservar leitura inequívoca do proprietário.

### 11.4 Interação tem precedência

Estados funcionais de mapa têm precedência visual sobre o cosmético.

A implementação MUST preservar clareza de, no mínimo:

```text
normal
hover
highlighted
highlighted-hover
```

Seleção, alvo válido, alvo bloqueado e outros estados semânticos do jogo MUST continuar reconhecíveis com qualquer skin.

A textura MAY ter sua intensidade reduzida durante estados funcionais para cumprir esta regra.

### 11.5 Legibilidade

Skin alguma pode tornar ilegíveis:

- marcador de tropas;
- borda/hit feedback;
- seleção;
- targetability;
- markers especiais que já pertencem ao jogo.

## 12. Skins procedurais

### 12.1 Registry seguro

Skins procedurais MUST ser resolvidas por registry/controlador de código, conceitualmente:

```text
TERRITORY_EFFECT_RESOLVERS
  default
  future-effect-a
  future-effect-b
```

O banco armazena somente `effect_key`.

O renderer interpreta chaves conhecidas.

### 12.2 Chave desconhecida

Uma `effect_key` desconhecida MUST degradar visualmente para o acabamento `default` sem alterar ownership ou loadout persistido.

### 12.3 Extensão futura

Adicionar nova skin procedural exige:

1. resolver seguro em código;
2. testes do renderer;
3. registro do cosmético no catálogo;
4. oferta, se comercial.

CSS arbitrário, HTML ou expressão executável do banco é proibido.

## 13. Snapshot de partida

### 13.1 Congelamento

Ao entrar/iniciar uma partida, a escolha equipada de cada jogador MUST ser congelada no snapshot cosmético da partida.

O comportamento visual de uma partida em andamento MUST NOT depender de mudanças posteriores em `profile.cosmetic_loadout`.

### 13.2 Shape conceitual

O snapshot MUST ser capaz de representar conteúdo equivalente a:

```ts
type TerritorySkinSnapshot =
  | {
      kind: "procedural";
      cosmeticId: string;
      effectKey: string;
    }
  | {
      kind: "image";
      cosmeticId: string;
      assetRef: string;
    };
```

O shape físico MAY continuar normalizado em colunas/tabelas existentes. A semântica acima é obrigatória.

### 13.3 URLs temporárias

Presigned URL ou URL temporária MUST NOT ser persistida como identidade da skin no snapshot.

Em reconnect/reload:

```text
assetRef persistente
  -> resolver de delivery
  -> URL válida atual
```

### 13.4 Skin pertence ao jogador

A skin pertence ao jogador, não ao território.

Quando um território muda de proprietário durante conquista:

```text
território
  -> novo ownerPlayerId
  -> snapshot cosmético do novo jogador
  -> skin do novo proprietário
```

A troca MUST ocorrer sem consulta nova ao banco e sem mutar ownership/loadout.

## 14. Cache e performance

O renderer MUST operar por skins únicas equipadas, não por downloads independentes por território.

Se vários territórios ou jogadores usam o mesmo `asset_ref`, o asset SHOULD ser carregado/cacheado uma única vez por contexto/navegador sempre que a plataforma permitir.

A implementação MUST evitar o padrão `42 territórios = 42 downloads independentes do mesmo WebP`.

A Store SHOULD:

- lazy-load previews fora da viewport;
- usar `preview_ref` otimizado quando disponível;
- carregar asset completo somente quando necessário para inspeção/render real;
- reservar dimensões para evitar layout shift.

O jogo MUST carregar somente skins efetivamente necessárias aos jogadores da partida, além do fallback procedural padrão.

## 15. Falhas e fallback

### 15.1 Falha de asset

Se uma image skin equipada não puder ser carregada, o mapa MUST usar visualmente o acabamento metálico `default` como fallback.

### 15.2 Fallback não é mutação

Fallback de render MUST NOT:

- reequipar `default` no perfil;
- remover ownership;
- alterar snapshot;
- alterar ledger;
- gerar compra/reembolso;
- alterar gameplay.

Quando o asset voltar a ficar disponível, a skin autoritativa MAY voltar a ser renderizada normalmente.

### 15.3 Falha de delivery

Erro de URL/asset SHOULD ser isolado ao acabamento afetado. O mapa e a partida MUST continuar utilizáveis.

## 16. Assinatura e invalidação visual

O renderer SHOULD usar identidade estável para decidir reaplicação do material.

Uma assinatura adequada é equivalente a:

```text
owner:<playerColor>:skin:<cosmeticId>:mode:<kind>
```

ou outra forma estável com a mesma semântica.

Presigned URL MUST NOT ser usada como única identidade da assinatura, porque renovação de URL não significa mudança de cosmético.

## 17. Segurança e confiança de dados

O servidor MUST validar:

- que o cosmético pertence ao slot `territory_effect`;
- que o usuário possui o cosmético antes de equipar;
- que o catálogo/lifecycle permite a operação;
- que image skins usam object key permitida;
- que procedural skins referenciam uma chave conhecida ou degradável de forma segura.

O cliente MUST tratar catálogo e ownership como dados, não como autorização suficiente para mutação econômica.

## 18. Compatibilidade

A implementação MUST preservar:

- os 42 territórios canônicos;
- geometria existente;
- hit layer existente;
- machine de hover/seleção existente;
- interação por pointer/keyboard existente;
- regras e sincronização multiplayer existentes;
- acabamento padrão de usuários/partidas sem skins novas.

Partidas e usuários antigos sem descriptor de skin válido MUST degradar para `default`.

## 19. Critérios de aceite

A implementação só pode ser considerada aderente quando:

1. o acabamento metálico `default` continua universal e gratuito;
2. os quatro WebPs iniciais estão catalogados como `territory_effect` image skins;
3. uma image skin pode ser comprada pela camada econômica, adquirida e equipada;
4. uma skin possuída persiste após reload;
5. uma skin equipada é congelada no snapshot da partida;
6. a textura é renderizada sem alterar hitbox ou regra de jogo;
7. os seis PlayerColors continuam distinguíveis usando a mesma skin;
8. hover/seleção/alvos/tropas continuam legíveis;
9. conquista troca imediatamente para a skin congelada do novo proprietário;
10. uma falha R2 resulta em fallback metálico sem mutação persistente;
11. assets iguais são reutilizados/cacheados em vez de baixados por território;
12. novo WebP não exige branch temática no React;
13. nova skin procedural entra apenas por resolver seguro + catálogo;
14. nenhum CSS/JS arbitrário é executado a partir do banco;
15. todos os gates de `docs/economy/territory-skins/EVAL.md` passam.
