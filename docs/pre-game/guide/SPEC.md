# SPEC — Guide da Home / Tour de Comando

**Rota:** `/home`  
**Escopo:** estado autenticado `command-open` da Home  
**Tipo:** orientação contextual opcional, acionada pelo usuário  
**Baseline:** navegação atual da Home em `dev`

Segue `../quality-standard.md`, `../visual-language.md`, `../home/SPEC.md`, `../traceability.md` e `../../../skills/frontend-quality/SKILL.md`.

Este SPEC adiciona um guide contextual para explicar os quatro destinos existentes da Home sem alterar suas rotas, contratos, regras de gameplay ou hierarquia funcional.

O guide é uma camada de orientação. Ele MUST NOT redefinir `OPERAÇÕES`, `DOUTRINA`, `COMANDO` ou `CAMPANHA`.

---

## 1. Base real e fontes externas

A implementação deve seguir as fontes atuais abaixo quando houver dúvida de acessibilidade ou qualidade frontend:

- Front-End Checklist: https://github.com/thedaviddias/Front-End-Checklist
- Front-End Checklist — skill global atual: https://github.com/thedaviddias/Front-End-Checklist/blob/main/skills/frontend-checklist-global/SKILL.md
- WAI-ARIA APG — Modal Dialog Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WCAG 2.2 — Focus Visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
- WCAG 2.2 — Focus Not Obscured (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- WCAG 2.2 — Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- MDN — `HTMLElement.inert`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert

Regras do Front-End Checklist especialmente relevantes:

- controles interativos MUST possuir nome acessível;
- foco MUST permanecer visível;
- modal MUST possuir gerenciamento de foco e fechamento por teclado;
- toda interação MUST continuar operável por teclado;
- motion não essencial MUST respeitar `prefers-reduced-motion`;
- layout MUST evitar overflow horizontal;
- leituras/escritas de layout SHOULD ser agrupadas, evitando layout thrash;
- animações simples SHOULD privilegiar `transform` e `opacity`;
- touch targets SHOULD ser confortáveis e MUST atender o mínimo WCAG aplicável.

---

## 2. Comportamento existente a preservar

A Home já expõe quatro destinos DOM reais em `command-home-client.tsx`:

| ID | Label | Destino |
| --- | --- | --- |
| `operations` | OPERAÇÕES | `/matchmaking` |
| `doctrine` | DOUTRINA | `/rules` |
| `profile` | COMANDO | `/profile` |
| `campaign` | CAMPANHA | `/campaign` |

Os links já usam `data-destination={destination.id}`.

MUST preservar:

- os quatro links como controles DOM acessíveis;
- hrefs atuais;
- estados de foco/hover existentes;
- estado `command-open`;
- layout desktop/mobile da Home;
- navegação imediata quando o guide está fechado;
- funcionamento sem WebGL;
- `prefers-reduced-motion`;
- route transition atual;
- onboarding e reward Beta Tester como superfícies prioritárias quando presentes.

O guide MUST NOT modificar `DESTINATIONS` para criar uma segunda fonte de verdade.

---

## 3. Objetivo do usuário

O jogador MUST conseguir:

1. encontrar um controle de ajuda previsível no canto superior direito;
2. abrir o guide voluntariamente;
3. compreender, em ordem, a função de:
   - Operações;
   - Doutrina;
   - Comando;
   - Campanha;
4. avançar e voltar entre etapas;
5. abandonar o guide a qualquer momento;
6. concluir o guide e retornar à Home exatamente ao estado anterior;
7. usar o guide com mouse, touch e teclado;
8. usar conteúdo funcional equivalente com motion reduzido.

Não existe abertura automática no primeiro acesso nesta versão.

Não existe persistência em banco ou `localStorage`.

---

## 4. Launcher `?`

### 4.1 Presença

Adicionar um botão de ajuda no canto superior direito da viewport.

O botão MUST:

- usar elemento `button`;
- usar `type="button"`;
- ter texto visual `?`;
- possuir nome acessível equivalente a `Abrir guia da tela inicial`;
- possuir `:focus-visible` explícito;
- possuir touch target de pelo menos **40x40 CSS px** no projeto, excedendo o mínimo WCAG 2.2 de 24x24;
- respeitar safe area do dispositivo;
- não depender de hover;
- não causar layout shift.

Posicionamento de referência:

```css
position: fixed;
top: max(18px, env(safe-area-inset-top));
right: max(18px, env(safe-area-inset-right));
```

### 4.2 Quando aparece

O launcher SHOULD estar visível somente quando:

```text
route = /home
commandOpen = true
onboardingOpen = false
betaTesterRewardPending = false
routeTransitionPending = false
```

Se outro modal bloqueante estiver ativo, o launcher MUST permanecer atrás ou ser ocultado.

### 4.3 Hierarquia visual

O botão deve seguir a linguagem visual da Home:

- carvão/verde profundo como massa;
- latão/dourado como autoridade;
- marfim para glyph/foco;
- sem ciano/neon;
- sem glassmorphism genérico;
- sem animação idle permanente.

A presença do botão deve ser discreta e reconhecível, não competir com o dock de destinos.

---

## 5. Modelo do tour

O guide possui quatro etapas fixas:

```ts
type HomeGuideStepId =
  | "operations"
  | "doctrine"
  | "profile"
  | "campaign";
```

Ordem normativa:

```text
operations → doctrine → profile → campaign
```

A configuração SHOULD ser declarativa e separada do JSX visual:

```ts
const HOME_GUIDE_STEPS = [
  {
    id: "operations",
    index: "01",
    title: "OPERAÇÕES",
    body: "É aqui que você encontra uma partida ou inicia uma nova operação.",
  },
  {
    id: "doctrine",
    index: "02",
    title: "DOUTRINA",
    body: "Aqui ficam as regras do jogo. Consulte a Doutrina sempre que quiser revisar como uma partida funciona.",
  },
  {
    id: "profile",
    index: "03",
    title: "COMANDO",
    body: "Aqui fica seu Dossiê e Arsenal. Veja seu perfil, equipe seus cosméticos e acesse a Intendência para adquirir novos itens.",
  },
  {
    id: "campaign",
    index: "04",
    title: "CAMPANHA",
    body: "Aqui você acompanha o Passe de Campanha da temporada, seu nível, XP e as recompensas disponíveis.",
  },
] as const;
```

O copy pode receber ajuste editorial, mas a semântica acima é normativa.

---

## 6. Spotlight e máscara

### 6.1 Resultado visual

Em cada etapa:

- toda a viewport fica escurecida;
- somente o destino ativo permanece visualmente exposto;
- o alvo exposto MUST permanecer legível;
- a área exposta não pode ser interpretada como clicável durante o guide;
- um painel explicativo aparece na área escurecida;
- a máscara não pode esconder o painel, foco ou controles do próprio guide.

### 6.2 Não elevar o destino acima da máscara

MUST NOT resolver o spotlight alterando temporariamente o `z-index` dos links da Home.

Motivo:

- a Home já possui múltiplos stacking contexts;
- elevar filhos através de stacking contexts ancestrais é frágil;
- a solução não deve repetir regressões de composição já observadas em outras superfícies.

### 6.3 Estratégia normativa

Usar quatro painéis fixos para formar o recorte:

```text
┌──────────────────────────────────────┐
│                TOP                   │
├────────────┬─────────────┬───────────┤
│    LEFT    │   SPOTLIGHT │   RIGHT   │
├────────────┴─────────────┴───────────┤
│               BOTTOM                 │
└──────────────────────────────────────┘
```

Cada painel:

- `position: fixed`;
- recebe fundo carvão/preto semitransparente;
- bloqueia pointer;
- MAY usar blur leve se não comprometer performance/legibilidade;
- não precisa criar um novo stacking context complexo.

Padding visual de referência ao redor do alvo:

```text
8–12 CSS px
```

### 6.4 Opacidade

Direção visual de referência:

```css
background: rgb(3 7 6 / 78%);
```

Não é valor normativo. O requisito é:

- alvo ativo claramente reconhecível;
- resto da interface subordinado;
- texto do guide com contraste suficiente;
- cena 3D incapaz de competir com o conteúdo.

---

## 7. Medição do alvo

### 7.1 Fonte do alvo

Usar os destinos reais existentes.

Preferência:

```ts
destinationRefs.current[step.id]
```

O código MAY usar `[data-destination]` como fallback, mas não deve criar um segundo elemento visual para representar o alvo.

### 7.2 Medição

A geometria do spotlight deve vir de:

```ts
target.getBoundingClientRect()
```

Leituras de layout MUST:

- ocorrer apenas ao abrir o guide;
- ocorrer ao trocar de etapa;
- ocorrer após resize/orientation relevante;
- ocorrer quando o alvo mudar de tamanho;
- ser agrupadas em uma única leitura por atualização;
- ser agendadas com `requestAnimationFrame` quando partirem de observer/evento;
- MUST NOT acontecer a cada frame.

### 7.3 ResizeObserver

Enquanto o guide estiver aberto, MAY existir `ResizeObserver` sobre:

- alvo atual;
- rail de destinos, se necessário.

O observer MUST ser desconectado no cleanup.

O callback SHOULD apenas agendar uma medição consolidada. MUST NOT intercalar repetidamente DOM reads/writes.

### 7.4 Falha de medição

Se o alvo:

- não existir;
- possuir `width <= 0`;
- possuir `height <= 0`;
- estiver completamente fora da viewport em estado que não possa ser corrigido pelo layout;

o guide MUST fechar de forma segura ou não abrir.

MUST NOT exibir uma máscara sem contexto.

---

## 8. Modalidade e bloqueio da Home

Durante o guide, a Home por trás MUST ser **inert**.

O usuário não pode:

- clicar no destino destacado;
- navegar por Tab para os quatro destinos;
- acionar footer/legal links;
- acionar outros botões da Home;
- disparar navegação acidental.

### 8.1 Portal

O container do guide SHOULD ser renderizado com portal em `document.body`.

Motivo: permite marcar a raiz visual da Home como `inert` sem tornar o próprio guide inert.

Estrutura conceitual:

```text
body
├── HomeRoot [inert enquanto guide aberto]
└── HomeGuidePortal
    ├── mask panels
    └── dialog
```

### 8.2 `inert`

Durante o guide:

```ts
homeRoot.inert = true;
```

No cleanup:

```ts
homeRoot.inert = false;
```

O lifecycle MUST restaurar o valor anterior corretamente mesmo em unmount, route transition ou fechamento por Escape.

MUST NOT aplicar `aria-hidden="true"` no `body`.

---

## 9. Semântica do dialog

O painel explicativo é uma interação modal, porque o restante da Home fica indisponível enquanto ele está aberto.

Aplicar padrão WAI-ARIA APG Modal Dialog.

Container:

```tsx
<section
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  aria-describedby={bodyId}
/>
```

MUST existir:

- título visível;
- descrição visível;
- botão explícito para fechar;
- botão `ANTERIOR` nas etapas 2–4;
- botão `PRÓXIMO` nas etapas 1–3;
- botão `ENTENDI` na etapa 4.

O painel MUST NOT ser chamado de tooltip no código ou na semântica ARIA.

---

## 10. Gerenciamento de foco

### 10.1 Ao abrir

Antes de abrir, armazenar o elemento que possuía foco, normalmente o launcher `?`.

Ao abrir:

- foco MUST entrar no dialog;
- o título da etapa MAY receber `tabIndex={-1}`;
- o título é o alvo inicial recomendado para que contexto seja anunciado antes das ações.

### 10.2 Dentro do dialog

`Tab` e `Shift+Tab` MUST permanecer dentro do dialog.

A implementação SHOULD preferir um trap pequeno e explícito, sem nova dependência.

Não usar `tabindex > 0`.

### 10.3 Troca de etapa

Ao avançar ou voltar:

- atualizar spotlight;
- atualizar copy;
- mover foco para o título da nova etapa;
- garantir que o foco permaneça visível.

### 10.4 Escape

`Escape` MUST fechar o guide imediatamente.

### 10.5 Ao fechar

Foco MUST retornar ao launcher que abriu o guide, se ainda estiver montado.

Se o launcher não existir mais por mudança legítima de estado, foco deve ir para um destino previsível da Home, preferencialmente o dock.

---

## 11. Controles e interação

Etapa 1:

```text
[FECHAR]                         [PRÓXIMO]
```

Etapas 2–3:

```text
[ANTERIOR]     [FECHAR]          [PRÓXIMO]
```

Etapa 4:

```text
[ANTERIOR]     [FECHAR]          [ENTENDI]
```

MAY haver indicador:

```text
01 / 04
```

O indicador MUST NOT ser a única forma de comunicar a etapa.

Os botões MUST:

- possuir foco visível;
- possuir target confortável para touch;
- não depender apenas de cor;
- manter labels textuais;
- continuar legíveis a 200% de zoom.

---

## 12. Posicionamento do painel explicativo

O painel não deve ter posição rígida por etapa.

Algoritmo:

1. medir spotlight;
2. medir painel;
3. preferir região acima do alvo se houver espaço;
4. senão usar região abaixo;
5. se nenhuma região comportar, usar posição central segura sem cobrir completamente o alvo;
6. respeitar safe areas e margem mínima da viewport.

MUST preservar:

```text
12–16 px
```

de margem de segurança nas bordas em viewport estreita.

MUST NOT introduzir scroll horizontal.

O guide SHOULD caber em `390x844`.

Se o conteúdo vertical exceder a viewport, apenas o painel do guide MAY rolar internamente; a Home permanece inert.

---

## 13. Motion

Motion serve apenas para comunicar abertura, troca de contexto e fechamento.

### 13.1 Abertura

Referência:

```text
mask opacity 0 → 1
panel opacity 0 → 1
~160–220 ms
```

### 13.2 Troca de etapa

MUST NOT animar continuamente `top`, `left`, `width` ou `height` do recorte.

Para evitar layout-triggering animation:

1. fade curto do conteúdo/máscara;
2. trocar geometria do spotlight no ponto intermediário;
3. fade de entrada.

A geometria pode mudar instantaneamente enquanto opacity reduz a percepção do salto.

### 13.3 Fechamento

Referência:

```text
opacity 1 → 0
~160–220 ms
```

### 13.4 Reduced motion

Com:

```css
@media (prefers-reduced-motion: reduce)
```

MUST:

- remover transição espacial;
- remover qualquer movimento do painel;
- reduzir fade a instantâneo ou quase instantâneo;
- manter as quatro etapas, texto, foco e controles equivalentes.

Reduced motion MUST NOT pular conteúdo.

---

## 14. Z-index e composição

Hierarquia conceitual:

```text
Foundation/WebGL              abaixo
Home content                  normal
Help launcher                 acima da Home
Guide mask                    acima da Home
Guide dialog                  acima da mask
Route transition              acima do guide
Blocking modals               acima do guide / guide oculto
```

Referência compatível com o estado atual:

```text
help launcher ≈ 70
guide mask    ≈ 80
guide dialog  ≈ 82
route transition atual = 95
blocking modal/reward > guide
```

Os números MAY mudar se tokens de layering forem centralizados. A ordem é normativa; o número exato não.

---

## 15. Estado React

Estado mínimo recomendado:

```ts
type HomeGuideState =
  | { open: false }
  | {
      open: true;
      stepIndex: number;
    };
```

MUST NOT guardar em React state:

- posição por frame;
- progresso de animação por frame;
- polling de `getBoundingClientRect`.

Geometria do alvo pode ser state discreto atualizado em:

- open;
- step change;
- resize/observer.

### 15.1 Integração com HomeUiState

O estado visual global da Home MAY ganhar:

```text
guide
```

se isso simplificar a exclusividade com onboarding/reward/auth modal.

A prioridade deve ser explícita.

Exemplo conceitual:

```text
route-transition
> onboarding / beta-reward / auth-modal
> guide
> destination-focus
> command-open
```

O guide não pode coexistir visualmente com outro modal bloqueante.

---

## 16. Arquitetura proposta

Arquivos:

```text
src/components/pre-game/home/
├── command-home-client.tsx
├── command-home-guide.tsx
├── command-home-guide.module.css
└── command-home.module.css
```

Opcionalmente:

```text
src/lib/pre-game/home-guide.ts
```

apenas se a configuração/copy precisar ser reutilizada por testes sem importar JSX.

### 16.1 Responsabilidades

`command-home-client.tsx`:

- launcher;
- refs dos quatro destinos;
- estado open/step;
- exclusividade com outros estados;
- ponto de integração.

`command-home-guide.tsx`:

- portal;
- modal semantics;
- foco;
- Escape;
- trap;
- spotlight geometry;
- observers;
- next/back/close;
- cleanup de inert/focus.

`command-home-guide.module.css`:

- máscara;
- painel;
- launcher MAY permanecer em `command-home.module.css` se for parte estrutural da Home;
- responsividade;
- reduced motion;
- foco.

MUST NOT adicionar biblioteca de tour, modal ou animação para este recurso.

---

## 17. Segurança de interação

Enquanto o guide estiver aberto:

- click/tap no alvo exposto MUST NOT navegar;
- Enter/Space no link por trás MUST NOT ser alcançável via foco;
- pointer nos painéis da máscara MUST ser absorvido;
- click fora MAY ser configurado para fechar, mas não é obrigatório;
- se click fora fechar, ele MUST apenas fechar o guide e MUST NOT propagar para a Home no mesmo evento.

A opção recomendada é **não fechar por click fora**; usar `FECHAR` e `Escape` é mais previsível.

---

## 18. Performance

MUST:

- não criar novo Canvas;
- não alterar Foundation;
- não atualizar React a cada frame;
- não medir DOM em loop contínuo;
- não manter observer quando fechado;
- não instalar dependency;
- não bloquear carregamento da Home com assets novos;
- não causar CLS ao abrir o guide;
- não causar scroll horizontal;
- limpar listeners/observer/RAF no unmount.

SHOULD:

- usar CSS simples;
- usar opacity para transições;
- limitar blur;
- evitar `will-change` permanente;
- medir apenas o necessário;
- reutilizar os destinos já renderizados.

---

## 19. Fallback e ausência de WebGL

O guide pertence ao DOM da Home.

Portanto:

- MUST funcionar com Foundation WebGL normal;
- MUST funcionar quando `sceneState === "fallback"`;
- MUST funcionar com WebGL indisponível;
- MUST NOT consultar ou manipular Three.js;
- MUST NOT depender de Canvas para localizar os destinos.

---

## 20. Mobile e orientação

Viewport mínimo de referência:

```text
390x844
```

MUST testar:

- portrait;
- landscape;
- touch;
- safe area;
- fonte ampliada;
- painel sem overflow horizontal.

Em `orientationchange`/resize:

- agendar nova medição;
- manter a mesma etapa;
- não fechar/reabrir;
- não mover foco;
- não reiniciar o guide.

---

## 21. Conteúdo e linguagem

O texto deve explicar o jogo e os destinos, não a implementação técnica.

MUST evitar:

- “componente”;
- “rota”;
- “sistema”;
- “endpoint”;
- “backend”;
- explicações de engenharia.

Tom esperado:

```text
É aqui que...
Aqui você...
Nesta área...
```

Sem analogias infantis.

---

## 22. Estados visuais para validação

Desktop `1440x900`:

- launcher;
- operations;
- doctrine;
- profile;
- campaign;
- reduced-motion;
- focus-visible em launcher;
- focus-visible em Próximo;
- fechamento.

Mobile `390x844`:

- launcher;
- operations;
- doctrine;
- profile;
- campaign;
- landscape;
- painel próximo à borda;
- teclado/foco quando aplicável.

---

## 23. Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| GUIDE-01 | `?` aparece em `/home` no estado `command-open` sem modal bloqueante | inspection/manual |
| GUIDE-02 | launcher possui nome acessível, `button`, `type=button` e foco visível | accessibility/source |
| GUIDE-03 | tour percorre exatamente Operações → Doutrina → Comando → Campanha | unit/manual |
| GUIDE-04 | cada spotlight usa o link real correspondente, sem duplicar destinos | source |
| GUIDE-05 | resto da Home fica visualmente escurecido | visual |
| GUIDE-06 | apenas o alvo atual permanece visualmente exposto | visual |
| GUIDE-07 | alvo exposto não recebe click, touch ou foco durante o guide | keyboard/touch/e2e |
| GUIDE-08 | dialog usa `role=dialog`, `aria-modal=true` e nome acessível | accessibility/source |
| GUIDE-09 | Tab/Shift+Tab permanecem no dialog | keyboard |
| GUIDE-10 | Escape fecha o guide | keyboard |
| GUIDE-11 | foco entra no guide ao abrir e retorna ao launcher ao fechar | keyboard |
| GUIDE-12 | mudança de etapa anuncia contexto e mantém foco visível | screen reader/keyboard |
| GUIDE-13 | `prefers-reduced-motion` mantém conteúdo equivalente sem motion espacial | reduced-motion |
| GUIDE-14 | `390x844` não possui overflow horizontal | mobile |
| GUIDE-15 | target size do launcher é >= 40x40 no projeto | inspection |
| GUIDE-16 | guide funciona sem WebGL | fallback/manual |
| GUIDE-17 | guide não altera href ou comportamento dos destinos quando fechado | regression |
| GUIDE-18 | ResizeObserver/listeners/RAF são limpos no fechamento/unmount | source/test |
| GUIDE-19 | não existe medição DOM por frame nem animation loop React | source |
| GUIDE-20 | nenhuma dependência nova é adicionada | diff |
| GUIDE-21 | route transition/modal bloqueante mantém prioridade sobre o guide | state/manual |
| GUIDE-22 | concluir `ENTENDI` remove toda máscara e restaura interação normal | e2e/manual |

---

## 24. Testes planejados

### 24.1 Testes finitos de fonte/unidade

Adicionar cobertura para:

- ordem de `HOME_GUIDE_STEPS`;
- ids canônicos;
- copy não vazio;
- launcher acessível;
- modal semantics;
- Escape handler;
- inert lifecycle;
- focus restore;
- reduced-motion class/media;
- ausência de nova dependency;
- ausência de `setInterval`/loop para medição;
- ausência de click-through.

### 24.2 E2E/manual

Fluxo principal:

```text
/home
→ command-open
→ clicar ?
→ Operações destacado
→ Próximo
→ Doutrina destacado
→ Próximo
→ Comando destacado
→ Próximo
→ Campanha destacado
→ Entendi
→ overlay desaparece
→ clicar Operações
→ /matchmaking
```

Fluxo teclado:

```text
Tab até ?
→ Enter
→ foco no guide
→ Tab permanece no guide
→ Próximo
→ foco/contexto nova etapa
→ Escape
→ foco retorna para ?
```

Fluxo touch:

```text
abrir guide
→ tocar visualmente no destino destacado
→ nenhuma navegação
→ usar Próximo
→ concluir
→ destino volta a ser tocável
```

---

## 25. Screen reader

A validação SHOULD incluir ao menos uma combinação real suportada pelo time, seguindo a recomendação do Front-End Checklist para widgets customizados.

Verificar:

- launcher é anunciado como botão de ajuda;
- dialog é anunciado com título da etapa;
- mudança de etapa é percebida;
- botões possuem nomes claros;
- conteúdo inert por trás não entra na navegação;
- fechamento devolve foco de forma previsível.

Automação não substitui essa validação.

---

## 26. Não fazer

MUST NOT:

- abrir o guide automaticamente nesta versão;
- salvar estado em banco;
- salvar `seen=true` em localStorage;
- transformar os quatro destinos em cópias dentro do modal;
- deixar o destino exposto clicável;
- depender de hover;
- usar tooltip semantics para o painel;
- usar `aria-hidden` no body;
- alterar `z-index` temporário dos quatro links para atravessar stacking contexts;
- usar um overlay transparente com “buraco” clicável;
- animar `top/left/width/height` continuamente para mover o spotlight;
- medir `getBoundingClientRect` a cada frame;
- adicionar biblioteca de guided tour;
- criar novo Canvas;
- alterar câmera/cena 3D;
- bloquear fechamento por Escape;
- esconder focus ring;
- introduzir scroll horizontal;
- permitir coexistência com onboarding/reward/modal bloqueante.

---

## 27. Relação com traceability

Esta iniciativa é **SUPPORTING**.

Ela ajuda o jogador a compreender conceitos `CORE` já existentes:

- Home como porta de comando;
- Operações;
- Doutrina;
- Perfil/Comando;
- Campanha.

O guide não cria nova regra de gameplay nem substitui nenhum conceito `CORE`.

Se no futuro o guide se tornar onboarding obrigatório, automático ou persistente, isso exige revisão deste SPEC e de `../traceability.md`.

---

## 28. Definition of Done

O recurso está concluído quando o jogador autenticado em `/home` pode abrir o botão `?`, percorrer quatro explicações em sequência e ver somente o destino relevante sem conseguir acioná-lo enquanto o modal está ativo.

O guide deve ser semanticamente modal, manter foco contido e visível, fechar por `Escape`, devolver foco ao launcher, funcionar em desktop/mobile/fallback/reduced-motion e desaparecer sem deixar estado, máscara, observer, listener ou bloqueio de interação residual.

Após `ENTENDI` ou `FECHAR`, a Home deve voltar exatamente ao comportamento anterior e os quatro destinos devem navegar normalmente.
