# PROFILE — EVAL Runbook

Branch: `feature/pre-game-profile`  
Rota: `/profile`

Este roteiro produz evidência reproduzível para `EVAL.md`. Ele não altera dados reais e não depende de query string ou mock público.

## Pré-condições

Antes de captura visual:

```bash
npm ci
npm --prefix realtime ci
npm run lint
npm test
npm run build
```

Se qualquer comando falhar, a evidência visual não substitui o gate técnico.

## Estados de dados

O harness é exclusivamente server-side:

```bash
# fluxo normal / partial-data
npm run dev

# guest
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=guest npm run dev

# loaded
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=loaded npm run dev

# empty-history
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-history npm run dev

# no-progression-system
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=no-progression-system npm run dev

# error boundary real
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=error npm run dev
```

Não usar query string, cookie ou edição do snapshot para selecionar estado.

## Viewports canônicos

Usar os mesmos valores de `foundation/eval-fixtures.ts`:

| Nome | Viewport |
| --- | --- |
| desktop | 1440 × 900 |
| mobile | 390 × 844 |

Mobile deve usar emulação de touch/coarse pointer quando o navegador de teste permitir.

## Matriz obrigatória de 16 capturas

Cada linha deve gerar uma captura desktop e uma mobile.

| Estado | Servidor / ambiente | Evidência principal |
| --- | --- | --- |
| `guest` | `PROFILE_EVAL_STATE=guest` | ausência de identidade sem login inventado |
| `partial-data` | fluxo normal | somente identidade local; demais fontes indisponíveis |
| `loaded` | `PROFILE_EVAL_STATE=loaded` | composição completa; fixture claramente rotulada |
| `empty-history` | `PROFILE_EVAL_STATE=empty-history` | arquivo disponível e vazio, sem aparência de erro |
| `no-progression-system` | `PROFILE_EVAL_STATE=no-progression-system` | progressão ausente; demais áreas preservadas |
| `error` | `PROFILE_EVAL_STATE=error` | `error.tsx` real + retry acessível |
| `reduced-motion` | `loaded` + `prefers-reduced-motion: reduce` | mesma hierarquia; indicação textual de motion reduzido |
| `fallback` | `loaded` + WebGL indisponível | fallback 2D Foundation + conteúdo HTML intacto |

Nomes sugeridos:

```text
profile-guest-desktop.png
profile-guest-mobile.png
profile-partial-data-desktop.png
profile-partial-data-mobile.png
profile-loaded-desktop.png
profile-loaded-mobile.png
profile-empty-history-desktop.png
profile-empty-history-mobile.png
profile-no-progression-desktop.png
profile-no-progression-mobile.png
profile-error-desktop.png
profile-error-mobile.png
profile-reduced-motion-desktop.png
profile-reduced-motion-mobile.png
profile-fallback-desktop.png
profile-fallback-mobile.png
```

## Como validar fallback

A captura de fallback só é válida quando a Foundation reportar `data-webgl="fallback"` no host da cena. A própria PROFILE deve exibir:

```text
Fallback 2D ativo; conteúdo HTML preservado
```

Não considerar como fallback uma captura feita apenas escondendo o Canvas por CSS/DevTools.

Em um harness de browser automatizado futuro, forçar indisponibilidade de WebGL antes da navegação, por exemplo interceptando `HTMLCanvasElement.getContext` para `webgl`/`webgl2` no init script. Isso deve ocorrer no teste, nunca no código de produção.

## Reduced motion

A evidência é válida somente quando:

```js
matchMedia('(prefers-reduced-motion: reduce)').matches === true
```

A PROFILE deve exibir `Movimento reduzido ativo`; conteúdo, ordem e ações devem permanecer equivalentes.

## Teclado — desktop

Em 1440×900:

1. abrir `/profile` sem mouse;
2. usar `Tab` até `Início`;
3. continuar até `Operações` quando presente;
4. no cenário `error`, alcançar `Tentar novamente`;
5. confirmar foco visual em todos os controles;
6. confirmar que nenhum conteúdo essencial exige hover.

Falha se o foco ficar invisível, encoberto ou preso.

## Touch — mobile

Em 390×844 com touch:

1. abrir cada estado da matriz;
2. rolar do topo até o último registro;
3. acionar `Início`, `Operações` e `Tentar novamente` quando aplicáveis;
4. confirmar ausência de conteúdo cortado horizontalmente;
5. confirmar que Insígnia, identidade, registros e honrarias permanecem legíveis;
6. confirmar que nenhuma ação depende de hover/perspectiva.

## Auditoria de dados

No fluxo normal, validar visualmente e por DOM:

- `Luigi` com origem `Perfil local temporário`;
- nenhuma patente real exibida;
- nenhuma estatística competitiva exibida;
- nenhum histórico inventado;
- nenhuma conquista inventada.

Nos cenários de EVAL, confirmar presença de `Modo de avaliação visual` e `Dados estruturais sintéticos` antes de aceitar qualquer registro preenchido como evidência.

## Histórico volumoso

O cenário `loaded` deve mostrar somente três campanhas e informar que existem registros adicionais. O snapshot deve manter `hasMore: true`.

O objetivo é provar janela limitada; não criar paginação/backend fictício para o redesign.

## Checklist PRO

| Gate | Evidência a anexar |
| --- | --- |
| PRO-01 | data review + partial/loaded |
| PRO-02 | guest/partial/empty/no-progression/error |
| PRO-03 | inspection do DOM/snapshot |
| PRO-04 | fallback 2D |
| PRO-05 | mobile 390×844 + touch |
| PRO-06 | reduced-motion desktop/mobile |
| PRO-07 | source/availability + labels de fixture |
| PRO-08 | guest sem novo fluxo auth |
| PRO-09 | loaded com 3 campanhas + `hasMore` |
| PRO-10 | Insígnia desktop/mobile/fallback |
| PRO-11 | loaded com nome + descrição das honrarias |
| PRO-12 | empty-history desktop/mobile |

## Critério de encerramento

A PROFILE só pode ser marcada como concluída quando:

- todos os comandos técnicos estiverem verdes;
- as 16 capturas existirem no mesmo ambiente estável;
- teclado, touch, reduced-motion e fallback tiverem evidência;
- todos os PRO-01…PRO-12 estiverem verdes;
- score final do `EVAL.md` for >= 85/100.
