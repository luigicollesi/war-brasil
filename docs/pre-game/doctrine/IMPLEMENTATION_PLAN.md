# Plano técnico — Doutrina (`/rules`)

Branch de implementação: `feature/pre-game-doctrine-page`

Este plano transforma `SPEC.md`, `EVAL.md`, a linguagem visual global e as regras atuais do jogo em um contrato de implementação. O objetivo é entregar uma experiência de **demonstração estratégica**, não uma wiki nem um manual vertical infinito.

## 1. Princípios de arquitetura

1. **DOM e conteúdo primeiro.** Todo conteúdo essencial e toda navegação devem funcionar sem Canvas/WebGL. A cena 3D é reforço visual.
2. **Regra não nasce na UI.** Números, limites e exemplos mecânicos devem ser derivados das regras implementadas em `src/lib/shared/**` e/ou de adapters de apresentação já existentes.
3. **Server-first, Client pequeno.** A rota e o read model ficam server/shared sempre que possível; JavaScript cliente fica restrito à seleção de capítulo, histórico/deep-link e microinterações.
4. **Foundation é contrato, não dependência interna.** A página deve emitir intenção declarativa para `CommandShell/CommandScene` quando o contrato público da Foundation estiver disponível. Não importar/manipular Three/R3F diretamente.
5. **Mobile é composição própria.** Nada de simplesmente comprimir desktop.
6. **Acessibilidade é critério de aprovação.** Navegação por teclado, foco preservado, equivalência textual, `prefers-reduced-motion` e reflow sem overflow são parte do comportamento principal.

## 2. Conceito visual

A rota será tratada como uma **Mesa de Doutrina / Arquivo de Comando** dentro da instalação WAR Brasil.

### Desktop

- índice persistente de capítulos em uma faixa de comando lateral;
- artigo estratégico central, curto e altamente hierárquico;
- demonstração visual acoplada ao capítulo, usando mapa, dados, cartas e conexões reais;
- Mesa de Domínio como presença espacial/ambiental, sem competir com a leitura;
- capítulos apresentados como estados focados, não como uma longa página contínua;
- dourado/latão marca autoridade e seleção; vermelho aparece somente em conflito; verde militar, carvão e marfim dominam a massa visual;
- superfícies densas e materiais, evitando glassmorphism, neon ciano, grids de cards SaaS e hexágonos decorativos repetidos.

### Mobile

- cabeçalho compacto da Doutrina;
- índice de capítulos horizontal rolável internamente ou controle equivalente com alvos grandes;
- artigo primeiro, demonstração logo abaixo;
- `Anterior / Próximo` no fluxo normal, sem barra fixa que possa cobrir foco/conteúdo;
- nenhuma interação dependente de hover;
- nenhum overflow horizontal da viewport em `390x844`.

## 3. Estrutura de capítulos

A primeira versão deve cobrir as mecânicas ativas e consolidar conteúdo hoje espalhado pelo guia da Home:

1. `preparacao` — distribuição inicial, mapa e ordem de partida;
2. `objetivos` — funcionamento dos objetivos sem expor objetivo privado ativo;
3. `turno` — sequência operacional da rodada/turno;
4. `reforcos` — reforço territorial e bônus regionais;
5. `ataque` — origem/alvo, adjacência, dados e resolução;
6. `conquista` — transferência pós-conquista e consequências aplicáveis;
7. `movimentacao` — conexão válida, tropas móveis e restrições;
8. `barreiras-conexoes` — barreiras naturais e conexões especiais/túneis ativos;
9. `cartas` — símbolos, trocas, progressão, obrigatoriedade e negociação ativa;
10. `anomalias` — somente mecânicas/eventos realmente ativos após auditoria da fonte de verdade;
11. `vitoria` — condição final derivada do fluxo real do jogo.

`Ataque` absorve a explicação de combate/dados para evitar fragmentação didática. A lista final de capítulos só é congelada depois da auditoria das mecânicas ativas exigida por `DOC-07`.

## 4. Modelo de dados e fonte de verdade

Criar um read model puro, sem estado de React:

```text
src/lib/doctrine-presentation.ts
```

Responsabilidades:

- reutilizar `buildGameGuidePresentation()` onde ele já deriva corretamente valores das regras;
- importar diretamente funções/constantes de `src/lib/shared/**` quando o adapter atual não cobre uma mecânica;
- nunca repetir números de gameplay em JSX/CSS;
- produzir dados serializáveis e orientados à apresentação;
- distinguir explicitamente `regra atual`, `exemplo derivado` e `texto explicativo`.

