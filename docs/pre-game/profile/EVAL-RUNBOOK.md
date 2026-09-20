# PROFILE V3 — EVAL Runbook

Rota: `/profile`

Este runbook cobre a experiência e as boundaries próprias de Profile. Economia, wallet, storefront, inventário, loadout jogável, dados cosméticos, efeitos territoriais e snapshot de partida são avaliados por `../../economy/EVAL.md`.

## Pré-condições

```bash
npm ci
npm --prefix realtime ci
npm run lint
npm test
npm run build
```

Nenhuma evidência visual substitui gate técnico vermelho.

## Estados server-side

```bash
# fluxo local completo
npm run dev

PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=guest npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=loaded npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=partial-data npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-history npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-social npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=error npm run dev
```

Não selecionar fixture por query string, cookie ou controle público.

Estados artificiais específicos de wallet/store não fazem parte deste runbook; cenários econômicos e de falha econômica são definidos por `../../economy/EVAL.md`. Profile deve apenas demonstrar que falha de uma fonte econômica não derruba as demais estações.

## Viewports canônicos

| Nome | Viewport |
| --- | --- |
| desktop | 1440 × 900 |
| mobile | 390 × 844 |

Mobile deve usar touch/coarse pointer.

## Estações obrigatórias

No cenário `loaded`, capturar e interagir com:

1. `dossier`;
2. `treasury`;
3. `network`;
4. `campaigns`;
5. `quartermaster`.

Desktop deve manter todas as estações reconhecíveis ao redor da Mesa. Mobile deve exibir somente a estação ativa, com seletor de sistemas no rodapé.

## Estados especiais

Registrar desktop + mobile para:

- `guest`;
- `partial-data`;
- `empty-history`;
- `empty-social`;
- `error`;
- `reduced-motion`;
- `fallback`.

Estados e evidências internas de Tesouraria/Intendência pertencem ao EVAL econômico.

## Tesouraria — boundary de Profile

Validar somente:

- selecionar a Tesouraria ativa `treasury`;
- conteúdo econômico chega por DTO/service boundary;
- Profile não consulta SQL econômico diretamente;
- indisponibilidade da fonte econômica não derruba Dossiê, Rede ou Livro de Campanha;
- conteúdo continua acessível em desktop, mobile e fallback.

Moeda, saldo, ledger e demais contratos econômicos são validados exclusivamente por `../../economy/EVAL.md`.

## Rede de Comando

Validar:

- amigos exibem presença em texto;
- social vazio ainda permite busca;
- input aceita callsign/nome;
- menos de 2 caracteres não dispara busca;
- busca sem correspondência exibe feedback de nenhum sinal;
- falha de endpoint exibe erro sem derrubar a PROFILE;
- browser não recebe o diretório completo de comandantes.

## Livro de Campanha

Validar:

- seleção de operação atualiza contexto da Mesa;
- resultado, modo e duração possuem texto;
- `hasMore`/cursor permanecem no contrato quando aplicáveis;
- `empty-history` não parece erro;
- dados vêm da fonte real definida no SPEC de Profile, exceto em harness explícito de avaliação.

## Intendência — boundary de Profile

Validar somente:

- selecionar Intendência ativa `quartermaster`;
- Intendência recebe storefront por DTO/service boundary;
- existe navegação/entrada coerente para a experiência econômica quando ela estiver disponível;
- falha do domínio econômico não derruba as demais estações;
- nenhuma superfície introduz retrato/avatar como identidade do comandante;
- conteúdo continua operável em desktop, mobile e fallback.

Itens, anúncios, preços, aquisição, preview, inventário e equipagem são avaliados exclusivamente por `../../economy/EVAL.md`.

## Dossiê

Validar:

- identidade textual/monograma sem imagem de perfil;
- nome;
- handle;
- título cosmético separado de rank;
- presença textual;
- nenhuma moldura ou slot vazio sugere foto ausente.

## Foundation / cena

Cada estação deve alterar somente intenção semântica:

- Dossiê → insignia;
- Tesouraria → table;
- Rede → table;
- Campanhas → brazil;
- Intendência → table.

Falha se a PROFILE importar Three/R3F/Canvas/câmera diretamente.

## Fallback WebGL

Forçar Foundation para `data-webgl="fallback"` sem esconder Canvas manualmente por CSS.

Dossiê, Tesouraria, Rede, Campanhas e Intendência devem continuar utilizáveis porque todo conteúdo funcional está em HTML.

## Reduced motion

Com:

```js
matchMedia('(prefers-reduced-motion: reduce)').matches === true
```

confirmar:

- mudança de estação continua funcionando;
- conteúdo não desaparece;
- perspectiva/motion ornamental pode ser reduzido;
- ordem e ações permanecem equivalentes.

## Teclado

Em 1440x900, sem mouse:

1. alcançar retorno ao comando;
2. alcançar Tesouraria;
3. navegar pelos headers das estações;
4. pesquisar comandante;
5. selecionar operação;
6. alcançar Intendência e sua navegação econômica quando disponível;
7. no erro, alcançar `Tentar novamente`.

Foco não pode ficar invisível ou preso.

## Touch

Em 390x844:

1. alternar as cinco estações pelo seletor inferior;
2. abrir Tesouraria;
3. pesquisar comandante;
4. selecionar operação;
5. abrir Intendência;
6. confirmar ausência de overflow horizontal;
7. confirmar que nenhuma informação depende de hover.

## Integridade de dados de avaliação

Fixtures são permitidas apenas em harness explícito de EVAL e MUST ser identificadas como `evaluation-fixture` ou equivalente.

O fluxo real de Profile MUST usar fontes persistentes/serviços reais para identidade, social, presença e histórico conforme `SPEC.md`.

Fixtures econômicas, quando necessárias ao harness, MUST obedecer `../../economy/SPEC.md` e não redefinem contratos neste runbook.

## Encerramento

Profile só está concluído quando:

- lint/test/build verdes;
- todos os blockers atuais de `EVAL.md` verdes, incluindo `PRO-ECO-*`;
- score >= 85/100;
- desktop 1440x900 validado;
- mobile 390x844 validado;
- teclado/touch/reduced-motion/fallback documentados;
- nenhuma regra econômica duplicada neste runbook;
- nenhuma regressão funcional fora da PROFILE.
