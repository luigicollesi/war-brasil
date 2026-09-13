# EVAL — Lobby

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| LOB-01 | entrada/saída atualiza UI sem reload manual | multi-client integration/e2e |
| LOB-02 | ready/unready permanece sincronizado entre clientes | multi-client integration |
| LOB-03 | facção/cor continuam respeitando regras vigentes | regression test |
| LOB-04 | início ocorre uma única vez quando condições vigentes são satisfeitas | integration/e2e |
| LOB-05 | reconexão/erro têm estado textual e recuperável | e2e/manual |
| LOB-06 | código da sala é legível, selecionável/copiável | interaction test |
| LOB-07 | 2–6 jogadores são representáveis em desktop/mobile | visual + multi-state |
| LOB-08 | cena visual não é fonte paralela de verdade | inspection |
| LOB-09 | posição/estação do jogador não muda arbitrariamente em updates normais | integration/visual |
| LOB-10 | ready é perceptível sem depender apenas de cor/motion | accessibility/visual |
| LOB-11 | `CONFLITO AUTORIZADO` não atrasa nem duplica start | e2e/timing inspection |
| LOB-12 | WebGL/reduced-motion não impedem configuração, ready, copy ou start | fallback/manual |
| LOB-13 | ações críticas permanecem estáveis/visíveis durante movimento de câmera | visual/interaction |
| LOB-14 | `/lobby/[code]` não exige scroll de página em 1440x900 e 1366x768 | visual regression |
| LOB-15 | `/lobby/[code]` não exige scroll de página em 390x844 | visual regression |
| LOB-16 | viewport baixo 390x580 mantém código, painel ativo e ready alcançáveis | visual/manual |
| LOB-17 | Voltar leva deterministicamente a `/matchmaking` sem mutar sala/ready | static + interaction |
| LOB-18 | 1–6 jogadores não alteram a altura total da composição | visual + multi-state |
| LOB-19 | mobile alterna `Formação` / `Sua estação` sem duplicar estado realtime | inspection/interaction |

## Score / 100

- 30 — confiabilidade multiplayer;
- 20 — briefing/estações/Insígnia de Comando;
- 15 — legibilidade/hierarquia;
- 10 — viewport responsivo sem scroll;
- 10 — estabilidade espacial de 1–6 estações;
- 5 — mobile/acessibilidade;
- 5 — autorização/transição;
- 5 — performance/fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Cenários obrigatórios

- `LOB-S1`: host sozinho;
- `LOB-S2`: dois jogadores, um pronto;
- `LOB-S3`: seis jogadores;
- `LOB-S4`: jogador entra durante configuração;
- `LOB-S5`: jogador sai e slot libera corretamente;
- `LOB-S6`: ready/unready rápido;
- `LOB-S7`: reconexão;
- `LOB-S8`: todos prontos -> início único;
- `LOB-S9`: update realtime que não deveria reposicionar estações;
- `LOB-S10`: copiar código em desktop/mobile;
- `LOB-S11`: reduced-motion;
- `LOB-S12`: WebGL indisponível;
- `LOB-S13`: Voltar no estado conectado;
- `LOB-S14`: Voltar durante loading/erro;
- `LOB-S15`: 1440x900 sem scroll;
- `LOB-S16`: 1366x768 sem scroll;
- `LOB-S17`: 390x844 alternando Formação/Sua estação sem scroll;
- `LOB-S18`: 390x580 mantendo ready e controles prioritários;
- `LOB-S19`: seis jogadores não aumentam a altura da rota.

## Visual regression

Capturar 1440x900, 1366x768 e 390x844 nos estados:

- 1 jogador;
- 2 jogadores, um pronto;
- 6 jogadores;
- todos prontos;
- `start-authorized`;
- `reconnecting`;
- `error`;
- `reduced-motion`;
- `fallback`.

Capturar adicionalmente 390x580 com:

- Formação ativa;
- Sua estação ativa;
- 6 jogadores;
- usuário não pronto e pronto.

Snapshots seguem `../quality-standard.md`.

## Inspeção estrutural

Validar no código:

- page shell usa `height: 100dvh`, `min-height: 0` e `overflow: hidden`;
- workspace usa linhas/colunas com `minmax(0, 1fr)` em vez de alturas mínimas cumulativas;
- ready permanece no fluxo da grade e não usa `position: fixed`;
- formação usa exatamente seis posições sem crescer verticalmente com a ocupação;
- seletor mobile altera apenas estado visual local;
- `LobbyClient` continua sendo o controlador de requests/realtime;
- controle Voltar aponta explicitamente para `/matchmaking` e não dispara mutação de sala.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados ao Lobby em `../traceability.md` MUST permanecer presentes.
