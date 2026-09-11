# PLAN — Operações

**Branch:** `feature/pre-game-operations`  
**Base atual:** `dev@2083579396e108349d6983e40120aaccf5d1d1dd`  
**Rota:** `/matchmaking`  
**Cena:** `operations`  
**Objetivo:** fechar o EVAL de Operations sem alterar API, banco, realtime ou regras de jogo.

## 1. Estado atual

A implementação local da página já cobre a maior parte do comportamento e da composição 2D:

- `/matchmaking` continua Server Component;
- `OperationsConsole` concentra somente interação local;
- Create/Join aparecem como dois modos da mesma estação;
- endpoints e redirects vigentes foram preservados;
- proteção síncrona contra double-submit existe em Create e Join;
- timeout/rede são tratados com `AbortController` e retry;
- input de código continua sendo um único `<input>` real;
- código digitado permanece após erro;
- estados semânticos do SPEC estão representados (`creating`, `create-error`, `joining`, `invalid-code`, `network-error`, `success-transition` + interações de foco/digitação);
- mobile possui recomposição própria para viewport baixo/teclado aberto;
- reduced-motion e fallback 2D existem sem dependência de WebGL;
- o diff contra `dev` não toca API, banco ou realtime;
- Vercel está verde no HEAD `11335deb3a951880acd135783ea9fe82bf0ffdbf`.

O déficit atual está principalmente em **prova dos blockers**, integração com a Foundation real e validação visual/manual reproduzível.

## 2. Dependência Foundation

A Foundation já publicou em `feature/pre-game-foundation`:

- `CommandShell`;
- `CommandSceneIntent`;
- `CommandScene` privado/lazy;
- fallback 2D;
- Brasil canônico de 42 territórios;
- Mesa de Domínio;
- Coroa Orbital;
- DPR/adaptação mobile;
- reduced-motion.

O contrato público real é pequeno e declarativo:

```ts
type CommandSceneIntent = {
  mode: "entrance" | "operations" | "lobby" | "doctrine" | "profile";
  focus?: "earth" | "brazil" | "table" | "insignia" | "none";
  conflictLevel?: 0 | 1 | 2 | 3;
  territoryExplode?: number;
  orbitalAlignment?: 0 | 1;
};
```

O preset de avaliação de Operations da Foundation usa:

```ts
{
  mode: "operations",
  focus: "brazil",
  conflictLevel: 0,
  territoryExplode: 0.08,
  orbitalAlignment: 0,
}
```

**Regra de integração:** não copiar código da Foundation nem integrar sua branch diretamente. Conforme `parallel-development.md`, Foundation deve entrar primeiro em `dev`; depois Operations sincroniza com `dev` e consome somente o barrel público.

## 3. Mapa dos BLOCKERs

| Gate | Estado | Falta concreta |
| --- | --- | --- |
| OPS-01 Create → lobby correto | PARCIAL | contrato preservado, falta prova de execução real |
| OPS-02 Join válido → lobby correto | PARCIAL | contrato preservado, falta prova de execução real |
| OPS-03 Código inválido recuperável | PARCIAL | DOM/estado implementados, falta cenário real documentado |
| OPS-04 Rede/timeout sem loading eterno | PARCIAL | timeout e liberação implementados, falta prova controlada |
| OPS-05 teclado/seleção/paste | PARCIAL | input nativo correto, falta interaction/manual evidence |
| OPS-06 WebGL/reduced-motion | PARCIAL | fallback local existe; precisa ser revalidado após Foundation |
| OPS-07 sem mudança API/realtime/DB | FORTE | diff atual comprova isolamento; revalidar após sync |
| OPS-08 double-submit | PARCIAL | `useRef` síncrono + disabled existem; falta prova de 1 request |
| OPS-09 normalização vigente | FORTE/PARCIAL | código vigente preservado e servidor conferido; falta teste comportamental puro |
| OPS-10 erro preserva input/retry | PARCIAL | estado preservado por implementação; falta cenário real |
| OPS-11 Brasil/Foundation | BLOQUEADO | aguardar Foundation em `dev` e integrar contrato público |
| OPS-12 mesma máquina, não cards | PARCIAL | arquitetura visual implementada; falta revisão visual final integrada |

Nenhum gate deve ser marcado como aprovado apenas por inspeção quando o EVAL pede interaction/e2e/manual/visual.

