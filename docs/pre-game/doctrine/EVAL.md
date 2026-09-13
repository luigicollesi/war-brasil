# EVAL — Doutrina / Regras

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| DOC-01 | núcleo mínimo de capítulos está acessível por teclado/touch | e2e/manual |
| DOC-02 | conteúdo essencial continua disponível sem Canvas/WebGL | fallback/manual |
| DOC-03 | exemplos não contradizem regras vigentes | review contra fonte de verdade + testes aplicáveis |
| DOC-04 | mudança de capítulo não causa scroll inesperado/perda de foco | interaction test |
| DOC-05 | mobile permite leitura sem zoom/scroll horizontal obrigatório | 390x844 manual/visual |
| DOC-06 | reduced-motion mantém explicações equivalentes | manual/snapshot |
| DOC-07 | toda mecânica adicional ativa que afete decisão do jogador está documentada | coverage review |
| DOC-08 | Home não mantém uma segunda versão divergente do manual completo | inspection |
| DOC-09 | exemplos visuais possuem equivalente textual suficiente | accessibility review |
| DOC-10 | cartas/mapa/dados usados como exemplo respeitam assets e regras reais quando reutilizados | inspection/visual |
| DOC-11 | deep-link/índice não depende de cena 3D para navegar | interaction test |
| DOC-12 | fase de Trocas aparece antes de Reforços e distingue negociação de resgate | review contra `game-turn-service` + trade service + e2e |
| DOC-13 | índice desktop permanece visível durante scroll sem cobrir o artigo; mobile mantém navegação acessível | desktop/mobile interaction test |
| DOC-14 | transição entre capítulos preserva contexto sem alterar scroll/foco e é removida em reduced-motion | interaction test + reduced-motion |

## Score / 100

- 25 — clareza didática;
- 25 — fidelidade e cobertura das regras vigentes;
- 15 — integração visual com Mesa/territórios/cartas/dados;
- 15 — navegação entre capítulos;
- 10 — mobile/acessibilidade;
- 10 — performance/progressive enhancement.

Aprovação: >= 85 + todos os BLOCKERs.

## Cenários obrigatórios

- abrir cada capítulo diretamente, incluindo `?chapter=trocas`;
- confirmar no capítulo Turno a ordem `Trocas -> Reforços -> Ataque -> Manobra`;
- confirmar que negociação entre jogadores não é apresentada como resgate de cartas por tropas;
- navegar próximo/anterior quando implementado;
- voltar ao índice;
- rolar um capítulo longo no desktop e confirmar que o índice continua disponível;
- operar somente por teclado;
- viewport 390x844 com índice horizontal/sticky acessível;
- reduced-motion;
- Canvas/WebGL indisponível;
- confrontar Trocas/Ataque/Conquista/Movimentação/Cartas/Objetivos com regras vigentes;
- validar que a troca de capítulo não altera `scrollY` nem força foco;
- validar direção visual ao avançar/voltar quando View Transition estiver disponível;
- listar mecânicas ativas do build e confirmar cobertura documental.

## Visual regression

Capturar desktop/mobile para pelo menos:

- `Preparação`;
- `Trocas`;
- `Ataque`;
- `Cartas`;
- `Objetivos`;
- uma mecânica específica do WAR Brasil, se houver mecânica adicional ativa no build.

Cada screenshot MUST manter a linguagem de Doutrina sem parecer wiki genérica. Seguir determinismo de `../quality-standard.md`.

Para Trocas, a evidência MUST deixar visualmente clara a relação oferta/resposta e a mensagem de que negociação não gera tropas.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Doutrina em `../traceability.md` MUST permanecer presentes.
