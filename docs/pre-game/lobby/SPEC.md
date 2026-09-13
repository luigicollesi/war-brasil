# SPEC — Lobby / Briefing

**Rota:** `/lobby/[code]`  
**Cena:** `lobby`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

A sala é um **briefing cerimonial de alto comando**. O jogador deve enxergar a formação da operação, configurar sua própria estação e confirmar prontidão sem navegar por uma página longa.

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

Componentes visuais MUST receber esse estado. MUST NOT manter store concorrente de sala que possa divergir.

Estado local de apresentação, como selecionar `Formação` ou `Sua estação` no mobile, MAY existir desde que não replique membros, ready, host ou condições de início.

## Navegação de retorno

A sala MUST possuir controle explícito `Voltar` para `/matchmaking`.

O retorno:

- MUST ser determinístico;
- MUST NOT depender de `history.back()`;
- MUST NOT remover jogador, apagar sala, alterar ready ou realizar request de saída implicitamente;
- MUST permanecer disponível também nos estados iniciais de loading/erro.

## Composição de viewport

A rota MUST funcionar como uma **estação de comando de uma única viewport**.

A estrutura principal é:

```text
Sala de Comando
├── barra de comando
│   ├── Voltar
│   ├── código/copiar
│   └── conexão/ocupação
├── workspace
│   ├── Formação da operação
│   └── Sua estação
└── dock de prontidão
```

MUST:

- tratar `100dvh` como orçamento máximo da rota;
- manter o shell com `min-height: 0` e sem scroll de página em estado normal;
- manter código, configuração e ready dentro da viewport;
- evitar `min-height` acumulativo que force crescimento vertical;
- manter o dock de prontidão no fluxo da composição, sem depender de uma barra `fixed` sobrepondo conteúdo;
- reduzir primeiro conteúdo explicativo/ornamental em alturas baixas;
- preservar erros e ações críticas.

## Formação

A formação representa até seis postos simultaneamente.

MUST:

- representar `1–6` jogadores sem alterar a altura total da página;
- manter slots vazios legíveis;
- manter o heading `{n}/6 postos ocupados` como marcador semântico estável;
- manter posição visual determinística para jogadores durante updates normais;
- permitir que o host adicione/remova bots pelos contratos vigentes;
- representar ready por texto/forma, não somente por cor.

Desktop SHOULD usar os seis postos dentro de uma área compacta associada à Mesa/Brasil da Foundation.

## Sua estação

A estação local MUST manter acessíveis:

- nome da facção;
- salvar nome;
- seis cores vigentes;
- indisponibilidade de cores ocupadas;
- feedback de erro;
- informação de que alterar identidade revoga ready quando aplicável.

A UI MUST NOT alterar regras ou endpoints para caber no novo layout.

## Ready

O controle de prontidão MUST permanecer continuamente alcançável no shell da sala.

Ready/unready visual MUST reagir ao estado realtime confirmado, não antecipar um estado que o servidor ainda não aceitou como verdade definitiva.

Ao ficar pronto, a Insígnia de Comando MAY alinhar-se mecanicamente e adotar estado de autoridade.

A mudança MUST ser perceptível por texto e/ou forma/ícone, nunca apenas pela diferença vermelho/verde.

## Mobile

Em largura compacta, a literalidade espacial é secundária à usabilidade.

Mobile MUST:

- usar alternância visual `Formação` / `Sua estação` dentro da mesma área de workspace;
- manter esse seletor apenas como estado de apresentação local;
- representar a formação em grade compacta de até seis postos;
- manter `Voltar`, código/copiar e status essenciais no topo;
- manter o CTA de ready visível no dock inferior;
- manter input e cores alcançáveis por touch;
- compactar descrições e metadados quando a altura disponível cair;
- não transformar a rota em uma lista vertical longa.

Viewports-alvo mínimos de regressão: `390x844` e `390x580`.

## Desktop

Desktop MUST manter Formação e Sua estação simultaneamente visíveis quando houver espaço.

Viewports-alvo mínimos de regressão: `1440x900` e `1366x768`.

## Reconexão e erros

Estados de rede MUST possuir feedback textual e recuperação coerente com o comportamento vigente.

Avisos de reconexão SHOULD ocupar uma camada/banda controlada sem aumentar indefinidamente a altura da página.

Loading e erro fatal MUST respeitar o mesmo orçamento de viewport e manter o controle Voltar acessível.

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

## Acessibilidade

MUST:

- anunciar/representar ready em texto acessível;
- manter controles de configuração e ready no DOM;
- fornecer foco visível;
- não depender da posição dos postos para indicar ordem/importância;
- não depender apenas de cor para host, facção ou prontidão quando houver risco de ambiguidade;
- manter labels/nomes acessíveis de copiar código, salvar facção e ready.

Atualizações realtime importantes SHOULD ser expostas de modo acessível sem produzir anúncios excessivos.

## Não fazer

MUST NOT:

- duplicar estado realtime;
- identificar ready apenas por cor;
- bloquear/ocultar copiar código;
- usar `history.back()` como única navegação de retorno;
- tratar Voltar como saída destrutiva da sala;
- exigir 3D para entender membros/status;
- criar ordenação visual instável a cada evento;
- reintroduzir barra de ready `fixed` que cubra conteúdo;
- permitir scroll de página como solução principal para acomodar a composição;
- atrasar start para concluir animação;
- modificar condição de start por estética.

## Definition of Done

De 2 a 6 jogadores conseguem entrar, configurar-se, ficar prontos, reconectar e iniciar com a mesma confiabilidade do fluxo vigente; Matchmaking e Lobby possuem retorno explícito; o Lobby permanece contido em uma viewport desktop/mobile normal; e `EVAL.md` passa integralmente.