## 4. Estratégia técnica

### Princípio 1 — manter Server/Client boundary mínima

`src/app/matchmaking/page.tsx` permanece Server Component. `OperationsConsole` continua sendo a menor fronteira cliente que possui estado de UI.

Não transformar `CommandShell` inteiro em estado cliente apenas para animar a cena. O intent inicial de Operations pode ser estático e serializável; os estados de foco/erro continuam mudando a estação DOM local. Isso mantém o bundle cliente menor e evita acoplar estado de negócio/cena.

### Princípio 2 — Foundation substitui assinatura visual duplicada

Após Foundation entrar em `dev`:

1. trocar o shell legado de Operations por `CommandShell` público;
2. enviar o intent canônico de Operations (`mode: operations`, `focus: brazil`, `territoryExplode: 0.08`);
3. remover da página qualquer Brasil/Coroa local que duplique os objetos de assinatura pertencentes à Foundation;
4. manter na página apenas a Mesa de Autorização DOM, modos, formulários, telemetria e feedback funcional;
5. não importar `CommandScene`, Canvas, Three, CameraDirector ou CSS interno da Foundation.

O fallback passa a ser responsabilidade do `CommandShell/CommandScene`; a página deve continuar funcional se a camada de cena permanecer somente no fallback.

### Princípio 3 — comportamento testável sem duplicar regra

Extrair somente funções puras da camada de UI quando isso permitir teste comportamental real, sem criar uma segunda validação.

Candidato:

`src/lib/client/operations/room-code.ts`

```ts
export function normalizeOperationsRoomCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}
```

O `JoinRoomForm` usa essa função; `tsconfig.test.json` compila o helper; `tests/operations-page.test.mjs` testa entradas/saídas reais em `.test-build`.

Isso cobre a normalização vigente como comportamento, não apenas regex sobre código-fonte.

Não replicar a validação autoritativa `/^[A-Z0-9]{6}$/` do servidor no cliente. O servidor continua sendo fonte de verdade para validade do código.

### Princípio 4 — não adicionar framework de E2E só para esta trilha

O projeto não possui Playwright/Cypress hoje. Não adicionar dependência e lockfile churn apenas para Operations.

Automatizar o que cabe no runner Node atual e fechar o restante com roteiro manual reproduzível no preview/PR. Se o projeto adotar Playwright de forma compartilhada, migrar os cenários visuais para `toHaveScreenshot()` no mesmo ambiente usado pela CI.

## 5. Fases de implementação restantes

### Fase A — fortalecer regressão funcional local

**Objetivo:** substituir asserções frágeis de texto-fonte por testes de comportamento onde possível.

Mudanças previstas:

- criar helper puro de normalização de código em `src/lib/client/operations/`;
- usar o helper no `JoinRoomForm` sem mudar o resultado vigente;
- incluir o helper em `tsconfig.test.json`;
- adicionar casos reais: trim, uppercase recebido do usuário, caracteres inválidos, hífen e vazio;
- manter testes de inspeção apenas para endpoints/redirects/import boundaries.

Gate principal: OPS-09.

### Fase B — documentação executável dos cenários OPS-S1..S10

**Objetivo:** tornar a validação manual reproduzível em vez de subjetiva.

Adicionar em `docs/pre-game/operations/` um checklist de evidência contendo para cada cenário:

- pré-condição;
- ação;
- estado esperado;
- evidência a capturar;
- viewport;
- resultado PASS/FAIL.

Cobrir explicitamente:

- create normal;
- join digitado;
- paste completo;
- inválido → corrigir → retry;
- network failure/timeout → retry;
- double-click/double-submit;
- alternar modos preservando código;
- reduced-motion;
- fallback WebGL;
- 390x844 com teclado aberto.

Gates principais: OPS-01..10.

### Fase C — integrar Foundation depois do merge em `dev`

**Pré-condição obrigatória:** PR da Foundation mergeado em `dev`.

Passos:

1. sincronizar `feature/pre-game-operations` com o `dev` novo;
2. resolver conflitos sem reformatar arquivos compartilhados;
3. importar apenas de `@/src/components/pre-game/foundation`;
4. trocar `WarShell` por `CommandShell` no nível Server Component;
5. aplicar intent `operations-focus` equivalente;
6. remover Brasil/Coroa/fallback visual duplicados de `OperationsConsole`;
7. adaptar CSS local para funcionar sobre os tokens/chrome da Foundation, sem importar CSS interno;
8. preservar navegação de retorno como elemento DOM próprio da página se `CommandShell` não oferecer esse controle;
9. confirmar que Create/Join continuam independentes do carregamento da cena.

