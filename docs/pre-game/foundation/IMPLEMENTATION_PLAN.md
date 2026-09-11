# FOUNDATION — plano técnico

Branch: `feature/pre-game-foundation`

## Leitura normativa

A Foundation não é uma nova rota nem a implementação da Home. Ela é a infraestrutura compartilhada que Home, Operações, Lobby, Doutrina e Perfil consomem. O branch, portanto, não altera `/`, `/matchmaking`, `/lobby/[code]`, regras, banco ou realtime.

A hierarquia aplicada foi: `quality-standard.md` -> `traceability.md` -> `visual-language.md` -> `parallel-development.md` -> `foundation/SPEC.md` -> `foundation/EVAL.md` -> código atual.

## Contrato público

`CommandSceneIntent` fica em `scene-contract.ts` e expõe somente significado:

- `mode`: `entrance | operations | lobby | doctrine | profile`;
- `focus`: `earth | brazil | table | insignia | none`;
- `conflictLevel`: `0..3`;
- `territoryExplode`: normalizado para `0..1`;
- `orbitalAlignment`: `0 | 1`.

XYZ, quaternion, FOV, breakpoint, materiais e luz são privados. `scene-presets.ts` + `CameraDirector` traduzem intenção em câmera internamente. Mudança de intent atualiza o mesmo `Canvas`; não existe `key` por modo nem renderer por página.

`index.ts` não exporta `CommandScene` nem `CommandSceneCanvas`, reduzindo a chance de uma página consumidora criar um renderer próprio. O ponto normal de entrada é `CommandShell` + primitives/contrato declarativo.

## Boundaries

- `CommandShell`: server-compatible; recebe conteúdo renderizável independentemente de WebGL.
- `CommandScene`: pequena boundary cliente para media queries, fallback e lazy-load do renderer.
- `CommandSceneCanvas`: único renderer R3F, objetos físicos e `CameraDirector`.
- `command-primitives.tsx`: labels, status, painéis mínimos e insígnia sem regra de negócio.
- `foundation-tokens.ts`: cor, spacing, depth, material, motion, blur/z-index e limites de cena.
- `eval-fixtures.ts`: estados/viewports determinísticos do EVAL; não faz parte do barrel público.

Pages não importam Three.js nem recebem coordenadas.

## Brasil canônico

A cena carrega exclusivamente `/war-brasil-42.production.svg` via `SVGLoader`. Cada path territorial precisa declarar seu `data-id` canônico entre 1 e 42; ausência, duplicação ou lacuna faz a montagem 3D falhar para o error boundary, mantendo o fallback 2D funcional. Não existe fallback semântico por posição do path.

Cada path canônico vira apresentação extrudada mantendo X/Y do SVG. `territoryExplode` só introduz separação mínima no eixo Z; não espalha territórios no plano e não altera fronteiras ou identidade. Materiais e separação visual derivam do ID territorial estável, e não da ordem física do elemento no arquivo. `EdgesGeometry` mantém as fronteiras perceptíveis.

O fallback usa o mesmo SVG, evitando uma segunda geometria territorial.

## Objetos de assinatura

- `StrategicGlobe`: visível em `entrance`/foco `earth`, recua fora desses estados.
- `DomainTable`: eixo espacial persistente.
- `BrazilTerritoryAssembly`: conjunto físico dos 42 territórios.
- `OrbitalCrown`: três aros nomeados e materialmente distinguíveis — Território, Comando e Conflito.
- `CommandInsignia`: objeto físico de foco + primitive DOM acessível para Lobby/Perfil.

## Responsividade

Mobile/tablet não reutiliza cegamente a câmera desktop.

- `CommandScene` observa `(max-width: 900px)` internamente;
- 390x844 e 768x1024 entram na composição compacta exigida pelo EVAL;
- `scene-presets.ts` possui poses de câmera/foco compactas separadas das desktop;
- a cena compacta reduz escala da Mesa/Brasil/Coroa, reposiciona Globo/Insígnia e remove rails arquitetônicos não essenciais;
- DPR compact é limitado ao perfil reduzido;
- o fallback 2D usa o mesmo breakpoint de 900px, mantendo hierarquia consistente quando WebGL falha.

Nenhum breakpoint ou parâmetro de câmera entra em `CommandSceneIntent`.

## Performance

- WebGL é carregado por `next/dynamic` com `ssr:false`; conteúdo do `CommandShell` não depende dele.
- DPR é limitado a 1.5 no perfil desktop e 1.1 em reduced-motion, pointer coarse ou composição compacta.
- geometrias do SVG e materiais são memoizados e descartados no unmount.
- sem sombras dinâmicas ou pós-processamento.
- `prefers-reduced-motion`, pointer coarse e breakpoint compacto são lidos por `useSyncExternalStore`, sem setState de sincronização em effect.
- `prefers-reduced-motion` troca para `frameloop="demand"`, congela loops ornamentais, aplica câmera diretamente ao estado final e normaliza ângulos de Globo/Coroa para poses determinísticas.
- `useFrame` altera apenas objetos Three/câmera, nunca React state.

