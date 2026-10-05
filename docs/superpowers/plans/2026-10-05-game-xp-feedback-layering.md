# Game XP Feedback Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que todo evento de XP de partida confirmado pelo servidor seja efetivamente visível ao jogador, inclusive enquanto modais de jogo estão abertos, sem bloquear interação e sem competir com cinematics fullscreen de dados.

**Architecture:** O feedback visual de XP deixa de pertencer ao stacking context local de `GameReadyClient` e passa a ser renderizado via portal em `document.body`, no mesmo nível global dos modais. A hierarquia fica explícita: modal < XP < cinematic. A fila/dedupe atual é preservada; somente cinematics fullscreen suspendem a apresentação, e a suspensão de combate passa a refletir o cinematic real em vez de inferir pela stage do snapshot.

**Tech Stack:** Next.js 16, React 19, TypeScript, React DOM portals, CSS Modules, Node test runner.

**Spec:** `docs/progression/battle-pass/SPEC.md`

## Global Constraints

- Mostrar somente eventos de XP autoritativos já validados pelo servidor.
- Eventos com `xp <= 0` continuam sem feedback visual.
- Não recalcular XP no cliente.
- Não agregar nem descartar eventos válidos da fila: cada ação com XP confirmado deve produzir seu feedback.
- Feedback permanece `pointer-events: none`.
- Feedback não pode capturar foco.
- Modais de jogo não suspendem nem escondem XP.
- Cinematics fullscreen podem suspender a apresentação; o timer do feedback só começa quando o evento realmente pode ser visto.
- Preservar dedupe por `event.id`, fila FIFO, `aria-live` e reduced motion.
- Sem dependências novas.
- Não alterar regras/valores de XP, banco ou economia.

## Review Focus

- **Modal aberto:** card trade, combate, evento temporal, saída e vitória não podem cobrir XP.
- **Cinematic de combate:** evento recebido durante dados 3D deve permanecer na fila e aparecer depois que o cinematic terminar.
- **Burst de eventos:** múltiplos eventos válidos devem aparecer em ordem, sem coalescer ou perder itens.
- **Mobile:** feedback deve respeitar safe area e não ficar fora da viewport.
- **Acessibilidade:** portal visual continua sem interação, enquanto o anúncio permanece `aria-live="polite"`.

---

### Task 1: Tornar o feedback de XP uma camada global acima dos modais

**Files:**
- Modify: `src/components/progression/battle-pass/game-xp-feedback.tsx`
- Modify: `src/components/progression/battle-pass/game-xp-feedback.module.css`
- Modify: `src/app/game/[roomId]/game-ui-refresh.css`
- Modify: `src/components/dice-3d/battle-dice-cinematic.module.css`
- Modify: `tests/battle-pass-game-xp-feedback.test.mjs`

**Interfaces:**
- Consumes: `GameXpFeedback({ event, announcement })`.
- Produces: feedback renderizado com `createPortal(..., document.body)` e stack global `modal < XP < cinematic`.

- [ ] **Step 1: Escrever teste RED para portal e hierarquia global**

Em `tests/battle-pass-game-xp-feedback.test.mjs`, exigir:

- `game-xp-feedback.tsx` importa `createPortal`;
- portal usa `document.body`;
- root visual é `position: fixed`, não `absolute`;
- `--z-game-xp-feedback: 110`;
- `--z-game-cinematic: 120`;
- cinematic usa `var(--z-game-cinematic, 120)`;
- modal permanece em 80/81;
- XP mantém `pointer-events: none`.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run:

```bash
node --test tests/battle-pass-game-xp-feedback.test.mjs
```

Expected: FAIL porque o XP ainda é `absolute` e não usa portal.

- [ ] **Step 3: Portalizar `GameXpFeedback`**

Em `game-xp-feedback.tsx`:

- importar `createPortal` de `react-dom`;
- manter o conteúdo visual e live region dentro de uma única root;
- se `document` não estiver disponível, retornar `null`;
- renderizar a root em `document.body`.

Não criar estado global ou provider novo.

