# SPEC — Lobby / Briefing

**Rota:** `/lobby/[code]`  
**Cena:** `lobby`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

A sala é um **briefing cerimonial de alto comando**. Cada jogador ocupa uma estação/posição ao redor do Brasil em vez de aparecer como card comum.

A composição MUST transmitir preparação coletiva sem comprometer a confiabilidade do fluxo realtime.

## Fonte de verdade

`LobbyClient` e o fluxo realtime vigente continuam sendo a fonte de verdade para:

- membros;
- host;
- nome/facção/cor;
- ready/unready;
- entrada/saída;
- reconexão;
- condições de início;
- navegação para a partida.

A cena MUST derivar desses dados. MUST NOT manter store visual concorrente que possa divergir.

## Composição

- Brasil/Mesa no centro;
- até seis estações/insígnias distribuídas ao redor em desktop;
- slots vazios comunicam capacidade disponível sem parecer erro;
- cada estação mostra identidade e estado em HTML legível;
- código da operação permanece fácil de localizar/copiar;
- ações locais permanecem em posição estável, independentes da câmera.

A posição visual de um jogador SHOULD ser determinística durante sua permanência na sala, evitando que estações troquem arbitrariamente de lugar a cada atualização.

## Estação de jogador

Cada estação MUST conseguir representar, quando o contrato vigente disponibilizar:

- nome;
- facção/cor;
- host quando aplicável;
- estado configurando/pronto;
- estado local/remoto relevante.

Informação MUST continuar compreensível sem o 3D.

## Ready

Ao ficar pronto, a Insígnia de Comando MAY virar, travar ou alinhar-se mecanicamente e adotar estado de autoridade.

A mudança MUST ser perceptível por texto e/ou forma/ícone, nunca apenas pela diferença vermelho/verde.

Ready/unready visual MUST reagir ao estado realtime confirmado, não antecipar um estado que o servidor ainda não aceitou como verdade definitiva.

## Conflito autorizado

Quando as condições vigentes de início forem satisfeitas, a cena MAY executar **`CONFLITO AUTORIZADO`**:

1. Coroa Orbital alinha seus aros;
2. vermelho aumenta brevemente;
3. Mesa/Brasil entram em estado de autorização;
4. navegação para o jogo acontece uma única vez.

A cerimônia MUST NOT criar uma segunda condição de start nem atrasar a navegação de modo relevante. Se a rota mudar antes do fim da animação, a animação é descartável.

## Estados

- `connecting`
- `connected`
- `slot-empty`
- `player-configuring`
- `player-ready`
- `host-ready`
- `waiting`
- `start-authorized`
- `reconnecting`
- `error`
- `reduced-motion`
- `scene-fallback`

Estados de rede MUST possuir feedback textual e recuperação coerente com o comportamento vigente.

## Responsividade

Desktop MAY usar organização radial ao redor da Mesa.

Mobile MUST priorizar informação:

- estações podem virar lista/faixa organizada;
- não forçar seis elementos ao redor de um mapa minúsculo;
- código e ready continuam alcançáveis por touch;
- facção/cor/status permanecem legíveis;
- a cena não empurra ações críticas para fora da viewport.

A literalidade espacial é secundária à usabilidade.

## Acessibilidade

MUST:

- anunciar/representar ready em texto acessível;
- manter controles de configuração e ready no DOM;
- fornecer foco visível;
- não depender da posição radial para indicar ordem/importância;
- não depender apenas de cor para host, facção ou prontidão quando houver risco de ambiguidade.

Atualizações realtime importantes SHOULD ser expostas de modo acessível sem produzir anúncios excessivos.

## Não fazer

MUST NOT:

- duplicar estado realtime;
- identificar ready apenas por cor;
- bloquear/ocultar copiar código;
- mover ações principais conforme a câmera;
- exigir 3D para entender membros/status;
- criar ordenação visual instável a cada evento;
- atrasar start para concluir animação;
- modificar condição de start por estética.

## Definition of Done

De 2 a 6 jogadores conseguem entrar, configurar-se, ficar prontos, reconectar e iniciar com a mesma confiabilidade do fluxo vigente; o espaço parece um briefing de alto comando e `EVAL.md` passa integralmente.
