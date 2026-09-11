# EVAL — Doutrina / Regras

## Gates BLOCKER

| ID | Critério |
| --- | --- |
| DOC-01 | sete capítulos mínimos estão acessíveis por teclado/touch |
| DOC-02 | conteúdo essencial continua disponível sem Canvas/JS visual avançado |
| DOC-03 | exemplos não contradizem as regras vigentes do jogo |
| DOC-04 | mudar capítulo não causa scroll inesperado ou perda de foco |
| DOC-05 | mobile permite ler texto sem zoom/manual horizontal |
| DOC-06 | reduced-motion mantém todas as explicações equivalentes |

## Score / 100

- 25 — clareza didática;
- 20 — fidelidade às regras;
- 20 — integração visual com Mesa/territórios/cartas;
- 15 — navegação entre capítulos;
- 10 — mobile/acessibilidade;
- 10 — performance/progressive enhancement.

Aprovação: >= 85 + BLOCKERs.

## Cenários

Abrir cada capítulo diretamente; navegar próximo/anterior; voltar ao índice; usar somente teclado; usar viewport 390x844; desabilitar motion; simular falha do Canvas.

## Visual regression

Snapshotar `Preparação`, `Ataque`, `Cartas`, `Objetivos` em desktop e mobile. Cada screenshot deve manter a linguagem de Doutrina sem parecer página Wiki genérica.
