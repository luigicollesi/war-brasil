# Plano técnico — Home / Entrada no Comando

Branch: `feature/pre-game-home`  
Base inicial: `dev@2083579396e108349d6983e40120aaccf5d1d1dd`

Este plano implementa `SPEC.md` e `EVAL.md` da Home sem assumir ownership da Foundation. A página deve consumir apenas o contrato público da cena e permanecer funcional sem WebGL.

## 1. Diagnóstico do estado atual

A Home atual (`src/app/page.tsx`) é uma composição de hero tradicional: marca/copy/CTA à esquerda, mapa à direita, fatos e `GameQuickGuide`. Isso conflita diretamente com o novo requisito de ritual espacial e com o `MUST NOT` de hero convencional.

Pontos que devem ser preservados:

- metadata de `/` (`title`, `description`, canonical, OpenGraph/Twitter);
- JSON-LD `WebSite` + `WebApplication`;
- indexabilidade específica da Home;
- asset canônico `public/war-brasil-42.production.svg` como fonte territorial existente;
- rota funcional `/matchmaking`;
- arquitetura App Router e dependências atuais.

Pontos que deixam de ser responsabilidade da Home:

- renderer/Canvas;
- câmera e coordenadas 3D;
- geometria 2.5D compartilhada;
- Terra/Globo, Mesa, Coroa Orbital e seus materiais;
- tokens/primitives globais da nova identidade.

Esses itens pertencem à trilha `foundation` conforme `parallel-development.md`.

## 2. Arquitetura proposta

### Server Component como raiz

Manter `src/app/page.tsx` como Server Component. Ele continua responsável por:

- metadata;
- structured data;
- estrutura semântica inicial;
- conteúdo crítico disponível no primeiro HTML;
- links reais para os destinos.

Não transformar a página inteira em `"use client"`.

### Ilha client pequena

Criar um componente local da trilha Home, por exemplo:

```text
src/components/pre-game/home/
  command-home.tsx
  command-home-client.tsx
  command-home.module.css
  home-types.ts
```

`command-home-client.tsx` concentra somente:

- estado da cerimônia;
- `sessionStorage` de visita repetida;
- detecção de `prefers-reduced-motion`;
- foco/hover/pointer dos destinos;
- emissão declarativa de intenção para a Foundation;
- skip da cerimônia.

Nenhum objeto Three.js deve entrar nessa árvore.

### Contrato com Foundation

A Home deve emitir apenas intenção semântica. Shape esperado conceitualmente:

```ts
{
  mode: "entrance",
  focus: "earth" | "brazil" | "table" | "insignia" | "none",
  conflictLevel: 0 | 1 | 2 | 3,
  orbitalAlignment: 0 | 1,
  territoryExplode?: number,
}
```

O tipo final deve ser importado da Foundation quando o contrato estiver congelado/integrado. Não criar uma segunda API paralela.

Enquanto Foundation não estiver disponível, a Home pode ser implementada e testada integralmente pelo fallback DOM/CSS e por um adapter/mock estritamente compatível com o contrato público, sem renderer próprio.

## 3. Máquina de estados da Home

Estados previstos pelo spec:

```text
boot
  -> awaiting-entry
  -> command-open
  -> destination-focus
  -> transitioning

variantes de entrada:
  repeat-visit
  reduced-motion
  scene-fallback
```

### Regras

#### `boot`

- duração lógica mínima;
- não renderizar tela vazia;
- DOM funcional já existe;
- após hydration decide se há cerimônia ornamental.

#### `awaiting-entry`

- estado visual inicial estável;
- WAR Brasil reconhecível;
- `ENTRAR NO COMANDO` é o controle dominante;
- botão/skip não depende do término da cena;
- destinos ainda não disputam atenção principal.

#### cerimônia ornamental

Somente em primeira visita da sessão e sem reduced-motion:

```text
Terra -> Brasil -> Mesa
```

A sequência acontece na Foundation e nunca bloqueia CTA, teclado ou navegação.

