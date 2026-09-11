# Plano técnico — PROFILE / Salão de Comando

Branch de implementação: `feature/pre-game-profile`.

## Objetivo

Implementar `/profile` como um Salão de Comando orientado a identidade e prestígio, sem transformar a tela em dashboard e sem inventar progressão competitiva. Nesta etapa, somente a identidade pública usa uma fonte local estática e explicitamente identificada. O contrato de dados foi desenhado para ser substituído por um provedor de usuário autenticado no futuro sem refazer a camada visual.

## Fontes de verdade avaliadas

Ordem aplicada conforme `../quality-standard.md`:

1. contratos/código atuais do produto;
2. `SPEC.md` e `EVAL.md` desta trilha;
3. `../visual-language.md` e Foundation;
4. decisões deste plano.

Constatações do código-base na criação da branch:

- Next.js `16.3.4`, React `19.2.8` e Tailwind CSS `4.x`;
- App Router em `src/app`;
- `WarShell`, tokens `--wb-*` e fontes já fornecem a base de identidade;
- não existia primitive de Insígnia de Comando no `dev`, portanto a PROFILE usa uma implementação 2D isolada e substituível em vez de depender de uma branch paralela;
- não existe autenticação/progressão de perfil utilizável como fonte de verdade nesta etapa.

## Pesquisa técnica aplicada

Referências consultadas antes da implementação:

- Next.js — Server/Client Components: manter Server Components como padrão para reduzir JavaScript no cliente;
- Next.js/Tailwind — responsividade mobile-first;
- W3C WCAG 2.2 — foco visível, sem dependência de hover e alvos de interação adequados;
- W3C C39 / `prefers-reduced-motion` — remover motion não essencial quando solicitado pelo usuário.

A implementação não adiciona Three/WebGL. O HTML/CSS é o fallback funcional completo; uma cena compartilhada futura pode atuar apenas como progressive enhancement.

## Arquitetura

### Boundary de dados

`src/lib/profile/profile-data.ts`

`getCurrentProfileSnapshot()` é a única boundary consumida pela rota. Hoje retorna `LOCAL_PROFILE`; futuramente deve delegar para sessão/autenticação e serviços de perfil.

O componente recebe um `ProfileSnapshot` com disponibilidade e origem por seção. Ausência é representada como `unavailable` ou `empty`, nunca como zero/número fictício.

Histórico usa `{ campaigns, hasMore }`, deixando explícito que um provider futuro deve retornar uma janela limitada em vez de carregar todo o arquivo.

O snapshot também informa `isEvaluationFixture`. Esse campo é `false` no fluxo normal e `true` somente nos cenários opt-in do EVAL, permitindo que a UI rotule de forma explícita qualquer registro sintético.

### Harness determinístico do EVAL

Os estados visuais são selecionáveis apenas no servidor:

```bash
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=guest npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=partial-data npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=loaded npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-history npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=no-progression-system npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=error npm run dev
```

Não existe query string, cookie ou controle de navegador para selecionar fixture.

- `loaded`: todas as áreas estruturais ficam disponíveis com conteúdo sintético claramente rotulado e sem números competitivos;
- `empty-history`: demais áreas disponíveis, histórico vazio;
- `no-progression-system`: demais áreas disponíveis, progressão explicitamente indisponível;
- `partial-data`: identidade local e demais fontes indisponíveis;
- `guest`: nenhuma identidade;
- `error`: `getCurrentProfileSnapshot()` lança uma exceção controlada e exercita o `error.tsx` real do App Router.

As fixtures nunca se apresentam como dados reais: a própria página exibe aviso de modo de avaliação e marca os registros estruturais como sintéticos.

### UI

- `src/app/profile/page.tsx`: Server Component e metadata;
- `src/app/profile/loading.tsx`: loading textual explícito;
- `src/app/profile/error.tsx`: error boundary recuperável, sem dados falsos;
- `src/components/profile/profile-boundary-state.tsx`: Salão físico para loading/erro;
- `src/components/profile/profile-hall.tsx`: composição semântica do Salão;
- `src/components/profile/command-insignia.tsx`: Insígnia 2D temporária e independente de WebGL;
- CSS Modules locais: arquitetura/materialidade, mobile e reduced-motion sem contaminar estilos globais.

## Direção visual

Composição em três planos:

1. arquitetura em carvão/verde profundo;
2. Insígnia monumental como objeto central;
3. registros HTML legíveis por cima da cena.

