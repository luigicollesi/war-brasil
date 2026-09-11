# EVAL — Home / Entrada

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| HOME-01 | `OPERAÇÕES` navega para `/matchmaking` | e2e/manual |
| HOME-02 | `DOUTRINA` navega para `/rules` | e2e/manual |
| HOME-03 | `COMANDO` navega para `/profile` | e2e/manual |
| HOME-04 | intro é pulável e reduced-motion não força sequência espacial | e2e/manual + snapshot |
| HOME-05 | conteúdo/CTA principal aparecem mesmo com 3D atrasado ou indisponível | fallback test |
| HOME-06 | metadata/structured data relevante não sofre regressão | inspection/test |
| HOME-07 | 390x844 não tem overflow horizontal nem ação dependente de hover | mobile/touch |
| HOME-08 | sequência Terra -> Brasil -> Mesa, quando animada, não bloqueia ação | e2e/manual |
| HOME-09 | Brasil em repouso é percebido como unidade de 42 territórios canônicos | visual + FND gates |
| HOME-10 | `ENTRAR NO COMANDO` permanece ação dominante antes da abertura dos destinos | visual/semantic inspection |
| HOME-11 | destinos continuam controles DOM acessíveis, não meshes exclusivos | accessibility inspection |
| HOME-12 | visita repetida/reduced-motion evita repetir cerimônia longa sem necessidade | session/manual |

## Score / 100

- 25 — identidade/ritual de comando;
- 20 — clareza e imediatismo da ação principal;
- 15 — Terra/Brasil/Mesa e continuidade espacial;
- 15 — composição/hierarquia sem hero/cards genéricos;
- 10 — motion/transições com propósito;
- 10 — mobile/acessibilidade;
- 5 — performance/fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Testes de percepção

### HOME-V1 — Sem texto

Ocultando temporariamente texto não essencial, a composição ainda sugere comando militar brasileiro de alto prestígio; não dashboard, cassino, streaming ou nave sci-fi ciano.

### HOME-V2 — Sem vermelho gratuito

Dourado concentra autoridade. Vermelho cresce apenas ao aproximar-se de Operações/conflito e volta a níveis discretos fora dele.

### HOME-V3 — Unidade territorial

Os 42 territórios são percebidos como um Brasil unido em repouso; separação é leve e motivada por estado.

### HOME-V4 — Continuidade

`awaiting-entry -> command-open -> destination-focus` parece transformação da mesma instalação, não troca de templates.

## Estados para snapshot

Desktop 1440x900 e mobile 390x844:

- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `repeat-visit`;
- `reduced-motion`;
- `fallback`.

Snapshots seguem as regras de determinismo de `../quality-standard.md`.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Home em `../traceability.md` MUST estar presentes. Omissão reprova mesmo com score >= 85.