#### `command-open`

Ao ativar `ENTRAR NO COMANDO`:

- persistir `war-brasil:pre-game-home-entered=1` em `sessionStorage`;
- revelar os três destinos como mecanismos/setores da mesma instalação;
- Foundation recebe foco `table` e alinhamento orbital curto;
- `ENTRAR NO COMANDO` deixa de ser o foco principal.

#### `destination-focus`

`OPERAÇÕES`:

- intenção de conflito aumenta de forma contida;
- vermelho aparece apenas aqui em nível perceptível;
- pode haver separação territorial mínima, sem deformação.

`DOUTRINA`:

- conflito zerado;
- leitura/análise;
- foco em Brasil/Mesa.

`COMANDO`:

- conflito zerado;
- foco em insígnia/prestígio.

Foco visual deve responder a `focus`, hover e pointer fine, mas a navegação nunca depende deles.

#### `transitioning`

Clique em destino deve iniciar navegação imediatamente via `next/link`. A animação de saída é enhancement e não pode segurar `router.push`/Link esperando `transitionend`.

## 4. Composição visual

### Desktop

Objetivo: parecer uma instalação de comando monumental, não uma landing page.

Camadas:

1. ambiente escuro verde/carvão;
2. Mesa/Brasil como objeto espacial central;
3. UI DOM mínima sobreposta e independente da iluminação da cena.

Estrutura sugerida:

```text
┌────────────────────────────────────────────────────┐
│ marca mínima                         status/skip     │
│                                                    │
│                 [ COROA ]                          │
│              [ BRASIL 42 ]                         │
│             [ MESA DOMÍNIO ]                       │
│                                                    │
│              ENTRAR NO COMANDO                     │
│                                                    │
│ após entrada:                                      │
│   OPERAÇÕES  ── mecanismo central ──  COMANDO      │
│                    DOUTRINA                         │
└────────────────────────────────────────────────────┘
```

Não usar três cards retangulares grandes. Os destinos devem parecer placas de autorização, trilhos, encaixes ou setores mecânicos conectados à Mesa.

### Mobile 390x844

Recomposição específica:

- objeto Brasil/Mesa ocupa aproximadamente a metade superior, sem cobrir texto;
- CTA principal fica em zona touch confortável abaixo/ao redor do objeto;
- após entrada, destinos viram uma coluna/rail de três controles persistentes;
- cada alvo visual deve ser generoso (preferência de implementação >= 44px de altura, superando o mínimo WCAG 2.2 AA de 24px);
- nenhum estado depende de hover;
- remover parallax e simplificar câmera;
- sem overflow horizontal.

## 5. Linguagem visual local

Consumir tokens da Foundation quando disponíveis. A Home não deve criar um segundo sistema global.

Direção:

- massa: carvão + verde militar profundo;
- autoridade: latão/dourado em linhas, bordas, encaixes e CTA principal;
- texto: marfim quente;
- vermelho: ausente/ínfimo em `awaiting-entry`; cresce somente em `operations-focus`;
- microinterações: trava, encaixe, rotação curta, leitura de relé;
- evitar blur/glass SaaS, neon ciano, hexágonos e glow constante.

A marca textual deve ser curta. Não reintroduzir marketing longo, fatos ou manual acima da dobra.

## 6. Motion e acessibilidade

### Motion normal

Usar as escalas do spec:

- interface: ~120–320ms;
- cerimônia/câmera: ~350–900ms por etapa;
- ambiente: 8–30s e quase imperceptível.

Animação deve sempre ter causa semântica.

### `prefers-reduced-motion`

Quando `reduce`:

- iniciar diretamente em composição estável;
- não executar Terra -> Brasil -> Mesa como deslocamento espacial;
- desligar parallax, câmera ornamental e loops não essenciais;
- permitir apenas feedback curto por cor/opacidade/borda quando necessário;
- conteúdo e ações permanecem idênticos.

### DOM acessível

