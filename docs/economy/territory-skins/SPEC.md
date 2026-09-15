# Territory Skins — SPEC v1

Status: **reconciliado com Economy/Storefront V2**

## 1. Autoridade

Este documento é a autoridade especializada para representação, equipagem, snapshot, delivery e renderização do cosmético de superfície territorial.

O slot canônico é:

```text
territory_skin
```

Referências históricas a `territory_effect` em migrations antigas não definem o contrato atual.

Em caso de sobreposição:

- `docs/economy/SPEC.md` governa wallet, ledger, ownership e invariantes econômicos;
- `docs/economy/store/SPEC.md` governa catálogo comercial, produtos, ofertas, coleções e merchandising;
- este documento governa semântica visual e integração de territory skins no jogo.

## 2. Objetivo

Permitir que um jogador possua, compre, equipe e use um acabamento visual nos territórios que controla sem alterar:

- regra de jogo;
- geometria territorial;
- hitbox;
- ownership territorial;
- fronteiras;
- tropas;
- protocolo de interação.

O sistema suporta duas famílias:

```text
procedural -> effect_key em registry seguro
image      -> asset_ref WebP canônica
```

## 3. Modelo persistente

Todo acabamento territorial é um `catalog.cosmetics` com:

```text
slot = territory_skin
```

Ownership continua em `inventory.cosmetics` e equipagem em `profile.cosmetic_loadout`.

Para `territory_skin`, exatamente uma representação visual é válida:

```text
PROCEDURAL
  effect_key IS NOT NULL
  asset_ref IS NULL

IMAGE
  effect_key IS NULL
  asset_ref IS NOT NULL
```

São inválidos:

```text
effect_key != NULL + asset_ref != NULL
effect_key = NULL + asset_ref = NULL
```

A constraint correspondente não pode invalidar os slots de dados.

## 4. Runtime

O runtime deve projetar semanticamente algo equivalente a:

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

`cosmeticId` é a identidade estável. URL temporária não é identidade de skin.

## 5. Default

O acabamento metálico atual é o default universal:

```text
id: territory.effect.default
slot: territory_skin
effect_key: default
asset_ref: NULL
is_default: true
status: available
```

Todo usuário deve possuir e poder reequipar o default sem compra.

Falha de storage nunca remove acesso ao default.

## 6. Skins de imagem V1

As quatro skins iniciais são:

| Cosmético | `asset_ref` |
| --- | --- |
| `territory.effect.azulejo-brasil` | `cosmetics/territory-skins/azulejo_brasil.webp` |
| `territory.effect.azulejo-ornamental` | `cosmetics/territory-skins/azulejo_ornamental.webp` |
| `territory.effect.ceu-estrelado` | `cosmetics/territory-skins/ceu_estrelado.webp` |
| `territory.effect.solar-ornamental` | `cosmetics/territory-skins/solar_ornamental.webp` |

Todas usam:

```text
slot = territory_skin
effect_key = NULL
is_default = false
```

Preço e disponibilidade pertencem à camada comercial, não a este renderer SPEC. A Storefront V2 pode promovê-las a products/offers sem alterar identidade ou asset key.

## 7. Storage e delivery

Image skins usam somente:

```text
cosmetics/territory-skins/*.webp
```

O banco persiste object key, não URL temporária nem URL dependente de ambiente.

A aplicação resolve a chave por delivery server-side. Runtime não usa `ListObjects` para descobrir catálogo.

Uma nova skin de imagem deve exigir, no máximo:

1. objeto WebP válido;
2. registro de catálogo;
3. product/offer quando comercial.

Não deve exigir branch React por slug.

## 8. Ownership, compra e equipagem

Cada skin é um cosmetic item individual.

Quando existir oferta ativa, compra usa exatamente o pipeline econômico compartilhado:

- `expectedPrice` server-authoritative;
- wallet/ledger/receipt atômicos;
- ownership individual;
- counter/histórico quando aplicável;
- rollback integral em erro.

Compra não equipa automaticamente.

O Arsenal possui bay `TERRITÓRIO` e oferece somente default + skins possuídas. Equipar item não possuído é rejeitado pelo servidor.

## 9. Storefront

A Storefront apresenta territory skins a partir do catálogo e das ofertas, sem allowlist temática local.

Um item pode aparecer como descoberta editorial mesmo sem oferta ativa. CTA e preço só aparecem como compra real quando um product/offer autoritativo existir.

Estados mínimos:

- disponível/comprável;
- possuído;
- equipado;
- anunciado/sem oferta ativa;
- indisponível.

## 10. Composição visual do mapa

