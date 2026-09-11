# EVAL — Pre-game Foundation

Avaliar conforme `../quality-standard.md`. Falha em qualquer `BLOCKER` reprova independentemente do score.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| FND-01 | conteúdo e navegação funcionam sem WebGL | manual/automated com Canvas indisponível |
| FND-02 | troca de `scene mode` não remonta nem altera estado de negócio | integration + React profiler/inspection |
| FND-03 | `prefers-reduced-motion` elimina câmera/parallax/loops não essenciais sem perda funcional | automated/manual + snapshot |
| FND-04 | nenhuma dependência nova de UI/animation/renderer sem decisão explícita | diff `package.json`/lockfile |
| FND-05 | `npm test`, `npm run lint` e `npm run build` verdes | CI/log |
| FND-06 | mobile não possui ação dependente de hover | touch/manual ou e2e |
| FND-07 | texto permanece legível com cena em extremos claro/escuro | visual snapshots |
| FND-08 | representação do Brasil contém os 42 territórios canônicos, sem perda/duplicação | automated/inspection |
| FND-09 | geometria/fronteiras e identidade territorial não são redefinidas pela apresentação 2.5D | structural comparison/inspection |
| FND-10 | 2.5D não espalha/deforma o Brasil a ponto de alterar leitura geográfica | visual + inspection |
| FND-11 | fronteiras permanecem perceptíveis nos estados definidos | visual desktop/mobile |
| FND-12 | face visual e hit-area lógica podem divergir sem quebrar pointer/touch/keyboard quando território for interativo | interaction test |
| FND-13 | não existem múltiplos renderers/Canvas concorrentes para as páginas pré-jogo | inspection/profiler |
| FND-14 | transições entre modos não produzem flash ou tela vazia e não bloqueiam ação funcional | e2e/manual |
| FND-15 | Coroa Orbital preserva três funções identificáveis: Território, Comando, Conflito | inspection + visual |
| FND-16 | Terra/Globo, Mesa e Brasil possuem estados finais determinísticos e não são dependência funcional | visual + fallback test |
| FND-17 | efeitos não introduzem flicker/pulsação agressiva | manual/visual |

## Score / 100

- 20 — coerência visual/material com `../visual-language.md`;
- 20 — isolamento e estabilidade do contrato de cena;
- 20 — fidelidade/legibilidade do Brasil e objetos de assinatura;
- 15 — performance e ausência de remount/flicker;
- 10 — responsive/mobile;
- 10 — acessibilidade/reduced motion;
- 5 — fallback/tratamento de erro.

Aprovação: >= 85 e nenhum BLOCKER falhando.

Cada categoria MUST receber justificativa curta e evidência no PR.

## Cenários de avaliação

### FND-S1 — Idle

Cena permanece visualmente viva sem layout shift, tremulação, rotação chamativa ou animação sem causa. Mesa, Brasil e Coroa são reconhecíveis.

### FND-S2 — Sequência completa de modos

`entrance -> operations -> lobby -> doctrine -> profile -> entrance` sem renderer concorrente, flash não intencional ou reset de estado funcional.

### FND-S3 — Brasil canônico

Validar 42 territórios, fronteiras/identidades e comportamento visual em repouso, foco e separação leve. A representação continua inequivocamente o mesmo Brasil.

### FND-S4 — Interação territorial

Quando houver interação, validar pointer, teclado e touch. Extrusão/inset/bevel não pode reduzir indevidamente a área lógica de seleção.

### FND-S5 — Device fraco/degradação

Com DPR/effects reduzidos e motion reduzido, a identidade continua reconhecível e ações continuam imediatas.

### FND-S6 — Fallback

Sem WebGL: composição 2D coerente, conteúdo completo e nenhuma tela vazia/spinner infinito.

### FND-S7 — Mudança de iluminação

Forçar estados com vermelho/conflito e estados escuros/claros. Texto, foco e fronteiras continuam legíveis.

## Visual regression

Capturar estados estáveis em:

- 390x844;
- 768x1024;
- 1440x900;
- 1920x1080.

Estados mínimos: `entrance-idle`, `operations-focus`, `lobby`, `doctrine`, `profile`, `reduced-motion`, `fallback`, `conflict-authorized`.

Snapshots MUST congelar aleatoriedade/animações conforme `../quality-standard.md`. Quando Playwright for adotado, usar comparação oficial de screenshots em ambiente de CI estável.

## Gate de rastreabilidade

Antes da aprovação, revisar todos os conceitos `CORE` de Foundation em `../traceability.md`. Conceito aplicável ausente = reprovação, mesmo sem falha técnica observável.