- [ ] **Step 4: Fixar a camada no viewport**

Em `game-xp-feedback.module.css`:

```text
.root
position: fixed
inset: 0
z-index: var(--z-game-xp-feedback, 110)
pointer-events: none
```

Manter `overflow: hidden` e isolamento do feedback.

A posição continua top-center, mas deve ficar em uma faixa previsível acima do conteúdo central dos modais.

- [ ] **Step 5: Formalizar stack de jogo**

Em `game-ui-refresh.css`:

```text
map              5
map overlay     20
tooltip         30
HUD             40
modal backdrop  80
modal surface   81
toast           90
XP             110
cinematic      120
```

Em `battle-dice-cinematic.module.css`, trocar o `120` hard-coded por `var(--z-game-cinematic, 120)`.

- [ ] **Step 6: Rodar teste GREEN**

Run:

```bash
node --test tests/battle-pass-game-xp-feedback.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/progression/battle-pass/game-xp-feedback.tsx \
  src/components/progression/battle-pass/game-xp-feedback.module.css \
  src/app/game/[roomId]/game-ui-refresh.css \
  src/components/dice-3d/battle-dice-cinematic.module.css \
  tests/battle-pass-game-xp-feedback.test.mjs
git commit -m "fix(game): render xp feedback above gameplay modals"
```

---

### Task 2: Suspender XP somente durante cinematics realmente ativos

**Files:**
- Modify: `src/components/battle-overlay.tsx`
- Modify: `src/components/game-client-v2.tsx`
- Modify: `tests/battle-pass-game-xp-feedback.test.mjs`
- Modify: `tests/game-display.test.mjs`

**Interfaces:**
- `BattleOverlay` passa a aceitar:
  `onCinematicStateChange?: (active: boolean) => void`.
- `GameReadyClient` mantém `battleCinematicActive: boolean`.
- `useGameXpFeedback(roomId, { suspended })` permanece sem mudança de assinatura.

- [ ] **Step 1: Escrever teste RED para suspensão baseada no cinematic real**

Exigir que:

- `GameClient` não derive suspensão de `snapshot.room.battle?.stage === "show_attacker_result"/"show_defender_result"`;
- `BattleOverlay` publique o valor de `cinematicActive` para o pai;
- `GameClient` use `orderCinematicActive || battleCinematicActive`;
- cleanup do overlay publique `false`.

- [ ] **Step 2: Rodar testes e confirmar falha**

Run:

```bash
node --test tests/battle-pass-game-xp-feedback.test.mjs tests/game-display.test.mjs
```

Expected: FAIL porque a suspensão de batalha ainda é inferida pela stage.

- [ ] **Step 3: Expor estado do cinematic no `BattleOverlay`**

Adicionar prop opcional:

```ts
onCinematicStateChange?: (active: boolean) => void
```

Usar `useEffect` dependente de `cinematicActive`:

- publicar `true` quando cinematic começa;
- publicar `false` quando termina;
- cleanup garante `false` em unmount.

Não mover o estado local de `completedPresentationId`.

- [ ] **Step 4: Controlar suspensão no `GameReadyClient`**

Adicionar:

```ts
const [battleCinematicActive, setBattleCinematicActive] = useState(false);
```

Trocar:

```text
orderCinematicActive || battleDiceCinematicPending
```

por:

```text
orderCinematicActive || battleCinematicActive
```

Passar `onCinematicStateChange={setBattleCinematicActive}` ao `BattleOverlay`.

Resultado esperado:

- modal de combate aberto: XP pode aparecer;
- cinematic de dados ativo: XP fica na fila;
- cinematic termina: primeiro XP pendente começa imediatamente, mesmo se o modal de combate continuar aberto.

- [ ] **Step 5: Rodar testes GREEN**

Run:

```bash
node --test tests/battle-pass-game-xp-feedback.test.mjs tests/game-display.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/battle-overlay.tsx \
  src/components/game-client-v2.tsx \
  tests/battle-pass-game-xp-feedback.test.mjs \
  tests/game-display.test.mjs
git commit -m "fix(game): present queued xp after dice cinematics"
```

