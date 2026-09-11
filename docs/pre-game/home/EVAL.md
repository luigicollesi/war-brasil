# EVAL — Home / Entrada

## Gates BLOCKER

| ID | Critério |
| --- | --- |
| HOME-01 | `OPERAÇÕES` navega para `/matchmaking` |
| HOME-02 | `DOUTRINA` navega para `/rules` |
| HOME-03 | `COMANDO` navega para `/profile` |
| HOME-04 | intro é pulável e reduced-motion não força sequência cinematográfica |
| HOME-05 | conteúdo principal aparece mesmo se a cena 3D atrasar/falhar |
| HOME-06 | metadata/structured data da Home não sofre regressão |
| HOME-07 | em 390px não há overflow horizontal nem alvo dependente de hover |

## Score / 100

- 30 — impacto/identidade: ritual de comando, prestígio, Mesa como protagonista;
- 20 — clareza da ação principal;
- 15 — composição e hierarquia;
- 15 — motion/transição com propósito;
- 10 — mobile/acessibilidade;
- 10 — performance/fallback.

Aprovação: >= 85 + BLOCKERs.

## Testes de percepção

### HOME-V1

Com textos temporariamente ocultos, a composição ainda deve sugerir **comando militar de alto prestígio**, não dashboard, cassino ou nave sci-fi azul.

### HOME-V2

Dourado deve concentrar autoridade; vermelho deve crescer apenas quando Operações ganha foco.

### HOME-V3

Os 42 territórios são percebidos como um único Brasil em repouso, não como mapa de jogo já em combate.

## Estados para snapshot

`awaiting-entry`, `command-open`, `operations-hover/focus`, `reduced-motion`, `fallback`; desktop 1440x900 e mobile 390x844.
