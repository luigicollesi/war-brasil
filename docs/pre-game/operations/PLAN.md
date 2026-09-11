# PLAN — Operações

**Branch:** `feature/pre-game-operations`  
**Base:** `dev@2083579396e108349d6983e40120aaccf5d1d1dd`  
**Rota:** `/matchmaking`  
**Cena:** `operations`

Este plano implementa `SPEC.md` e mede sucesso por `EVAL.md`, sem alterar protocolo, banco, realtime ou regras de jogo.

## 1. Leitura da implementação atual

A rota já preserva a separação correta entre página e interações: `src/app/matchmaking/page.tsx` é Server Component e delega criação/entrada a `CreateRoomButton` e `JoinRoomForm`.

Contratos atuais que ficam congelados:

- criação: `POST /api/rooms`;
- entrada: `POST /api/rooms/join` com `{ code }`;
- normalização vigente: `trim() -> lowercase -> remove caracteres fora de [a-z0-9-]`;
- sucesso: `router.push('/lobby/' + encodeURIComponent(room.code))`;
- mensagens de erro vindas da API continuam tendo precedência;
- sessão, banco e realtime permanecem intocados.

Gaps encontrados em relação ao EVAL:

1. o visual atual ainda lê como duas ações paralelas separadas, não como dois modos da mesma máquina (`OPS-12`);
2. criação já bloqueia double-submit, entrada ainda não (`OPS-08`);
3. entrada não possui feedback textual durante envio (`OPS-04` / score de estados assíncronos);
4. `fetch` não possui recuperação explícita para request que não resolve; o estado pendente pode permanecer indefinido em cenário de timeout (`OPS-04`);
5. a composição atual não materializa Mesa/Brasil/Coroa como estação operacional (`OPS-11` / integração Foundation);
6. a branch deve continuar utilizável antes da Foundation 3D estar integrada, sem criar renderer concorrente.

## 2. Conceito de interface — Mesa de Autorização

A tela deixa de ser uma grade de cards e vira um único console físico de comando.

### Desktop

Uma composição única em três planos:

1. **ambiente** — carvão/verde profundo, textura discreta e iluminação radial;
2. **máquina** — uma grande Mesa de Autorização central, com trilho mecânico que alterna `NOVA OPERAÇÃO` e `LOCALIZAR OPERAÇÃO`;
3. **UI funcional** — painel DOM legível sobre a máquina, sempre independente de WebGL.

Os dois modos compartilham a mesma moldura, telemetria, status e área de ação. Trocar modo altera conteúdo/estado da máquina em 120–320 ms, sem deslocar o formulário principal e sem desmontar estado útil.

Direção visual:

- verde/carvão como massa estrutural;
- latão/dourado apenas em comando, foco e decisão;
- vermelho somente em erro/conflito;
- marfim para leitura;
- metal escuro, parafusos/chanfros, trilhos, placas e relés discretos;
- nenhuma estética de card SaaS, vidro neon/ciano, armas, soldados ou explosões.

### Mobile 390x844

Não comprimir o desktop. Usar:

- cabeçalho compacto;
- seletor de modos em largura total;
- apenas um painel funcional visível por vez;
- input e CTA com alvo touch >= 44 px;
- área visual da Mesa reduzida a atmosfera, sem empurrar o formulário abaixo da dobra de forma crítica;
- teclado de texto normal para o código alfanumérico;
- paste de código completo preservado.

## 3. Arquitetura React / Next.js

### Server boundary

`src/app/matchmaking/page.tsx` continua Server Component. Ele fornece metadata e composição estática.

### Client boundary mínima

Criar `OperationsConsole` como Client Component pequeno responsável somente por:

- modo ativo (`create | join`);
- foco visual local;
- semântica do seletor de modos;
- preservação de conteúdo dos dois painéis ao alternar.

`CreateRoomButton` e `JoinRoomForm` continuam responsáveis pelos próprios requests. Nenhum estado de negócio entra em Three.js/cena.

### Foundation

A trilha Operations **não** implementará Canvas, CameraDirector, Brasil 3D, Mesa 3D ou Coroa Orbital.

Quando `feature/pre-game-foundation` publicar o contrato definitivo, a rota consumirá apenas intenção declarativa equivalente a:

```ts
{
  mode: 'operations',
  focus: 'table',
  conflictLevel: 0 | 1,
  orbitalAlignment: 0 | 1,
}
```

Até a integração, a página terá composição 2D/CSS completa e funcional. Nenhum mock 3D definitivo será criado.

## 4. Estados e máquina de UI

Estados visuais/funcionais mapeados ao SPEC:

- `idle`: estação em repouso;
- `create-focus`: modo criação selecionado;
- `creating`: CTA desabilitado + texto `Autorizando operação…`;
- `create-error`: erro textual + retry;
- `join-focus`: modo localizar selecionado;
- `typing-code`: input ativo sem layout shift;
- `joining`: submit desabilitado + texto `Localizando operação…`;
- `invalid-code`: erro textual associado ao campo, valor preservado;
- `network-error`: mensagem de falha + retry, sem loading preso;
- `success-transition`: redirect imediato; animação não é await;
- `reduced-motion`: mesmos conteúdos/estados sem deslocamentos/loops não essenciais;
- `scene-fallback`: DOM completo sem WebGL.

A troca create/join preserva o código digitado (`OPS-S7`). Os painéis permanecem montados e o painel inativo fica semanticamente indisponível/oculto, evitando perda de estado.

