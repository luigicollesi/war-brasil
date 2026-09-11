# Quality Standard — Pre-game Command Experience

Este documento define como interpretar e comprovar os requisitos de `docs/pre-game`.

## Linguagem normativa

Os termos `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT` e `MAY`, quando escritos em maiúsculas, seguem BCP 14 (RFC 2119 + RFC 8174).

- `MUST` / `MUST NOT`: requisito bloqueante.
- `SHOULD` / `SHOULD NOT`: expectativa forte; desvio exige justificativa no PR.
- `MAY`: decisão de implementação permitida, não obrigação.

Referências: https://www.rfc-editor.org/info/rfc2119/ e https://www.rfc-editor.org/info/rfc8174/

## Hierarquia de fontes de verdade

Em caso de conflito, usar esta precedência:

1. regras e contratos funcionais já implementados no código, banco e realtime;
2. `SPEC.md` da trilha;
3. `visual-language.md` e `foundation/SPEC.md`;
4. decisões de implementação registradas no PR;
5. exemplos ilustrativos do spec.

O redesign MUST NOT alterar regra de jogo, contrato de API, schema de banco ou protocolo realtime sem spec separado.

## Definition of Done comum

Uma trilha só pode ser considerada concluída quando:

- todos os gates `BLOCKER` passam;
- score >= 85/100;
- `npm test`, `npm run lint` e `npm run build` passam;
- desktop e mobile foram verificados;
- teclado e touch foram verificados quando houver interação;
- `prefers-reduced-motion: reduce` mantém conteúdo e função equivalentes;
- falha/ausência de WebGL mantém a rota funcional;
- não há regressão dos contratos funcionais existentes;
- conceitos `CORE` aplicáveis em `traceability.md` continuam presentes;
- evidências do PR permitem reproduzir a avaliação.

## Evidência mínima

Cada gate deve apontar para ao menos uma evidência adequada:

- `automated`: teste unitário, integração, e2e ou snapshot;
- `inspection`: diff, React profiler, DevTools ou inspeção semântica;
- `manual`: roteiro reproduzível com viewport/estado definidos;
- `visual`: screenshot determinístico do estado solicitado.

“Parece correto” ou screenshot sem indicar estado/viewport não é evidência suficiente.

## Visual regression

Quando Playwright for introduzido, preferir `expect(page).toHaveScreenshot()` ou equivalente oficial. Baselines MUST ser gerados e comparados no mesmo ambiente de navegador/SO usado pela CI, porque renderização pode variar entre ambientes.

Snapshots MUST congelar ou desabilitar animações, relógios, aleatoriedade, partículas e dados não determinísticos. Estados visuais importantes devem ser capturados separadamente; não usar um único screenshot como prova de toda a experiência.

Referência: https://playwright.dev/docs/test-snapshots

## Acessibilidade

Alvo: WCAG 2.2 AA para requisitos aplicáveis ao produto; critérios adicionais de motion podem ser adotados mesmo quando pertencem a nível superior.

MUST:

- manter foco visível;
- oferecer nome/label acessível para controles;
- não depender apenas de cor, hover, som ou movimento;
- preservar operação por teclado nos controles aplicáveis;
- respeitar `prefers-reduced-motion` para movimento não essencial;
- evitar conteúdo que pisque ou pulse de forma agressiva;
- manter texto legível independentemente da iluminação 3D.

Referência: https://www.w3.org/TR/WCAG22/

## Performance

Não estabelecer números artificiais de FPS, bundle ou milissegundos sem uma baseline medida no projeto. Em vez disso, cada PR MUST provar ausência de regressão evidente e registrar qualquer custo novo relevante.

Diretrizes:

- conteúdo crítico MUST NOT aguardar WebGL;
- o renderer SHOULD ser carregado de forma lazy quando isso reduz custo inicial sem quebrar continuidade;
- Server Components SHOULD permanecer como padrão para conteúdo que não precisa de interatividade no cliente;
- Client Components SHOULD ficar restritos às fronteiras realmente interativas;
- geometria, materiais e objetos estáveis SHOULD ser reutilizados;
- cenas majoritariamente estáticas SHOULD reduzir renderização contínua quando possível;
- DPR SHOULD ser limitado/adaptativo;
- efeitos caros MUST ter fallback/degradação.

Referências oficiais:

- Next.js lazy loading: https://nextjs.org/docs/app/guides/lazy-loading
- Next.js Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- React Three Fiber performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance

## Score

O score não compensa BLOCKER falhando. Cada categoria deve receber nota acompanhada de uma frase de justificativa e evidência. Uma implementação com >=85 mas que omita um conceito marcado `CORE` em `traceability.md` falha a avaliação.

## Regra de credibilidade

Specs MUST distinguir claramente:

- comportamento já existente e que precisa ser preservado;
- requisito novo desta iniciativa;
- exemplo de direção visual;
- possibilidade futura/opcional.

Nenhum exemplo visual pode ser tratado como regra de negócio. Nenhuma ideia histórica não confirmada pode ser promovida silenciosamente a funcionalidade ativa.
