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

XYZ, quaternion, FOV, materiais e luz são privados. `scene-presets.ts` + `CameraDirector` traduzem intenção em câmera internamente. Mudança de intent atualiza o mesmo `Canvas`; não existe `key` por modo nem renderer por página.

## Boundaries

- `CommandShell`: boundary cliente pequeno que recebe conteúdo renderizável independentemente de WebGL.
- `CommandScene`: progressive enhancement, lazy-loaded, com fallback 2D permanente por baixo da camada WebGL e error boundary.
- `CommandSceneCanvas`: único renderer R3F, objetos físicos e CameraDirector.
- `command-primitives.tsx`: labels, status, painéis mínimos e insígnia sem regra de negócio.
- `foundation-tokens.ts`: cor, spacing, depth, material, motion, blur/z-index e limites de cena.

Pages não importam Three.js nem recebem coordenadas.

## Brasil canônico

A cena carrega exclusivamente `/war-brasil-42.production.svg` via `SVGLoader`. Cada path canônico vira uma placa extrudada, mantendo X/Y do SVG. `territoryExplode` só introduz separação mínima no eixo Z; não espalha territórios no plano e não altera fronteiras ou identidade. Edges douradas mantêm as fronteiras perceptíveis.

O fallback usa o mesmo SVG, evitando uma segunda geometria territorial.

## Objetos de assinatura

- `StrategicGlobe`: visível em `entrance`/foco `earth`, recua fora desses estados.
- `DomainTable`: eixo espacial persistente.
- `BrazilTerritoryAssembly`: 42 placas físicas.
- `OrbitalCrown`: três aros nomeados e materialmente distinguíveis — Território, Comando e Conflito.
- `CommandInsignia`: objeto físico de foco + primitive DOM acessível para Lobby/Perfil.

## Performance

- WebGL é carregado por `next/dynamic` com `ssr:false`; conteúdo do `CommandShell` não depende dele.
- DPR é limitado a 1.5 desktop e 1.1 em pointer coarse/memória restrita.
- geometrias do SVG e materiais são memoizados e descartados no unmount.
- sem sombras dinâmicas ou pós-processamento.
- `prefers-reduced-motion` troca para `frameloop="demand"`, congela idle loops e aplica câmera diretamente ao estado final.
- `useFrame` altera apenas objetos Three/câmera, nunca React state.

## Fallback e falhas

Fallback 2D renderiza imediatamente Mesa, Brasil e três aros antes do chunk 3D. Se a cena lançar erro ou o contexto WebGL for perdido, o Canvas é removido e o fallback permanece. Conteúdo/ações pertencem ao DOM acima da cena e continuam intactos.

## Rastreabilidade FND

| Gate | Evidência de implementação |
| --- | --- |
| FND-01 | conteúdo fica em `shellContent`; fallback independe do Canvas |
| FND-02 | um `CommandScene`/Canvas sem `key` por mode; intent por props |
| FND-03 | matchMedia + demand frameloop + CameraDirector snap |
| FND-04 | package/lockfile não são alterados |
| FND-05 | CI obrigatório antes de merge |
| FND-06 | Foundation não expõe ação baseada em hover |
| FND-07 | vignette/atmosphere DOM protege contraste do conteúdo |
| FND-08 | teste estrutural exige exatamente ids 1..42 |
| FND-09 | mesma geometria SVG; explode somente em Z |
| FND-10 | sem alteração X/Y por explode |
| FND-11 | `EdgesGeometry` + material de borda compartilhado |
| FND-12 | territórios Foundation são cenográficos; nenhuma hit-area reduzida é usada |
| FND-13 | teste exige exatamente um `<Canvas>` |
| FND-14 | fallback fica montado durante loading/falha; intent não desmonta shell |
| FND-15 | aros nomeados Territory/Command/Conflict |
| FND-16 | objetos não carregam regra funcional e possuem estados determinísticos |
| FND-17 | sem flicker/pulse; idle somente rotações muito lentas |
| FND-18 | câmera não altera geometria; edges permanecem no assembly |
| FND-19 | Foundation não seleciona território; gestos não disparam ação territorial |
| FND-20 | path order/id vêm diretamente do SVG canônico |

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
8. inspeção visual dos estados estáveis definidos no EVAL quando as páginas consumidoras montarem o Foundation;
9. avaliação cruzada das cinco rotas após integração das trilhas de página.

Foundation deve ser mergeada antes das páginas consumidoras, conforme `parallel-development.md`; este branch não faz merge automático em `dev`.