- `ENTRAR NO COMANDO` deve ser `<button>`;
- destinos devem ser `<Link>` reais;
- foco visível com outline sólido, não apenas glow;
- ordem de tabulação: entrar/skip -> Operações -> Doutrina -> Comando;
- cena decorativa fora da árvore de acessibilidade;
- labels persistentes no mobile;
- não usar apenas cor para indicar destino ativo.

## 7. Progressive enhancement / fallback

A experiência base deve funcionar antes do 3D.

### Base SSR/CSS

Renderizar imediatamente:

- marca;
- composição 2D estável da Mesa/Brasil;
- `ENTRAR NO COMANDO`;
- links de destino quando abertos;
- skip/reduced-motion equivalente.

O fallback pode usar o SVG canônico como camada visual 2D, sem reimplementar interação territorial.

### 3D

O host da Foundation deve ser lazy-loaded pelo contrato compartilhado. A Home não importa `Canvas` diretamente.

Se WebGL atrasar/falhar:

- manter fallback;
- nenhum spinner de bloqueio;
- nenhum layout shift estrutural;
- permitir toda a navegação.

## 8. Performance

Sem inventar orçamento antes de medir baseline.

Diretrizes:

- Server Component como default;
- Client boundary pequena;
- nenhum 3D no bundle crítico da Home por import direto da página;
- não duplicar geometria/Canvas;
- Foundation deve preferir `frameloop="demand"` quando objetos estiverem em repouso ou mecanismo equivalente;
- limitar/adaptar DPR;
- degradar efeitos antes de reduzir legibilidade;
- evitar state updates React por frame para animação 3D;
- interação DOM deve produzir feedback imediatamente, independentemente da cena.

Registrar no PR comparação de bundle/DevTools/Profiler suficiente para provar ausência de regressão evidente.

## 9. SEO

Preservar do `src/app/page.tsx` atual:

- `HOME_TITLE` e `HOME_DESCRIPTION` salvo ajuste editorial deliberado;
- canonical `/`;
- robots/indexabilidade da Home;
- OpenGraph/Twitter;
- JSON-LD `WebSite` + `WebApplication`;
- conteúdo semântico fora do Canvas.

O redesign não deve mover título/descrição/navegação crítica para Canvas.

## 10. Arquivos previstos

### Editar

- `src/app/page.tsx` — nova raiz semântica da Home; preservar metadata/JSON-LD.

### Criar, preferencialmente

- `src/components/pre-game/home/command-home.tsx` — composição server-friendly.
- `src/components/pre-game/home/command-home-client.tsx` — máquina de estados local.
- `src/components/pre-game/home/command-home.module.css` — layout/responsividade/estados locais.
- `src/components/pre-game/home/home-types.ts` — somente tipos locais de UI, se realmente necessários.
- testes específicos de Home sob `tests/`.

### Remover da Home, sem apagar prematuramente código compartilhado

- uso de `WarShell` na rota `/` se o novo `CommandShell` integrado substituí-lo;
- `GameQuickGuide` da dobra/Home;
- `HomeTerritoryMap` como protagonista da Home.

Não apagar `HomeTerritoryMap` ou seus testes apenas porque deixou de ser usado na Home sem antes verificar se há consumidores/requisitos legados.

## 11. Estratégia de testes mapeada ao EVAL

### Automação estrutural/unitária

- HOME-01/02/03: links possuem href corretos;
- HOME-04: caminho reduced-motion pula cerimônia espacial;
- HOME-05: CTA e links existem no DOM sem renderer;
- HOME-06: metadata + JSON-LD preservados;
- HOME-11: destinos são controles DOM;
- HOME-12: `sessionStorage` produz repeat visit reduzida;
- FND-08/09/20: responsabilidade da Foundation; Home não duplica geometria.

### E2E/visual quando Playwright estiver disponível

Viewports determinísticos:

- 1440x900;
- 390x844.

Estados:

- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `repeat-visit`;
- `reduced-motion`;
- `fallback`.

Congelar animação/tempo para screenshots.

### Manual obrigatório