Gates principais: OPS-06, OPS-11, OPS-12.

### Fase D — polish visual integrado

**Objetivo:** ajustar Operations olhando a composição final real, não o mock 2D isolado.

Validar e corrigir:

- hierarquia entre cena Foundation e painel funcional;
- legibilidade com iluminação extrema;
- ausência de Brasil/Coroa duplicados;
- vermelho restrito a erro/conflito;
- foco sem layout shift;
- mapa/fronteiras legíveis em 1440x900 e 390x844;
- CTA e input não cobertos pela cena;
- mobile com teclado aberto;
- targets touch confortáveis (o código atual usa ~52 px, acima do mínimo WCAG 2.2 de 24x24 px);
- reduced-motion sem perda de conteúdo ou função.

Gates principais: OPS-05, OPS-06, OPS-11, OPS-12.

### Fase E — validação automatizada oficial

Como o workflow principal roda em PR, abrir PR draft de Operations **somente quando a implementação integrada estiver pronta para avaliação**.

Executar/observar:

```bash
npm ci
npm --prefix realtime ci
npm run lint
npm test
npm run build
```

Também conferir que o diff final continua sem alterações em:

- `src/app/api/**`;
- contratos realtime;
- migrations/schema;
- `package.json`/lockfile, salvo decisão explícita externa a esta trilha.

Gate: Definition of Done comum + OPS-07.

### Fase F — evidência visual/manual e score final

Capturar nos dois viewports obrigatórios:

- 1440x900;
- 390x844.

Estados:

- idle;
- create-focus;
- creating;
- typing-code;
- invalid-code;
- network-error;
- reduced-motion;
- fallback.

Registrar score por categoria do `EVAL.md`; aprovação exige >=85 **e todos os blockers verdes**.

## 6. Arquivos que Operations pode tocar

Esperados:

- `src/app/matchmaking/page.tsx`;
- `src/app/matchmaking/*.module.css`;
- `src/components/operations-console.tsx`;
- `src/components/operations-types.ts`;
- `src/components/operations-request.ts`;
- `src/components/create-room-button.tsx`;
- `src/components/join-room-form.tsx`;
- `src/lib/client/operations/*` para helpers puros testáveis;
- `tests/operations-page.test.mjs`;
- `tsconfig.test.json` apenas para compilar helper local;
- `docs/pre-game/operations/*` para evidência/planejamento.

Após Foundation estar em `dev`, Operations pode **consumir** `src/components/pre-game/foundation/index.ts`, mas não editar internals da Foundation nesta branch.

## 7. Não fazer

- não criar outro renderer/Canvas;
- não copiar `CommandScene`/Mesa/Brasil/Coroa para Operations;
- não mover validação autoritativa do servidor para o cliente;
- não alterar endpoints/payload/redirect;
- não adicionar Playwright/Cypress/UI kit/animation library só para esta página;
- não transformar toda a rota em Client Component;
- não mergear Foundation dentro de Operations antes dela chegar a `dev`;
- não marcar gate manual/visual como aprovado sem evidência reproduzível.

## 8. Ordem recomendada

1. **Fase A** — regressão funcional pura e barata;
2. **Fase B** — roteiro de evidência OPS-S1..S10;
3. aguardar Foundation entrar em `dev`;
4. **Fase C** — sync + integração do contrato público;
5. **Fase D** — polish visual sobre a cena real;
6. **Fase E** — PR draft + CI completo;
7. **Fase F** — evidência visual/manual + score final;
8. somente então considerar Operations pronta para merge.

## 9. Critério de saída

Operations estará concluída quando:

- OPS-01..OPS-12 tiverem evidência apropriada;
- score >=85/100;
- GitHub Actions estiver verde no HEAD integrado;
- Vercel/preview estiver funcional;
- desktop/mobile/reduced-motion/fallback tiverem evidência;
- a página consumir a Foundation efetivamente presente em `dev`;
- não houver Brasil/Coroa/renderer concorrente local;
- diff final continuar isolado do backend/multiplayer.
