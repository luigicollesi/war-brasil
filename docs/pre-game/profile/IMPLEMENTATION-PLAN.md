# Plano técnico — PROFILE / Salão de Comando

Branch: `feature/pre-game-profile`  
Rota: `/profile`  
Cena: `profile`

## Objetivo

Implementar o Perfil como um **Salão de Comando** orientado a identidade, prestígio e memória, sem dashboard KPI e sem inventar progressão competitiva. Nesta etapa, somente a identidade pública local possui fonte disponível; os demais dados permanecem honestamente indisponíveis até existirem contratos reais.

## Fonte de verdade

Precedência aplicada:

1. contratos/código atuais;
2. `SPEC.md` / `EVAL.md` da PROFILE;
3. `../quality-standard.md`, `../traceability.md` e `../visual-language.md`;
4. Foundation compartilhada já integrada em `dev`.

A PROFILE não altera regra de jogo, banco, realtime, autenticação ou schema.

## Estado de integração

A branch está sincronizada com a Foundation integrada em `dev` e consome somente seu barrel público.

### Foundation

`src/components/profile/profile-command-shell.tsx` emite apenas intenção semântica:

```ts
{ mode: "profile", focus: "insignia", conflictLevel: 0 }
```

A página não importa `three`, `@react-three/fiber`, `Canvas`, câmera ou renderer. `CommandShell` é o único dono da cena e `CommandInsignia` é a primitive compartilhada usada pela identidade.

`WarShell` continua responsável pela navegação vigente, mas fica transparente somente dentro do wrapper da PROFILE para permitir que a cena/fallback da Foundation permaneça visível.

Loading e error boundary usam o mesmo `ProfileCommandShell`; portanto a fantasia espacial não desaparece durante carregamento ou falha.

## Boundary de dados

`src/lib/profile/profile-data.ts` define `ProfileSnapshot` e `getCurrentProfileSnapshot()`.

Fluxo normal atual:

| Conteúdo | Origem | Estado |
| --- | --- | --- |
| nome `Luigi` | `local-static` | disponível, marcado como temporário |
| progressão | nenhuma | `unavailable` |
| estatísticas | nenhuma | `unavailable` |
| histórico | nenhuma | `unavailable` |
| conquistas | nenhuma | `unavailable` |

A UI nunca converte ausência em zero, patente, ranking, medalha ou outro valor competitivo fictício.

O histórico possui contrato `{ campaigns, hasMore }`; provedores futuros devem retornar uma janela limitada. O cenário de avaliação completo usa exatamente três campanhas e `hasMore: true` para provar esse comportamento sem criar paginação fictícia de backend.

## Request-time e futura autenticação

`/profile` executa `await connection()` antes da boundary de dados. Isso impede prerenderização de um perfil dependente de identidade e torna o harness de avaliação determinístico no servidor.

Quando login existir, somente `getCurrentProfileSnapshot()` deve ser substituído por um adapter autenticado. Componentes visuais não devem consumir shape bruto de sessão, tokens ou SDK de autenticação.

## Harness determinístico do EVAL

Fixtures são opt-in exclusivamente por ambiente de servidor:

```bash
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=guest npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=partial-data npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=loaded npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-history npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=no-progression-system npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=error npm run dev
```

Não existe query string, cookie ou controle público para selecionar fixtures.

- `guest`: sem identidade;
- `partial-data`: identidade + seções indisponíveis;
- `loaded`: todas as áreas estruturais disponíveis com conteúdo explicitamente sintético;
- `empty-history`: demais áreas disponíveis, histórico vazio;
- `no-progression-system`: demais áreas disponíveis, progressão ausente;
- `error`: lança `PROFILE_EVAL_ERROR` e exercita o `error.tsx` real.

Todo conteúdo `evaluation-fixture` é rotulado na própria interface e nunca se apresenta como dado real.

## Estados de ambiente

A PROFILE possui texto explícito indicando que o conteúdo crítico é **independente de WebGL**. A Foundation controla Canvas/fallback sem exigir que a página manipule renderer.

`prefers-reduced-motion: reduce` remove motion não essencial e troca a indicação textual de movimento padrão para movimento reduzido. O conteúdo e a hierarquia permanecem presentes.

## UI / materialidade

- carvão/verde profundo como massa;
- dourado restrito a autoridade e detalhes físicos;
- vermelho não é estado padrão;
- Insígnia compartilhada como objeto de identidade;
- placas/arquivos/honrarias em vez de cards KPI;
- loading/error representados por um cofre de arquivo físico;
- objetos decorativos fora da árvore acessível;
- nomes, estados, campanhas e honrarias continuam em HTML.

No mobile (<640px), a composição vira fluxo vertical e remove elementos de perspectiva secundários.

## Testes implementados

### Contract / inspection

`tests/profile-pre-game-contract.test.mjs` protege:

- ausência de dados competitivos inventados;
- equivalentes textuais;
- loading/error/mobile/reduced-motion;
- request-time via `connection()`;
- harness não controlável por URL;
- integração somente via API pública da Foundation;
- ausência de imports diretos de renderer/Three;
- Insígnia compartilhada;
- transparência do `WarShell` limitada à PROFILE.

### Boundary comportamental

`src/lib/profile/profile-data.ts` participa de `npm run test:compile`.

`tests/profile-data.test.mjs` importa a saída compilada e valida de fato:

- fluxo normal;
- `guest`;
- `loaded`;
- `empty-history`;
- `no-progression-system`;
- `partial-data`;
- `error`;
- estado inválido;
- janela de histórico limitada a 3 itens com continuação explícita.

## Cobertura PRO-01…PRO-12

| Gate | Implementação atual |
| --- | --- |
| PRO-01 | fluxo normal não cria rank/stat/achievement; fixture é marcada |
| PRO-02 | estados de dados + boundaries loading/error explícitos |
| PRO-03 | snapshot não expõe IDs/tokens/payload bruto |
| PRO-04 | conteúdo crítico é HTML; Foundation provê fallback |
| PRO-05 | composição mobile dedicada e sem dependência de hover |
| PRO-06 | reduced-motion preserva conteúdo e possui estado textual |
| PRO-07 | cada seção possui `source`/`availability` |
| PRO-08 | nenhum fluxo de login foi criado |
| PRO-09 | histórico possui janela + `hasMore` |
| PRO-10 | `CommandInsignia` canônica da Foundation |
| PRO-11 | honrarias renderizam nome + descrição em HTML |
| PRO-12 | vazio continua representado como arquivo físico do Salão |

## O que ainda falta para Definition of Done

A implementação funcional está pronta para os gates automatizados existentes, mas a trilha ainda **não deve ser declarada concluída** até existir evidência dos itens abaixo:

1. `npm test` completo;
2. `npm run lint` completo;
3. `npm run build` no HEAD atual;
4. regressão visual em 1440x900 e 390x844 para:
   - `guest`;
   - `partial-data`;
   - `loaded`;
   - `empty-history`;
   - `no-progression-system`;
   - `error`;
   - `reduced-motion`;
   - fallback sem WebGL;
5. teclado/foco visível;
6. touch em 390x844;
7. score final do `EVAL.md` >= 85 com todos os blockers verdes.

O workflow atual do repositório executa lint/test/build quando houver PR contra `dev`. Não abrir PR ou fazer merge automaticamente nesta branch.
