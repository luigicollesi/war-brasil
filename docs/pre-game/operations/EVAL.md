# EVAL — Operações

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| OPS-01 | criar sala continua levando ao lobby correto | e2e/integration |
| OPS-02 | código válido continua entrando na sala correta | e2e/integration |
| OPS-03 | código inválido mostra erro textual recuperável | e2e/manual |
| OPS-04 | falha de rede/timeout não deixa loading preso | e2e/manual |
| OPS-05 | campo aceita teclado, seleção e paste normalmente | interaction test |
| OPS-06 | ações funcionam com WebGL indisponível e reduced-motion | fallback/manual |
| OPS-07 | nenhum contrato/API realtime/banco muda sem spec próprio | diff/inspection |
| OPS-08 | create/join não permitem efeito duplicado indevido por double-submit | e2e/integration |
| OPS-09 | validação/normalização do código continua coerente com comportamento vigente | regression test |
| OPS-10 | erro não apaga entrada útil sem necessidade e retry é possível | e2e/manual |
| OPS-11 | modo operacional preserva Brasil/geografia conforme Foundation | visual + FND gates |
| OPS-12 | create/join são percebidos como dois modos da mesma máquina, não cards SaaS | visual review |

## Score / 100

- 30 — preservação funcional e estados assíncronos;
- 20 — identidade de estação/máquina;
- 15 — input/teclado/paste/acessibilidade;
- 10 — erros e recuperação;
- 10 — mobile;
- 10 — integração com Mesa/Brasil/Coroa;
- 5 — performance/transição/fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Cenários obrigatórios

- `OPS-S1`: criar sala normalmente;
- `OPS-S2`: entrar via código digitado;
- `OPS-S3`: colar código completo;
- `OPS-S4`: código inválido e corrigir sem recarregar;
- `OPS-S5`: API indisponível/timeout e retry;
- `OPS-S6`: double-click/submissão repetida;
- `OPS-S7`: alternar create/join sem perder estado relevante;
- `OPS-S8`: reduced-motion;
- `OPS-S9`: WebGL indisponível;
- `OPS-S10`: mobile 390x844 com teclado aberto.

## Visual regression

Capturar em 1440x900 e 390x844:

`idle`, `create-focus`, `creating`, `typing-code`, `invalid-code`, `network-error`, `reduced-motion`, `fallback`.

Snapshots seguem `../quality-standard.md`.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados a Operações em `../traceability.md` MUST permanecer presentes.
