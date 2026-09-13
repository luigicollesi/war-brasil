# PROFILE V2 — EVAL Runbook

Branch: `feature/profile-command-quarters-v2`  
Rota: `/profile`

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
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=wallet-unavailable npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-history npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-social npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=empty-storefront npm run dev
PROFILE_EVAL_MODE=1 PROFILE_EVAL_STATE=error npm run dev
```

Não selecionar fixture por query string, cookie ou controle público.

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

Além das cinco estações, registrar desktop + mobile para:

- `guest`;
- `partial-data`;
- `wallet-unavailable`;
- `empty-history`;
- `empty-social`;
- `empty-storefront`;
- `error`;
- `reduced-motion`;
- `fallback`.

## Tesouraria

Validar por DOM e visual:

- moeda comum = `campaign-credit`;
- moeda premium = `command-reserve`;
- símbolos distintos (`◈` e `◆` no fixture local);
- labels textuais distintos;
- saldo indisponível não vira `0`;
- selecionar carteira ativa `treasury`.

## Rede de Comando

Validar:

- amigos exibem presença em texto;
- social vazio ainda permite busca;
- input aceita callsign/nome;
- menos de 2 caracteres não dispara busca;
- `mar` retorna resultados no provider local;
- termo sem correspondência exibe feedback de nenhum sinal;
- falha de endpoint exibe erro sem derrubar a PROFILE;
- browser não recebe o diretório completo de comandantes.

Não considerar botão de amizade obrigatório enquanto persistência social não existir.

## Livro de Campanha

Validar:

- exatamente três operações no fixture local inicial;
- seleção de operação atualiza contexto da Mesa;
- resultado, modo e duração possuem texto;
- `hasMore: true`/cursor permanecem no contrato;
- `empty-history` não parece erro.

## Intendência

Validar:

- até três itens em destaque;
- categoria, nome e preço visíveis;
- preço identifica a moeda;
- seleção altera contexto da Mesa;
- `empty-storefront` permanece uma estação válida;
- nenhuma ação/label afirma compra concluída;
- não existe checkout na PROFILE.

## Dossiê

Validar:

- espaço de retrato/ícone;
- fallback de monograma quando não há artwork;
- nome;
- handle;
- título cosmético separado de rank;
- presença textual.

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
6. selecionar item da Intendência;
7. no erro, alcançar `Tentar novamente`.

Foco não pode ficar invisível ou preso.

## Touch

Em 390x844:

1. alternar as cinco estações pelo seletor inferior;
2. abrir Tesouraria pelo saldo superior;
3. pesquisar comandante;
4. selecionar operação;
5. selecionar item da Intendência;
6. confirmar ausência de overflow horizontal;
7. confirmar que nenhuma informação depende de hover.

## Integridade de fixture

Fluxo normal V2 usa dados `local-static`; EVAL usa `evaluation-fixture`.

O objetivo é validar a experiência antes dos serviços reais, não fingir backend. O PR deve deixar explícito que:

- moeda não é persistida;
- relações sociais não são persistidas;
- histórico é fixture local;
- itens da Intendência são showcase local.

## Encerramento

A V2 só está concluída quando:

- lint/test/build verdes;
- todos os PRO-01…PRO-24 verdes;
- score >= 85/100;
- desktop 1440x900 validado;
- mobile 390x844 validado;
- teclado/touch/reduced-motion/fallback documentados;
- nenhuma regressão funcional fora da PROFILE.