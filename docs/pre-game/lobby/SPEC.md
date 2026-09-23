# SPEC — Lobby / Briefing

**Rota:** `/lobby/[code]`  
**Cena:** `lobby`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

A sala é uma **sala de guerra cerimonial de alto comando**. O jogador deve enxergar a formação da operação, configurar sua própria estação e confirmar prontidão sem navegar por uma página longa.

A composição MUST transmitir preparação coletiva sem comprometer a confiabilidade do fluxo realtime.

A referência de experiência é diegética: a interface deve parecer parte de uma máquina militar/estratégica, e não um dashboard SaaS composto por cards independentes.

## Fonte de verdade

`LobbyClient` e o fluxo realtime vigente continuam sendo a fonte de verdade para:

- membros;
- host;
- nome de exibição/handle/cor;
- ready/unready;
- entrada/saída;
- reconexão;
- lease de presença enquanto a sala está em `waiting`;
- condições de início;
- participação ativa e navegação para a partida.

Componentes visuais MUST receber esse estado. MUST NOT manter store concorrente de sala que possa divergir.

Estado local de apresentação, como selecionar `Formação` ou `Sua estação` no mobile, MAY existir desde que não replique membros, ready, host ou condições de início.

## Navegação de retorno

A sala MUST possuir um único controle explícito `Voltar para Operações` para encerrar a participação no lobby e, somente após a confirmação autoritativa do servidor, navegar para `/matchmaking`.

O retorno:

- MUST ser determinístico;
- MUST NOT depender de `history.back()`;
- MUST executar a saída autoritativa do assento em `waiting` antes da navegação;
- MUST limpar a participação ativa somente após a saída ser confirmada;
- MUST deletar a sala quando a saída remover o último jogador humano, reutilizando o lifecycle autoritativo existente;
- MUST NOT existir um segundo botão concorrente de saída da sala;
- MUST permanecer disponível também nos estados iniciais de loading/erro.

## Participação e presença

Enquanto um jogador humano possuir assento autoritativo na sala em `waiting`, a navegação autenticada MUST reconduzi-lo para `/lobby/[code]` até que o assento seja encerrado.

A presença no lobby MUST:

- atualizar `lobby_last_seen_at` sem sobrepor requests de heartbeat;
- remover automaticamente somente assentos humanos de salas `waiting` após 20 segundos sem heartbeat confirmado;
- MUST NOT remover automaticamente jogadores após a sala sair de `waiting`;
- reconciliar salas afetadas via realtime;
- deletar uma sala `waiting` quando o último humano for removido.

## Composição de viewport

A rota MUST funcionar como uma **estação de comando de uma única viewport**.

A estrutura principal é:

```text
Sala de Guerra
├── barra de comando
│   ├── Voltar
│   ├── chave/copiar
│   └── conexão/ocupação
├── workspace
│   ├── Formação / Mesa de Guerra Brasil
│   └── Credencial da estação local
└── trilho de autorização / ready
```

MUST:

- tratar `100dvh` como orçamento máximo da rota;
- manter o shell com `min-height: 0` e sem scroll de página em estado normal;
- manter código, configuração e ready dentro da viewport;
- evitar `min-height` acumulativo que force crescimento vertical;
- manter prontidão no fluxo da composição, sem depender de uma barra `fixed` sobrepondo conteúdo;
- reduzir primeiro conteúdo explicativo/ornamental em alturas baixas;
- preservar erros e ações críticas;
- adicionar complexidade prioritariamente por composição horizontal, camadas, linhas, telemetria e overlays contidos, nunca empilhando novas seções verticais;
- MUST NOT usar `overflow-y: auto` ou `overflow-y: scroll` como solução para acomodar a sala normal.

## Identidade visual da sala de guerra

A sala MUST preservar a linguagem War Brasil: verde militar profundo, vermelho de conflito e dourado/latão de autoridade e prestígio.

Desktop SHOULD usar três objetos visuais principais:

1. **Mesa de Guerra Brasil** — objeto estratégico central da formação;
2. **Credencial de Comando** — identidade visual do jogador local;
3. **Trilho de Autorização** — leitura coletiva dos seis canais de ready.

A estética SHOULD usar geometrias militares angulares, trilhos, conectores, marcações técnicas, projeção/holograma e superfícies metálicas discretas em vez de grandes cards arredondados.