Hierarquia conceitual:

```text
1. base/material derivado do PlayerColor
2. acabamento/textura territory_skin
3. estado funcional de interação
4. tropas, markers e HUD funcional
```

A skin modifica a superfície; não substitui a semântica de ownership.

## 11. PlayerColor dominante

A mesma skin deve continuar distinguível nos seis PlayerColors:

```text
forest
ocean
sun
ruby
violet
orange
```

Para fonte grayscale/neutral, o renderer pode derivar highlights/base/shadows da cor do dono. Uma fonte canônica recolorável deve servir às seis cores quando aplicável.

Não são necessárias seis cópias do mesmo asset.

## 12. SVG, hitbox e interação

Como territórios são paths SVG, image skins devem reutilizar a geometria existente via pattern/image/material equivalente.

A camada cosmética:

- não captura pointer;
- não duplica hitbox;
- não cria um componente React completo por território apenas para textura;
- reaplica material somente quando assinatura visual relevante muda.

Estados funcionais têm precedência sobre a skin, incluindo:

```text
normal
hover
highlighted
highlighted-hover
selected
target selectable
target blocked
```

A skin pode perder intensidade para preservar esses estados.

## 13. Legibilidade

Nenhuma skin pode ocultar:

- ownership color;
- marcador de tropas;
- seleção;
- borda/feedback de hit;
- alvo válido/bloqueado;
- markers especiais do jogo.

## 14. Procedurais

Skins procedurais são resolvidas por registry seguro de código.

O banco armazena somente `effect_key`.

Chave desconhecida degrada visualmente para `default` sem mutar:

- ownership;
- loadout;
- snapshot;
- ledger.

CSS, HTML, JavaScript ou shader arbitrário vindo do banco é proibido.

## 15. Snapshot de partida

A escolha equipada é congelada quando a partida inicia.

Shape conceitual:

```ts
type TerritorySkinSnapshot =
  | { kind: "procedural"; cosmeticId: string; effectKey: string }
  | { kind: "image"; cosmeticId: string; assetRef: string };
```

Alterar o perfil depois não altera partida em andamento.

Presigned URL nunca é persistida como identidade. Em reconnect:

```text
assetRef persistente -> delivery resolver -> URL válida atual
```

A skin pertence ao jogador. Após conquista, o território passa a usar a skin congelada do novo proprietário sem consulta econômica ao banco.

## 16. Cache e performance

Assets devem ser reutilizados por `asset_ref`, não baixados uma vez por território.

O renderer não deve produzir o padrão:

```text
42 territórios = 42 downloads do mesmo WebP
```

A Store pode lazy-load previews; o jogo carrega apenas skins necessárias aos jogadores da partida e o fallback default.

## 17. Falhas

Falha de image skin causa fallback visual para o default metálico.

Fallback não pode:

- reequipar default persistente;
- remover ownership;
- alterar snapshot;
- alterar ledger;
- gerar compra/reembolso;
- alterar gameplay.

Erro de um objeto deve permanecer isolado ao asset afetado.

## 18. Assinatura visual

A identidade usada para invalidação deve ser estável, por exemplo:

```text
owner:<playerColor>:skin:<cosmeticId>:mode:<kind>
```

Presigned URL não pode ser a única identidade porque renovação de URL não representa troca de skin.

## 19. Segurança

Servidor valida:

- slot `territory_skin`;
- ownership antes de equipar;
- lifecycle do catálogo;
- object key permitida;
- transação econômica quando houver compra.

Cliente nunca é autoridade econômica.

## 20. Compatibilidade

A implementação preserva:

- 42 territórios;
- geometria/hit layer;
- hover/seleção;
- pointer/keyboard;
- regras multiplayer;
- default de usuários/partidas antigas.

Descriptor inválido ou ausente degrada para `default`.

## 21. Critérios de aceite

A feature está aderente quando:

1. `territory_skin` é o slot canônico;
2. default continua universal/gratuito;
3. quatro WebPs V1 permanecem catalogados por object key;
4. skins com oferta ativa podem ser compradas atomicamente;
5. compra não equipa implicitamente;
6. equipagem owned-only persiste;
7. snapshot congela a skin;
8. seis PlayerColors continuam legíveis com a mesma skin;
9. estados funcionais prevalecem;
10. hitbox não muda;
11. conquista troca para a skin do novo dono;
12. falha R2 degrada sem mutação persistente;
13. cache evita downloads redundantes;
14. novo WebP não exige branch temática;
15. todos os blockers de `docs/economy/territory-skins/EVAL.md` passam.
