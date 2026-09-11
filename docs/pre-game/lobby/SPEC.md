# SPEC — Lobby / Briefing

**Rota:** `/lobby/[code]`  
**Cena:** `lobby`

## Fantasia

A sala é um **briefing cerimonial**. Cada jogador ocupa uma posição de comando ao redor do Brasil em vez de aparecer como card comum.

## Contrato funcional preservado

`LobbyClient` e o fluxo realtime existente continuam sendo a fonte de verdade para membros, host, facção/cor, ready, saída e início da partida. O redesign é uma camada de apresentação e não deve recriar sincronização.

## Composição

- Brasil/Mesa no centro;
- até seis estações/insígnias distribuídas ao redor;
- estação vazia indica slot disponível sem parecer erro;
- nome, facção/cor e estado de prontidão devem ser legíveis sem depender da geometria 3D;
- código da operação permanece fácil de copiar.

## Ready

Ao ficar pronto, a Insígnia de Comando pode virar/alinha-se mecanicamente e adotar um estado de autoridade. A mudança precisa ser perceptível por texto/forma, não apenas cor.

Quando todos os requisitos de início forem atendidos, a cena pode realizar `CONFLITO AUTORIZADO`: alinhamento dos aros, aumento breve do vermelho e transição para jogo. A transição nunca atrasa a navegação de forma relevante.

## Estados

`connecting`, `connected`, `slot-empty`, `player-configuring`, `player-ready`, `host-ready`, `waiting`, `start-authorized`, `reconnecting`, `error`, `reduced-motion`.

## Responsividade

Em telas pequenas, as estações podem tornar-se uma faixa/lista radial simplificada. Não forçar seis elementos ao redor de um mapa minúsculo. A informação vem antes da literalidade espacial.

## Não fazer

- duplicar estado realtime em store visual concorrente;
- identificar ready apenas por vermelho/verde;
- bloquear copiar código;
- mover ações principais para posições que variam com câmera;
- exigir 3D para compreender quem está na sala.

## Definition of Done

Um grupo consegue configurar-se e iniciar jogo com a mesma confiabilidade atual, mas o lobby parece um briefing de alto comando e passa `lobby/EVAL.md`.