Vermelho SHOULD permanecer reservado para falha, alerta e `CONFLITO AUTORIZADO`; estados normais usam verde militar, branco quente e latão.

Animações ornamentais MUST ser leves, preferencialmente `transform`/`opacity`, e MUST respeitar `prefers-reduced-motion`.

## Formação / Mesa de Guerra Brasil

A formação representa até seis postos simultaneamente.

MUST:

- representar `1–6` jogadores sem alterar a altura total da página;
- manter slots vazios legíveis;
- manter o heading `{n}/6 postos ocupados` como marcador semântico estável;
- manter posição visual determinística para jogadores durante updates normais;
- permitir que o host adicione/remova bots pelos contratos vigentes;
- representar ready por texto/forma, não somente por cor.

No desktop:

- os seis postos SHOULD ocupar duas alas laterais estáveis, três à esquerda e três à direita;
- o centro SHOULD ser uma Mesa de Guerra com o mapa do Brasil como âncora visual;
- conexões visuais entre postos e mesa MAY reagir ao estado ready, sem criar estado funcional adicional;
- o mapa central é decorativo e MUST NOT ser necessário para entender ou operar a sala.

No mobile, a Mesa de Guerra central MAY desaparecer completamente para liberar orçamento de viewport. Os seis postos MUST então recompor-se em matriz compacta `2×3`.

## Sua estação / Credencial de Comando

A estação local MUST manter acessíveis:

- nome de exibição e `@handle` vindos do perfil autenticado, em modo somente leitura;
- seis cores vigentes;
- indisponibilidade de cores ocupadas;
- feedback de erro;
- informação de que alterar a cor revoga ready quando aplicável.

A identidade atual SHOULD possuir uma credencial/insígnia visível derivada do nome de exibição, handle e cor confirmados pelo servidor.

A credencial é ornamental/identitária e MUST ser compactada ou removida antes dos controles em viewport baixo.

A UI MUST NOT permitir um nome de facção paralelo para jogadores humanos. Bots MAY continuar usando nomes de facção próprios do catálogo.

A UI MUST NOT alterar regras ou endpoints para caber no novo layout.

## Ready / Trilho de Autorização

O controle de prontidão MUST permanecer continuamente alcançável no shell da sala.

Ready/unready visual MUST reagir ao estado realtime confirmado, não antecipar um estado que o servidor ainda não aceitou como verdade definitiva.

O dock SHOULD representar os seis postos como canais de autorização derivados exclusivamente de `players`:

- vazio;
- configurando;
- pronto.

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
- compactar primeiro mapa central, credencial, descrições e metadados quando a altura disponível cair;
- não transformar a rota em uma lista vertical longa;
- não introduzir scroll interno de painel como fallback normal.

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
4. trilho de autorização assume estado de conflito;
5. navegação para o jogo acontece uma única vez.

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
- manter labels/nomes acessíveis de copiar código, salvar facção e ready;
- tratar mapa/holograma puramente ornamental como decorativo para tecnologias assistivas.

Atualizações realtime importantes SHOULD ser expostas de modo acessível sem produzir anúncios excessivos.

## Não fazer

MUST NOT:

- duplicar estado realtime;
- identificar ready apenas por cor;
- bloquear/ocultar copiar código;
- usar `history.back()` como única navegação de retorno;
- tratar Voltar como saída destrutiva da sala;
- exigir 3D ou o holograma Brasil para entender membros/status;
- criar ordenação visual instável a cada evento;
- reintroduzir barra de ready `fixed` que cubra conteúdo;
- permitir scroll de página como solução para acomodar a composição;
- permitir scroll interno como solução normal para excesso de ornamento;
- atrasar start para concluir animação;
- modificar condição de start por estética.

## Definition of Done

De 2 a 6 jogadores conseguem entrar, configurar-se, ficar prontos, reconectar e iniciar com a mesma confiabilidade do fluxo vigente; Matchmaking e Lobby possuem retorno explícito; o Lobby apresenta Mesa de Guerra Brasil, Credencial de Comando e Trilho de Autorização sem criar estado paralelo; permanece contido em uma viewport desktop/mobile normal; e `EVAL.md` passa integralmente.
