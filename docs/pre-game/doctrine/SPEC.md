# SPEC — Doutrina / Regras

**Rota:** `/rules`  
**Cena:** `doctrine`

## Fantasia

As regras são uma **demonstração estratégica da máquina**, não uma página de documentação. A Mesa de Domínio desmonta conceitos para ensinar o jogo.

## Migração

A Home atual inclui `GameQuickGuide`. O conteúdo/regras válidos devem ser reaproveitados, mas a Home nova não deve carregar o manual completo. `/rules` torna-se destino dedicado.

## Capítulos mínimos

1. Preparação
2. Reforços
3. Ataque
4. Conquista
5. Movimentação
6. Cartas
7. Objetivos

## Modelo de interação

Lista/índice de capítulos sempre acessível. Ao selecionar um capítulo, a demonstração central muda sem perder posição de leitura.

Exemplos:

- Ataque: isolar dois territórios, rota e dados;
- Conquista: mostrar transferência mantendo tropa mínima conforme regra;
- Movimentação: destacar conexão válida;
- Cartas: apresentar artwork real do jogo;
- Objetivos: explicar sistema sem revelar objetivo privado de uma partida.

## Progressive enhancement

Todo conteúdo essencial existe em HTML legível e navegável. A demonstração 3D é explicação adicional, não única fonte das regras.

## Mobile

Índice pode virar navegação horizontal/dropdown acessível; texto e exemplo nunca ficam escondidos sob o Canvas.

## Não fazer

- texto gigante contínuo sem navegação;
- duplicar/reinventar regras no componente visual;
- depender de hover;
- fazer da demonstração uma partida simulada complexa;
- carregar assets do tabuleiro inteiro se um exemplo simplificado basta.

## Definition of Done

Um jogador consegue aprender as regras apenas pelo HTML, e a camada visual torna conceitos concretos. Passa `doctrine/EVAL.md`.