## Fallback e falhas

Fallback 2D renderiza imediatamente Mesa, Brasil e três aros antes do chunk 3D. O Canvas começa com `opacity: 0` e só passa a `ready` depois que o `BrazilTerritoryAssembly` carregou e validou o SVG canônico. Assim, o renderer opaco não cobre o fallback durante loading.

Se a cena lançar erro, a identidade territorial do SVG estiver inválida ou o contexto WebGL for perdido, o Canvas é removido e o fallback permanece. Conteúdo/ações pertencem ao DOM acima da cena e continuam intactos.

## Estados determinísticos para avaliação

`eval-fixtures.ts` fixa os viewports normativos:

- 390x844;
- 768x1024;
- 1440x900;
- 1920x1080.

Também fixa intents para:

- `entrance-idle`;
- `operations-focus`;
- `lobby`;
- `doctrine`;
- `profile`;
- `conflict-authorized`.

`reduced-motion` e `fallback` são estados de ambiente separados. As fixtures não usam relógio, aleatoriedade ou dados externos. A captura visual continua devendo ocorrer no mesmo ambiente estável definido pelo `quality-standard.md` quando houver harness/browser integrado às páginas.

## Rastreabilidade FND

| Gate | Evidência atual | Estado isolado |
| --- | --- | --- |
| FND-01 | `shellContent` independe do Canvas; fallback 2D sempre montado | automatizado/inspection |
| FND-02 | um `CommandScene`/Canvas sem `key` por mode; intent por props | automatizado/inspection |
| FND-03 | demand frameloop + câmera snap + Globo/Coroa normalizados | automatizado/inspection |
| FND-04 | package/lockfile não são alterados | diff |
| FND-05 | workflow obrigatório: lint/test/build + gates existentes | CI |
| FND-06 | cena é `pointer-events:none`; nenhuma ação territorial/hover funcional | automatizado/inspection |
| FND-07 | atmosphere DOM e primitives/painéis independem da luz 3D | inspection; visual integrado pendente |
| FND-08 | teste estrutural e runtime exigem exatamente `data-id` 1..42 | automated |
| FND-09 | mesma geometria SVG; explode somente em Z | automated/inspection |
| FND-10 | sem alteração X/Y por explode; layout move conjunto como unidade | automated/inspection; visual pendente |
| FND-11 | `EdgesGeometry` + material de borda persistente | inspection; visual desktop/mobile pendente |
| FND-12 | territórios Foundation são cenográficos e não possuem handlers/hit-area própria | automated; interação N/A neste estágio |
| FND-13 | teste exige exatamente um `<Canvas>`; renderer não é exportado no barrel | automated/inspection |
| FND-14 | Canvas oculto até assembly ready; fallback permanece durante loading/falha | automated/inspection; sequência visual integrada pendente |
| FND-15 | aros nomeados Territory/Command/Conflict e materialmente distintos | automated/inspection; visual pendente |
| FND-16 | posições/escala/fixtures determinísticas; objetos não são dependência funcional | automated/inspection |
| FND-17 | sem flicker/pulse; idle somente rotações lentas | inspection; visual pendente |
| FND-18 | câmera não altera geometria; edges permanecem no assembly | inspection; visual de aproximação pendente |
| FND-19 | assembly não possui handlers; gesto não pode selecionar território | automated; interação N/A neste estágio |
| FND-20 | identidade vem de `data-id`; ordem física dos paths não é fonte semântica | automated/inspection |

`N/A neste estágio` não significa gate removido: FND-12/FND-19 voltam a exigir teste de interação caso uma página futura habilite interação territorial no pré-jogo.

## Pesquisa aplicada

- Next.js — Server/Client Components: manter Client Components nas fronteiras interativas e conteúdo estático/server quando possível.
- Next.js — lazy loading/dynamic import: adiar o renderer pesado sem bloquear conteúdo.
- React Three Fiber — scaling performance: reutilizar geometria/material, limitar DPR e usar on-demand rendering quando a cena não precisa de loop.
- MDN/WCAG — `prefers-reduced-motion`: retirar motion ornamental preservando significado e função.

## Validação antes do merge

1. `npm ci` e `npm --prefix realtime ci`;
2. audits já existentes do workflow;
3. `npm run lint`;
4. `npm test`;
5. migrations em PostgreSQL real;
6. `npm run realtime:test`;
7. `npm run build`;
8. inspeção visual dos estados estáveis definidos no EVAL quando as páginas consumidoras montarem a Foundation;
9. avaliação cruzada das cinco rotas após integração das trilhas de página.

Foundation deve ser mergeada antes das páginas consumidoras, conforme `parallel-development.md`; este branch não faz merge automático em `dev`.
