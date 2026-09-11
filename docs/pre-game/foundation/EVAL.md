# EVAL — Pre-game Foundation

## Gates BLOCKER

| ID | Critério | Evidência |
| --- | --- | --- |
| FND-01 | Conteúdo e navegação funcionam sem WebGL | teste manual com Canvas/falha simulada |
| FND-02 | Trocar `scene mode` não remonta estado de negócio da página | teste de integração/profiling |
| FND-03 | `prefers-reduced-motion` elimina câmera/parallax não essenciais | screenshot + inspeção |
| FND-04 | Sem dependência nova de UI/animation/renderer sem decisão explícita | diff package.json |
| FND-05 | `npm test`, lint e build verdes | CI/log |
| FND-06 | Mobile não possui ação dependente de hover | interação touch |
| FND-07 | Texto permanece legível com cena clara/escura atrás | screenshots de estados extremos |

## Score / 100

- 25 — coerência visual/material com `visual-language.md`;
- 20 — isolamento e estabilidade do contrato de cena;
- 20 — performance e ausência de remount/flicker;
- 15 — responsive/mobile;
- 10 — acessibilidade/reduced motion;
- 10 — fallback e tratamento de erro.

Aprovação: >= 85 e nenhum BLOCKER falhando.

## Cenários de avaliação

### FND-S1 — Idle

Cena permanece visualmente viva sem causar alterações perceptíveis de layout, tremulação ou uso excessivo de animação.

### FND-S2 — Sequência de modos

`entrance -> operations -> lobby -> doctrine -> profile -> entrance` deve ocorrer sem recriar a aplicação ou produzir flash branco/preto não intencional.

### FND-S3 — Device fraco

Com DPR reduzido e motion reduzido, a experiência continua reconhecível e as ações continuam imediatas.

### FND-S4 — Fallback

Sem WebGL, mostrar composição 2D coerente com a identidade; nunca tela vazia/spinner infinito.

## Visual regression futura

Capturar estados estáveis em 390x844, 768x1024, 1440x900 e 1920x1080. Elementos ambientais com aleatoriedade devem ter seed/estado congelável para snapshots determinísticos.