---

### Task 3: Reforçar legibilidade e contrato de “todo XP confirmado aparece”

**Files:**
- Modify: `src/components/progression/battle-pass/game-xp-feedback.module.css`
- Modify: `src/hooks/use-game-xp-feedback.ts` only if tests reveal queue regression
- Modify: `tests/battle-pass-game-xp-feedback.test.mjs`
- Modify: `docs/progression/battle-pass/SPEC.md`

**Interfaces:**
- Preserva:
  - `seenRef`;
  - `seenOrderRef`;
  - `queueRef`;
  - `activeRef`;
  - duração por intensidade;
  - `aria-live="polite"`.

- [ ] **Step 1: Adicionar testes de regressão da fila**

Cobrir por source/contract:

- eventos `xp <= 0` são ignorados;
- IDs repetidos são ignorados;
- eventos válidos entram em `queueRef.current.push(event)`;
- `presentNext` não remove evento enquanto `suspendedRef.current` é true;
- ao dessuspender, `presentNextRef.current()` é chamado;
- modais não participam da condição `suspended`.

- [ ] **Step 2: Reforçar contraste sem criar modal/card**

No CSS do notice:

- manter texto/valor centrado;
- preservar brass para o valor de XP;
- adicionar backing/halo sutil suficiente para leitura sobre backdrop/modal claro ou escuro;
- não adicionar borda pesada;
- `pointer-events: none`.

Desktop: manter faixa superior central.

Mobile:

```text
top: calc(env(safe-area-inset-top, 0px) + ~72–96px)
width: min(94vw, 390px)
```

A posição final deve evitar o topo do browser/safe area e não cobrir a principal área de ação do modal.

- [ ] **Step 3: Atualizar o SPEC**

Em `docs/progression/battle-pass/SPEC.md`, substituir o contrato legado:

```text
position: absolute
z-index: 99
```

pelo contrato:

```text
portal: document.body
position: fixed
z-index: 110
pointer-events: none
modal < xp < cinematic
```

Documentar:

- todo evento autoritativo com XP positivo entra na fila;
- modal não suspende;
- cinematic pode suspender;
- timer só corre quando o evento está sendo apresentado.

- [ ] **Step 4: Rodar regressão focada**

Run:

```bash
node --test \
  tests/battle-pass-game-xp-feedback.test.mjs \
  tests/game-display.test.mjs \
  tests/game-victory-flow.test.mjs \
  tests/game-elimination-card-rules.test.mjs \
  tests/game-temporal-anomaly-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Rodar checks finitos**

Run:

```bash
npm run test:compile
npx eslint \
  src/components/progression/battle-pass/game-xp-feedback.tsx \
  src/hooks/use-game-xp-feedback.ts \
  src/components/game-client-v2.tsx \
  src/components/battle-overlay.tsx
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/progression/battle-pass/game-xp-feedback.module.css \
  src/hooks/use-game-xp-feedback.ts \
  tests/battle-pass-game-xp-feedback.test.mjs \
  docs/progression/battle-pass/SPEC.md
git commit -m "test(game): lock visible xp feedback contract"
```

Só incluir `use-game-xp-feedback.ts` no commit se ele realmente precisar mudar.

---

## Acceptance Criteria

1. Colocar tropas com XP positivo mostra feedback.
2. Troca de cartas com XP positivo mostra feedback mesmo com modal.
3. Resultado de combate mostra XP depois do cinematic e acima do modal de combate.
4. Conquista/reconquista mostra XP acima da UI de combate.
5. XP terminal aparece acima do modal de vitória.
6. XP ao sair fica visível acima do modal de saída antes da navegação.
7. Nenhum evento duplicado aparece duas vezes.
8. Eventos zero-XP continuam silenciosos.
9. XP nunca bloqueia clique, toque ou teclado.
10. Reduced motion continua funcional.
11. Cinematic continua acima do XP.
12. Modais ficam abaixo do XP.