Antes de escrever a cópia final de Objetivos, Anomalias, vitória e consequências de eliminação, auditar as autoridades atuais em `src/server/game-room-service.ts`, `src/lib/shared/**` e `src/lib/events/**`. Exemplos antigos do guia não devem ser promovidos a regra sem essa verificação.

## 5. Estrutura de componentes

```text
src/app/rules/page.tsx
src/app/rules/doctrine.module.css

src/components/doctrine/
  doctrine-experience.tsx
  doctrine-chapter-nav.tsx
  doctrine-chapter.tsx
  doctrine-demo.tsx
  doctrine-prev-next.tsx
  demos/
    preparation-demo.tsx
    reinforcement-demo.tsx
    attack-demo.tsx
    conquest-demo.tsx
    movement-demo.tsx
    cards-demo.tsx
    objective-demo.tsx
    barrier-demo.tsx
    anomaly-demo.tsx

src/lib/doctrine-presentation.ts
tests/doctrine-page.test.mjs
```

Preferir Tailwind para layout/spacing/responsividade. Usar CSS Module apenas onde materiais, gradientes, máscaras e motion da identidade visual forem complexos o suficiente para justificar CSS dedicado.

Reutilizar em vez de clonar:

- `GuideBoardScene` ou seus primitives semânticos para mapa 2D;
- `GameDie` para dados;
- `TerritoryCardArtwork` para cartas;
- assets canônicos do mapa e conexões;
- fontes e tokens já carregados pelo layout.

Não renomear/mover primitives compartilhados durante este track; isso reduz conflito com Foundation e outros branches paralelos.

## 6. Navegação e deep-link

URL canônica da página: `/rules`.

Deep-link por query string:

```text
/rules?chapter=ataque
/rules?chapter=cartas
```

Motivos:

- carregamento direto é server-renderizável;
- links continuam funcionais sem JavaScript;
- não depende de Canvas/3D;
- permite preservar posição/foco ao trocar apenas o capítulo;
- facilita snapshots e EVAL por capítulo.

A experiência cliente deve manter somente `activeChapter` e sincronizar histórico com a URL. O índice usa links reais (`<a>`/`<Link>`) e `aria-current="location"`. Mudanças de capítulo não devem chamar `focus()` automaticamente nem executar `scrollIntoView()`.

Para evitar navegações de servidor desnecessárias entre capítulos, a implementação pode hidratar o read model completo e interceptar o clique para `history.pushState`, mantendo fallback de navegação normal sem JS. `popstate` restaura o capítulo. Alternativamente, `next/link` com `scroll={false}` é aceitável se os testes provarem preservação de foco e posição.

## 7. Integração com Foundation

Enquanto `feature/pre-game-foundation` não publicar o contrato definitivo, implementar a experiência DOM de forma independente e não criar um segundo renderer/mock 3D.

Após o contrato ser congelado, a Doutrina deverá emitir apenas intenção semântica, por exemplo:

```ts
{
  mode: 'doctrine',
  focus: 'table',
  conflictLevel: 0 | 1 | 2,
  territoryExplode: false,
  orbitalAlignment: 0
}
```

O capítulo pode variar `conflictLevel` ou foco sem conhecer câmera, coordenadas, materiais ou meshes. Para uma cena majoritariamente estática, a Foundation deve preferir renderização sob demanda e reutilização de geometria/material, conforme o padrão de performance do React Three Fiber.

## 8. Migração da Home

`DOC-08` exige que a Home deixe de ser um segundo manual completo. Como existe track paralelo para Home, não redesenhar `/` neste branch antes da integração.

Contrato de integração:

- Home aponta `DOUTRINA -> /rules`;
- `GameQuickGuide` deixa de ser a experiência completa na Home;
- no máximo permanece um teaser curto, se o track Home justificar;
- após Foundation/Home entrarem em `dev`, sincronizar este branch e validar que não existe conteúdo divergente duplicado.

O próprio SPEC da Home já exige `DOUTRINA -> /rules`, então esta migração é coerente com os dois tracks.

## 9. Matriz EVAL -> implementação

| Gate | Evidência de implementação | Validação |
| --- | --- | --- |
| DOC-01 | índice semântico com links reais, teclado e touch | teclado-only + touch/mobile |
| DOC-02 | artigo e demos DOM/SVG independentes da cena | executar com WebGL indisponível |
| DOC-03 | `doctrine-presentation` deriva regras reais | testes contra `src/lib/shared/**` |
| DOC-04 | troca local/query sem scroll/focus forçado | comparar `scrollY` e `document.activeElement` |
| DOC-05 | layout mobile recomposto | viewport `390x844`, `scrollWidth <= clientWidth` |
| DOC-06 | motion ornamental desligável; conteúdo permanece | `prefers-reduced-motion: reduce` |
| DOC-07 | inventário explícito das mecânicas ativas | teste da lista de capítulos + auditoria de fontes |
| DOC-08 | Home direciona à Doutrina e não mantém manual divergente | teste estrutural após integração Home |
| DOC-09 | todo demo visual possui texto/figcaption equivalente | inspeção DOM/a11y |
| DOC-10 | mapa, cartas e dados reutilizam assets/primitives reais | testes de imports e snapshots |
| DOC-11 | deep-link resolve no DOM sem cena | acesso direto a cada `?chapter=` |