## 5. Robustez dos requests

### Create

Manter endpoint e parsing atuais. Preservar `isCreating` como trava contra double-click. Expor estado assíncrono por texto e `aria-busy`.

### Join

Adicionar `isJoining` e bloquear submit repetido enquanto o request estiver ativo. O código digitado nunca é limpo por erro.

### Timeout/rede

Adicionar cancelamento de UI com `AbortController`/`AbortSignal` em um helper local reutilizado por create/join, com timeout explícito e mensagem recuperável. Isso é uma proteção da camada de interação; não muda endpoint, payload ou contrato do servidor.

O helper deve limpar timer/sinal em `finally`, distinguir abort/timeout de resposta HTTP e sempre liberar o estado pending.

## 6. Semântica e acessibilidade

- seletor de modos com semântica de tabs (`tablist`, `tab`, `tabpanel`) e estados `aria-selected`/`aria-controls`;
- suporte a click/touch e teclado; setas entre tabs se a implementação adotar o padrão completo;
- input continua sendo **um único `<input>` real**;
- `<label>` visível/associado ao código;
- foco visível com contraste independente da iluminação;
- pending comunicado por texto e `role="status"`/`aria-live="polite"`;
- erros mantêm `role="alert"` e `aria-describedby`;
- erro nunca depende apenas de vermelho: ícone/label/texto indicam falha;
- `prefers-reduced-motion: reduce` remove transforms, loops e transições ornamentais;
- cena decorativa fora da árvore de acessibilidade.

## 7. Styling e performance

Sem dependências novas.

- reutilizar tokens/primitives publicados pela Foundation quando integrarem;
- manter estilos específicos de Operations locais à rota/componente para reduzir conflitos de branches paralelas;
- usar Tailwind 4 para layout/estados simples e CSS local apenas para materialidade/pseudo-elementos complexos;
- evitar filtros/blur grandes em elementos animados;
- animar preferencialmente `transform`/`opacity`;
- não renderizar 3D próprio;
- nenhuma ação crítica aguarda asset, WebGL ou animação;
- page permanece Server Component e somente a fronteira interativa hidrata.

## 8. Arquivos previstos

Escopo próprio da trilha:

- `src/app/matchmaking/page.tsx` — nova composição sem alterar rota;
- `src/components/operations-console.tsx` — modo/foco e estrutura da estação;
- `src/components/create-room-button.tsx` — status/timeout sem mudar contrato;
- `src/components/join-room-form.tsx` — pending, double-submit e status;
- `src/app/matchmaking/operations.module.css` — materialidade/layout local, se necessário;
- testes focados em Operations sob `tests/`.

Arquivos compartilhados da Foundation (`CommandShell`, cena, tokens globais, renderer, geometria) não devem ser editados nesta branch.

## 9. Validação por EVAL

### BLOCKERs

- `OPS-01/02`: regressão dos redirects create/join;
- `OPS-03/10`: erro inválido preserva input e retry;
- `OPS-04`: network rejection + timeout liberam pending;
- `OPS-05`: input único testado com type/select/paste;
- `OPS-06`: reduced-motion e ausência de WebGL;
- `OPS-07`: diff confirma zero mudança em API/realtime/banco;
- `OPS-08`: clique/submit repetido produz no máximo um request ativo;
- `OPS-09`: normalização atual fica coberta por regressão;
- `OPS-11`: validar contra Foundation após sincronização com `dev`;
- `OPS-12`: revisão visual desktop/mobile confirma uma máquina única.

### Visual regression

Capturar 1440x900 e 390x844 nos estados exigidos pelo EVAL:

`idle`, `create-focus`, `creating`, `typing-code`, `invalid-code`, `network-error`, `reduced-motion`, `fallback`.

Até Playwright existir no repositório, não adicionar framework apenas para esta página. Usar testes Node existentes + roteiro manual reproduzível. Quando Playwright for integrado ao projeto, migrar esses cenários para screenshots determinísticos.

### Checks antes de merge

```bash
npm test
npm run lint
npm run build
```

Além disso, sincronizar com `dev` depois da Foundation e executar novamente os gates no estado integrado.

## 10. Ordem de implementação

1. congelar contratos atuais com testes de regressão;
2. adicionar pending/double-submit/timeout sem mudar visual;
3. criar `OperationsConsole` e alternância acessível preservando estado;
4. construir composição 2D de alta fidelidade da Mesa de Autorização;
5. fazer mobile próprio e reduced-motion;
6. integrar o contrato público da Foundation, sem acessar internals Three.js;
7. executar checks + cenários OPS-S1..S10;
8. capturar evidências desktop/mobile e revisar score >= 85 + todos BLOCKERs.

## 11. Referências técnicas

- Next.js — Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js — Lazy Loading: https://nextjs.org/docs/app/guides/lazy-loading
- Tailwind CSS — Responsive Design: https://tailwindcss.com/docs/responsive-design
- Tailwind CSS — states / `prefers-reduced-motion`: https://tailwindcss.com/docs/hover-focus-and-other-states
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI — Error Identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification

## Decisão de integração

A implementação pode avançar agora em comportamento, DOM, responsividade e fallback 2D. A integração visual com Mesa/Brasil/Coroa 3D deve ocorrer **depois que a Foundation publicar/mergear o contrato real**, evitando uma segunda cena ou API incompatível.