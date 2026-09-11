# EVAL — Operações

## Gates BLOCKER

| ID | Critério |
| --- | --- |
| OPS-01 | criar sala continua levando ao lobby correto |
| OPS-02 | código válido continua entrando na sala correta |
| OPS-03 | código inválido mostra erro textual recuperável |
| OPS-04 | falha de rede não deixa a UI presa em estado de loading |
| OPS-05 | campo de código aceita teclado e colar normalmente |
| OPS-06 | ações funcionam com WebGL indisponível e reduced-motion |
| OPS-07 | nenhum contrato/API realtime é modificado sem spec próprio |

## Score / 100

- 25 — preservação funcional;
- 25 — identidade de máquina/ritual, sem cards SaaS;
- 15 — qualidade dos estados assíncronos/erro;
- 15 — teclado/touch/acessibilidade;
- 10 — mobile;
- 10 — performance/transição.

Aprovação: >= 85 + BLOCKERs.

## Cenários

`OPS-S1`: criar sala normalmente.  
`OPS-S2`: entrar via código digitado.  
`OPS-S3`: colar código completo.  
`OPS-S4`: código inválido.  
`OPS-S5`: API indisponível/timeout.  
`OPS-S6`: double-click/submissão repetida não cria comportamento duplicado indevido.

## Visual

Snapshotar `idle`, `create-focus`, `typing-code`, `invalid-code`, `network-error` em 1440x900 e 390x844.