- teclado completo;
- touch 390x844;
- browser com WebGL indisponível;
- reduced motion do SO;
- primeira visita vs. mesma sessão;
- nenhum overflow horizontal;
- nenhum flash branco/preto entre estados;
- vermelho não permanece ativo fora de Operações.

## 12. Sequência de implementação

### Fase H0 — Baseline e contrato

1. confirmar HEAD da branch e sincronização com `dev`;
2. registrar comportamento/metadata atual;
3. verificar se `foundation-contract` já existe;
4. se não existir, desenvolver apenas contra fallback/adapter compatível e não inventar internals.

### Fase H1 — Estrutura funcional sem 3D

1. refatorar `/` mantendo Server Component;
2. implementar DOM da Home e links reais;
3. implementar estados `awaiting-entry` e `command-open`;
4. implementar mobile 390x844;
5. preservar SEO/JSON-LD.

Gate: HOME-01/02/03/05/06/07/10/11 funcionam sem WebGL.

### Fase H2 — Estado, skip e preferências

1. implementar state machine local simples;
2. `sessionStorage` para repeat visit;
3. `prefers-reduced-motion`;
4. skip imediato;
5. foco por teclado/pointer/touch.

Gate: HOME-04/08/12.

### Fase H3 — Integração Foundation

1. sincronizar branch com `dev` após Foundation;
2. importar contrato público real;
3. mapear estados Home -> `CommandSceneIntent`;
4. validar Terra -> Brasil -> Mesa;
5. validar Brasil 42 unido e Coroa sem acesso aos internals.

Gate: HOME-09 + FND aplicáveis.

### Fase H4 — Polimento visual

1. ajustar hierarquia/material;
2. eliminar aparência de hero/cards/dashboard;
3. ajustar vermelho por estado;
4. revisar continuidade `awaiting-entry -> command-open -> destination-focus`;
5. revisar desktop/mobile sem usar hardcodes por aparelho.

Gate: HOME-V1..V4 e score >= 85.

### Fase H5 — Evidência e validação

1. testes focados;
2. `npm test`;
3. `npm run lint`;
4. `npm run build`;
5. snapshots/evidências desktop/mobile;
6. matriz EVAL preenchida no PR;
7. atualizar branch com `dev` imediatamente antes do merge e repetir gates relevantes.

## 13. Riscos e decisões

### Foundation ainda não integrada

Maior risco. Mitigação: Home nunca implementa renderer próprio; avança pelo DOM/fallback e integra contrato real depois.

### Rotas `/rules` e `/profile` ainda ausentes no `dev` base

A Home pode e deve apontar para as rotas especificadas. A navegação completa desses destinos só pode ser validada de ponta a ponta após as trilhas Doctrine/Profile serem integradas.

### Regressão SEO

Risco alto porque o redesign tende a migrar tudo para cena. Mitigação: metadata, JSON-LD, marca e navegação continuam no Server Component/DOM.

### Custo inicial de Three/R3F

Mitigação: lazy loading pela Foundation, SSR funcional, fallback estável, renderização sob demanda/adaptativa e zero bloqueio do CTA.

## 14. Pesquisa técnica usada

- Next.js — Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js — Lazy Loading: https://nextjs.org/docs/app/guides/lazy-loading
- React Three Fiber — Scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- MDN — `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- web.dev — Optimize INP: https://web.dev/articles/optimize-inp
- three.js — WebGL compatibility check: https://threejs.org/manual/en/webgl-compatibility-check.html

## 15. Critério de pronto

A Home só está pronta quando:

- todos os HOME-01..HOME-12 passam;
- conceitos CORE aplicáveis continuam presentes;
- score Home >= 85/100;
- fallback/reduced-motion/mobile são experiências completas;
- Foundation não foi duplicada nem acessada por internals;
- metadata/structured data não regrediram;
- `npm test`, `npm run lint` e `npm run build` passam;
- branch está atualizada com `dev` e o EVAL foi reexecutado no estado integrado.