Meta de qualidade: **>= 95/100**, embora o mínimo contratual seja 85/100 e nenhum blocker.

## 10. Estratégia de testes

### Testes de código

Expandir/migrar os testes hoje concentrados em `tests/home-game-guide.test.mjs` para `tests/doctrine-page.test.mjs`:

- capítulos obrigatórios e ordem;
- números de reforço, dados, perdas, barreiras e trocas derivados das regras reais;
- imports de `GameDie`, `TerritoryCardArtwork` e mapa canônico;
- ausência de tabela de regra duplicada na UI;
- deep-link reconhece todos os slugs;
- Home não mantém o manual completo após integração.

### Testes funcionais/visuais

Cobrir obrigatoriamente:

- abertura direta de cada capítulo;
- índice, `Anterior`, `Próximo` e retorno;
- teclado-only;
- mobile `390x844`;
- reduced motion;
- WebGL indisponível;
- cross-check de Ataque, Conquista, Movimentação, Cartas e Objetivos;
- snapshots desktop/mobile de Preparação, Ataque, Cartas, Objetivos e pelo menos uma mecânica exclusiva do WAR Brasil.

Antes do PR:

```bash
npm test
npm run lint
npm run build
```

## 11. Fases de implementação

### Fase 0 — auditoria de autoridade

Mapear mecânicas ativas e suas fontes reais, especialmente Objetivos, Anomalias/eventos, vitória, eliminação, barreiras e conexões especiais. Registrar qualquer divergência do guia atual antes de escrever a nova cópia.

### Fase 1 — read model

Criar `doctrine-presentation.ts`, testes de fidelidade e catálogo final de capítulos. Nenhum layout complexo ainda.

### Fase 2 — experiência semântica

Criar `/rules`, índice, deep-link, prev/next, histórico, HTML acessível e composição responsive. Nesta fase a página já deve passar DOC-01, 02, 04, 05, 06 e 11 sem depender de 3D.

### Fase 3 — demonstrações reais

Adicionar mapa/dados/cartas/conexões reutilizando primitives e assets canônicos. Cada visual precisa de equivalente textual. Fechar DOC-03, 07, 09 e 10.

### Fase 4 — direção de arte

Aplicar materiais, hierarquia, microinterações e transições sem mudar o modelo semântico. Motion deve ter função e fallback reduced-motion.

### Fase 5 — Foundation + Home

Sincronizar `dev` depois que Foundation/Home publicarem seus contratos; substituir somente a borda de integração, sem importar internals. Validar DOC-08 e cena declarativa.

### Fase 6 — EVAL final

Rodar matriz completa, snapshots, testes, lint e build; coletar evidências do PR. Corrigir blocker antes de qualquer polimento opcional.

## 12. Pesquisa técnica utilizada

Fontes oficiais/prioritárias:

- Next.js — Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js — Lazy Loading: https://nextjs.org/docs/app/guides/lazy-loading
- Next.js — `<Link>` e controle de scroll: https://nextjs.org/docs/app/api-reference/components/link
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- MDN — `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- React Three Fiber — Scaling Performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance

Aplicação prática da pesquisa:

- Server Components para conteúdo estático e read model; Client Components somente na interação necessária;
- lazy loading apenas para enhancement pesado, nunca para bloquear conteúdo essencial;
- foco e scroll devem permanecer estáveis durante troca de capítulo;
- layout deve respeitar reflow, teclado, target size e foco visível;
- reduced-motion remove câmera/parallax/loops não essenciais sem retirar informação;
- cena 3D estática deve evitar render loop contínuo quando a Foundation permitir.

## 13. Não fazer

- não criar segundo renderer/canvas;
- não importar Three/R3F dentro da página de Doutrina;
- não copiar constantes de gameplay para JSX;
- não transformar a rota em FAQ/wiki/manual vertical gigante;
- não esconder regras em hover, animação ou 3D;
- não criar grid genérico de cards SaaS;
- não usar neon ciano/glass como identidade;
- não usar vermelho como cor ambiente permanente;
- não inventar comportamento para preencher lacuna de regra;
- não alterar API, schema, realtime ou gameplay para atender ao redesign;
- não adicionar biblioteca de UI/animação sem necessidade demonstrável.
