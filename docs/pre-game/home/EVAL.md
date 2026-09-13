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
| HOME-08 | cerimônia inicia apenas após a Foundation estar pronta e não bloqueia ação | e2e/manual |
| HOME-09 | Brasil em repouso é percebido como unidade de 42 territórios canônicos | visual + FND gates |
| HOME-10 | `ENTRAR NO COMANDO` permanece ação dominante antes da abertura dos destinos | visual/semantic inspection |
| HOME-11 | destinos continuam controles DOM acessíveis, não meshes exclusivos | accessibility inspection |
| HOME-12 | visita repetida/reduced-motion evita repetir cerimônia longa sem necessidade | session/manual |
| HOME-13 | primeira visita executa uma única transformação contínua de 3000 ms do Brasil colorido à Mesa operacional | timing inspection + e2e/manual |
| HOME-14 | nenhum elemento principal aparece em um único frame; mapa, chrome, identidade, CTA, atmosfera e rodapé possuem continuidade de posição/opacidade | temporal snapshots |
| HOME-15 | handoff fallback 2D -> Canvas 3D acontece por sobreposição gradual e termina sem salto perceptível | browser/visual |
| HOME-16 | animação principal não depende de seletores posicionais frágeis (`nth-child`/ordem JSX) | source inspection/test |

## Score / 100

- 25 — identidade/ritual de comando;
- 20 — clareza e imediatismo da ação principal;
- 20 — Brasil/Mesa e continuidade espacial/2D->3D;
- 10 — composição/hierarquia sem hero/cards genéricos;
- 10 — motion/transições com propósito e sincronização temporal;
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

### HOME-V4 — Continuidade operacional

`awaiting-entry -> command-open -> destination-focus` parece transformação da mesma instalação, não troca de templates.

### HOME-V5 — Continuidade cinematográfica

Na primeira visita, observar a animação sem interagir. Deve ser possível acompanhar visualmente o mesmo Brasil desde a posição colorida à direita até a Mesa central. Não pode existir um instante perceptível em que uma composição desaparece e outra simplesmente toma seu lugar.

### HOME-V6 — Assentamento

Entre aproximadamente 2.6 s e 3.0 s, o movimento desacelera e converge para o estado operacional. O frame imediatamente posterior ao término não pode causar salto de posição, escala ou opacidade.

## Estados para snapshot

Desktop 1440x900 e mobile 390x844:

- `intro-preparing` — WebGL ainda preparando, Brasil colorido à direita;
- `intro-0` — primeiro frame da coreografia;
- `intro-25` — ~750 ms;
- `intro-50` — ~1500 ms;
- `intro-75` — ~2250 ms;
- `intro-100` — 3000 ms / estado operacional;
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
