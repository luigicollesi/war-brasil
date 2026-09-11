# SPEC — Doutrina / Regras

**Rota:** `/rules`  
**Cena:** `doctrine`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

As regras são uma **demonstração estratégica da máquina**. A Mesa de Domínio desmonta conceitos, rotas e peças para ensinar o jogo; a página não deve parecer wiki ou manual estático genérico.

## Fonte de verdade

A Doutrina MUST ensinar as regras vigentes do jogo, não uma cópia paralela inventada para a interface.

Ao implementar cada capítulo, o autor MUST confrontar texto/exemplo com a fonte de verdade disponível no código, dados e documentação ativa. Se houver divergência entre regra histórica e comportamento implementado, a divergência deve ser resolvida explicitamente antes de publicar o conteúdo como regra.

## Migração da Home

A Home atual inclui `GameQuickGuide`. Conteúdo válido SHOULD ser reaproveitado/migrado. A nova Home MUST NOT carregar o manual completo; `/rules` torna-se destino dedicado.

A migração MUST evitar manter duas versões independentes das mesmas regras.

## Núcleo mínimo

A página MUST cobrir pelo menos:

1. Preparação
2. Reforços
3. Ataque
4. Conquista
5. Movimentação
6. Cartas
7. Objetivos

Além desse núcleo, MUST existir capítulo/seção para **toda mecânica adicional que esteja ativa e afete decisões do jogador** no build alvo — por exemplo barreiras, conexões especiais, eventos ou outras regras específicas do WAR Brasil — somente quando realmente fizerem parte da fonte de verdade vigente.

O spec não ativa essas mecânicas; apenas impede omissão documental caso existam.

## Modelo de interação

Um índice de capítulos MUST permanecer acessível. Selecionar capítulo atualiza conteúdo/demonstração sem scroll inesperado, perda de foco ou reset desnecessário.

SHOULD oferecer próximo/anterior e deep-link/âncora quando a arquitetura da página permitir.

## Demonstrações

A cena é uma explicação adicional. Exemplos SHOULD reutilizar primitives/assets reais quando isso melhora fidelidade sem acoplar a Doutrina ao estado de uma partida.

Exemplos mínimos:

- **Preparação:** distribuição/estado inicial conforme regra vigente;
- **Reforços:** origem e alocação de tropas;
- **Ataque:** dois territórios, adjacência/rota, quantidade de dados e resolução coerentes com a regra atual;
- **Conquista:** transferência após conquista, mantendo as restrições vigentes;
- **Movimentação:** origem/destino/conexão válida conforme regra;
- **Cartas:** artwork/símbolos reais do jogo e troca conforme mecânica vigente;
- **Objetivos:** explicar sistema sem revelar objetivo privado de uma partida real.

Se barreiras/conexões especiais/eventos estiverem ativos, a demonstração MUST explicar seu efeito sem criar nova regra.

## Progressive enhancement

Todo conteúdo essencial MUST existir em HTML semanticamente navegável. Canvas/3D nunca é a única fonte da regra.

A página MUST continuar ensinando com:

- WebGL indisponível;
- reduced-motion;
- teclado;
- viewport mobile.

## Acessibilidade didática

- headings refletem hierarquia dos capítulos;
- índice usa controles/links semanticamente adequados;
- exemplos visuais possuem equivalente textual suficiente;
- dados/ícones não são explicados apenas por cor;
- mudança de capítulo preserva foco previsível.

## Mobile

O índice MAY virar navegação horizontal, drawer ou select acessível. Texto e exemplos MUST permanecer legíveis sem zoom horizontal e nunca ficar sob o Canvas.

Demonstrações MAY simplificar perspectiva/quantidade de objetos no mobile.

## Não fazer

MUST NOT:

- criar texto gigante contínuo sem índice;
- duplicar/reinventar lógica de regra na cena;
- ensinar regra com base apenas em memória/documento antigo;
- depender de hover;
- transformar tutorial em partida simulada complexa;
- carregar tabuleiro completo quando exemplo reduzido basta;
- revelar informação privada de uma partida real;
- manter cópia divergente do guia na Home.

## Definition of Done

Um jogador aprende todas as mecânicas vigentes apenas pelo conteúdo HTML; a Mesa torna os conceitos concretos sem virar fonte de regra. `EVAL.md` passa integralmente.