Dourado aparece como autoridade/metal. Vermelho não é usado no estado normal. Progressão, arquivo e honrarias são tratados como placas/fixtures físicos, e não como cards KPI.

No mobile, a perspectiva lateral é removida e a sala vira uma sequência vertical: Insígnia → identidade → estado → registros → integridade.

Loading e erro permanecem dentro da fantasia do Salão: o boundary usa um cofre/arquivo físico central em vez de cair numa tela genérica.

## Auditoria de dados atual

| Conteúdo | Valor atual | Origem | Política |
| --- | --- | --- | --- |
| nome público | `Luigi` | `local-static` | explicitamente marcado como perfil local temporário |
| patente/progressão | não exibida | nenhuma | `unavailable` |
| estatísticas | não exibidas | nenhuma | `unavailable` |
| histórico | não exibido | nenhuma | `unavailable` |
| conquistas | não exibidas | nenhuma | `unavailable` |

Não existem placeholders numéricos competitivos no fluxo normal.

Conteúdo marcado `evaluation-fixture` existe exclusivamente para regressão/evidência do EVAL e é identificado visualmente como sintético.

## Cobertura do EVAL

- `PRO-01`: fluxo normal não simula estatística/patente/ranking/conquista; fixtures do EVAL são opt-in e rotuladas como sintéticas;
- `PRO-02`: tipos/copy para `guest`, `loading`, `loaded`, `empty-history`, `partial-data`, `no-progression-system`, `error`; loading/error usam boundaries reais do App Router;
- `PRO-03`: UI não recebe/exibe ID interno, token ou payload bruto;
- `PRO-04`: toda informação existe em HTML/CSS, sem WebGL;
- `PRO-05`: layout próprio abaixo de 640px e nenhuma ação depende de hover;
- `PRO-06`: `prefers-reduced-motion` desativa animação da Insígnia e transitions não essenciais;
- `PRO-07`: cada seção carrega `source`/`availability`; ausência é rotulada e fixtures são identificadas separadamente;
- `PRO-08`: nenhum login foi inventado; o perfil local apenas documenta a futura substituição;
- `PRO-09`: contrato de histórico é limitado e possui `hasMore`; cenário `loaded` exercita continuação progressiva;
- `PRO-10`: Insígnia é 2D, responsiva e permanece identificável sem cena;
- `PRO-11`: conquistas são renderizadas com nome e descrição em HTML;
- `PRO-12`: estados vazios usam fixtures físicos do Salão, não widgets quebrados.

### Cenários

| EVAL | Cobertura |
| --- | --- |
| `PRO-S1` | `PROFILE_EVAL_STATE=guest` |
| `PRO-S2` | fluxo normal / `partial-data` |
| `PRO-S3` | `PROFILE_EVAL_STATE=loaded` |
| `PRO-S4` | `PROFILE_EVAL_STATE=empty-history` |
| `PRO-S5` | `PROFILE_EVAL_STATE=no-progression-system` |
| `PRO-S6` | `PROFILE_EVAL_STATE=error`, passando pelo error boundary real |
| `PRO-S7` | contrato `hasMore` + janela visível limitada; backend real ainda não existe |
| `PRO-S8` | `prefers-reduced-motion: reduce` |
| `PRO-S9` | HTML/CSS completo sem dependência de WebGL |
| `PRO-S10` | breakpoint mobile dedicado, alvo de regressão 390x844 |

## Integração futura com login

Trocar somente a implementação de `getCurrentProfileSnapshot()` por um adapter autenticado. A UI não deve importar SDK de autenticação nem shape bruto de sessão. O adapter deve mapear identidade, progressão, estatísticas, histórico paginado e conquistas para `ProfileSnapshot`, mantendo `source` e `availability` auditáveis.

Quando a primitive compartilhada de Insígnia da Foundation existir em `dev`, substituir `CommandInsignia` local pela primitive canônica sem mudar a hierarquia da página.

## Evidência ainda necessária antes de merge

Conforme `quality-standard.md`, a conclusão final ainda depende de:

- `npm test` completo;
- `npm run lint` completo;
- captura determinística 1440x900 e 390x844 dos estados exigidos;
- inspeção manual de teclado/touch e `prefers-reduced-motion`.

O deploy Vercel é usado como evidência de compilação/build da aplicação, mas não substitui os gates locais de teste e lint.
