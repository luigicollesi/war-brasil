# SPEC — Home / Entrada no Comando

**Rota:** `/`  
**Cena:** `entrance`

## Fantasia

A primeira tela é um **ritual de autorização**. O usuário não recebe um menu imediatamente; ele descobre uma instalação de comando e a Mesa de Domínio.

## Objetivos do usuário

- entender em poucos segundos que está no WAR Brasil;
- iniciar uma partida;
- acessar Doutrina/Regras;
- acessar Perfil;
- não precisar assistir a uma introdução longa para agir.

## Sequência principal

1. Primeira carga mostra composição estável imediatamente.
2. Boot cerimonial curto pode revelar Terra -> Brasil -> projeção -> Mesa de Domínio.
3. A marca WAR Brasil e `ENTRAR NO COMANDO` recebem prioridade.
4. Após entrada, revelar `OPERAÇÕES`, `DOUTRINA` e `COMANDO` espacialmente ao redor da mesa.
5. `OPERAÇÕES` conduz a `/matchmaking`, `DOUTRINA` a `/rules`, `COMANDO` a `/profile`.

A introdução deve ser pulável e reduzida em visitas repetidas da mesma sessão. `prefers-reduced-motion` começa diretamente no estado estável.

## Composição desktop

- Mesa de Domínio como protagonista, não background genérico.
- Brasil unido em 42 placas com linhas douradas discretas.
- Coroa Orbital em movimento lento.
- UI textual mínima, sem grade de cards.
- vermelho praticamente ausente antes de selecionar Operações.

## Composição mobile

- Brasil/Mesa ocupa faixa superior/central sem impedir leitura;
- CTA principal na zona inferior;
- após entrar, três destinos são grandes o suficiente para touch;
- sem parallax obrigatório ou hover informativo.

## Estados

`boot`, `awaiting-entry`, `command-open`, `transitioning`, `reduced-motion`, `scene-fallback`.

## SEO

Preservar metadata e structured data relevantes já existentes na Home. Mudança visual não deve remover indexabilidade, título, descrição e representação WebApplication.

## Não fazer

- hero tradicional com título à esquerda e imagem à direita;
- cards grandes para as três opções;
- Terra/globo como único diferencial;
- intro > 3 s antes de haver forma clara de pular/interagir;
- vermelho pulsando continuamente;
- texto de marketing longo acima da dobra.

## Definition of Done

A Home produz um momento de entrada memorável, continua imediatamente utilizável e passa `home/EVAL.md`.
