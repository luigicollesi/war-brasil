# EVAL — Modos de Jogo: Objetivo e Supremacia

Avaliar conforme `SPEC.md`, `docs/pre-game/lobby/SPEC.md`, `docs/pre-game/quality-standard.md` e os padrões arquiteturais vigentes do projeto.

Aprovação exige **todos os BLOCKERs verdes**.

A implementação não pode introduzir regressão no modo atual de objetivos nem no balanceamento de dados vigente quando `Sorte balanceada` estiver ligado.

## Gates BLOCKER — modelo de domínio

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-DOM-01 | existem exatamente dois rulesets nesta V1: `objective` e `supremacy` | shared contract/source review |
| MODE-DOM-02 | `match_mode` existente continua separado de `ruleset` | schema/service review |
| MODE-DOM-03 | `balanced_dice_enabled` é independente do ruleset | schema/contract |
| MODE-DOM-04 | default de ruleset para salas legadas/novas sem configuração explícita é `objective` | migration/integration |
| MODE-DOM-05 | default de balanceamento é `true` | migration/integration |
| MODE-DOM-06 | PostgreSQL é a fonte de verdade das opções da sala | DB→DTO/source review |
| MODE-DOM-07 | frontend/realtime não definem ruleset autoritativo independente | source review |
| MODE-DOM-08 | inserts legados de `game.rooms` sem novos campos continuam válidos | DB integration |

## Gates BLOCKER — autoridade e configuração da sala

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-CFG-01 | somente o host pode alterar settings | authorization integration |
| MODE-CFG-02 | não-host recebe erro e nenhuma configuração muda | negative API test |
| MODE-CFG-03 | ator deve pertencer à sala | authorization test |
| MODE-CFG-04 | settings só podem ser alterados com `room.status='waiting'` | integration |
| MODE-CFG-05 | tentativa de alteração em `order_roll` falha sem mutação | integration |
| MODE-CFG-06 | tentativa de alteração em `playing` falha sem mutação | integration |
| MODE-CFG-07 | payload aceita somente campos previstos | route contract test |
| MODE-CFG-08 | valores de ruleset desconhecidos são rejeitados | negative API test |
| MODE-CFG-09 | browser não pode escolher `hostId`, `winnerId`, `diceProfileId` ou identidade autoritativa | negative API/source test |
| MODE-CFG-10 | alteração efetiva de qualquer setting revoga ready de todos os humanos | transaction integration |
| MODE-CFG-11 | bots preservam readiness conforme política vigente | integration |
| MODE-CFG-12 | alteração + reset de ready são atômicos | failure/transaction test |
| MODE-CFG-13 | no-op com valores já persistidos não precisa revogar ready | integration/contract |
| MODE-CFG-14 | autoridade de gerenciamento é derivada pelo servidor, não por índice local do frontend | source/security review |

## Gates BLOCKER — concorrência de configuração e start

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-CON-01 | settings e start não podem produzir match com configuração parcial | concurrency integration |
| MODE-CON-02 | se start vencer a corrida e sala sair de `waiting`, settings falha | concurrency integration |
| MODE-CON-03 | se settings vencer a corrida, ready é revogado antes de start subsequente | concurrency integration |
| MODE-CON-04 | nenhuma corrida gera dois matches correntes ou snapshots contraditórios | DB concurrency |
| MODE-CON-05 | revision/sync final converge para o estado persistido | multi-client/integration |

## Gates BLOCKER — lobby snapshot e realtime

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-LOB-01 | lobby snapshot expõe ruleset autoritativo | contract/integration |
| MODE-LOB-02 | lobby snapshot expõe `balancedDiceEnabled` autoritativo | contract/integration |
| MODE-LOB-03 | snapshot expõe capability de gerenciamento de sala ou equivalente seguro | contract/security |
| MODE-LOB-04 | host observa mudança confirmada pelo servidor | E2E |
| MODE-LOB-05 | convidados observam mudança por sync/refresh autoritativo | multi-client E2E |
| MODE-LOB-06 | reconnect recupera ruleset correto sem estado local prévio | reconnect E2E |
| MODE-LOB-07 | reconnect recupera sorte balanceada correta | reconnect E2E |
| MODE-LOB-08 | nenhum store concorrente de configuração pode divergir do lobby snapshot | source review |

## Gates BLOCKER — UX da configuração

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-UX-01 | host possui um botão compacto de configurações integrado à barra de comando | DOM/visual |
| MODE-UX-02 | botão possui nome acessível equivalente a `Configurações da sala` | accessibility test |
| MODE-UX-03 | não-host não recebe controles editáveis | DOM + authorization |
| MODE-UX-04 | painel contém somente os controles funcionais `Objetivo/Supremacia` e `Sorte balanceada` | DOM/visual |
| MODE-UX-05 | seleção de modo é compacta e inequívoca | DOM/visual |
| MODE-UX-06 | toggle de sorte possui semântica de switch ou equivalente acessível | accessibility test |
| MODE-UX-07 | estado ON/OFF não depende apenas de cor | accessibility/visual |
| MODE-UX-08 | foco por teclado é visível | accessibility/manual/E2E |
| MODE-UX-09 | painel não introduz uma nova seção vertical permanente no lobby | visual review |
| MODE-UX-10 | desktop usa popover/painel contido ou solução equivalente sem quebrar viewport | visual regression 1440x900, 1366x768 |
| MODE-UX-11 | mobile mantém configuração alcançável sem transformar a rota em lista longa | visual regression 390x844, 390x580 |
| MODE-UX-12 | mobile não depende de scroll de página para acessar ready por causa do painel | visual regression |
| MODE-UX-13 | visual preserva linguagem militar/latão/verde vigente e evita dashboard SaaS | visual review |
| MODE-UX-14 | animações respeitam `prefers-reduced-motion` | CSS/source test |
| MODE-UX-15 | todos os jogadores possuem resumo somente leitura das regras ativas | DOM/E2E |

## Gates BLOCKER — início de partida e snapshots

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-START-01 | start lê settings persistidos da sala, não valores fornecidos pelo browser no comando de start | source/integration |
| MODE-START-02 | match congela `ruleset_snapshot` ou equivalente | schema/integration |
| MODE-START-03 | match congela `balanced_dice_enabled_snapshot` ou equivalente | schema/integration |
| MODE-START-04 | `match_mode_snapshot` existente preserva sua semântica atual | schema/regression |
| MODE-START-05 | perfil efetivo de dados continua congelado por match | DB integration |
| MODE-START-06 | start captura settings e cria match/artefatos dentro do boundary transacional vigente | transaction review |
| MODE-START-07 | alteração posterior da sala não reescreve snapshot de match histórico | integration |
| MODE-START-08 | match histórico identifica ruleset, flag de balanceamento e perfil efetivo | query/integration |

## Gates BLOCKER — modo Objetivo

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-OBJ-01 | `objective` continua atribuindo objetivos individuais | integration |
| MODE-OBJ-02 | `game.player_objectives` continua sendo usado no modo Objetivo | DB integration |
| MODE-OBJ-03 | tipos e regras de objetivo existentes continuam avaliados | regression tests |
| MODE-OBJ-04 | objetivos de eliminação/fallback continuam válidos | regression/integration |
| MODE-OBJ-05 | objetivo privado do jogador continua presente no game snapshot | contract/E2E |
| MODE-OBJ-06 | vitória por objetivo marca `status='finished'`, `phase='finished'` e vencedor correto | integration |
| MODE-OBJ-07 | a introdução do dispatcher de vitória não altera resultado dos testes atuais de objetivos | existing suite |
| MODE-OBJ-08 | modo Objetivo não exige branch duplicada das regras já existentes | source review |

## Gates BLOCKER — modo Supremacia

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-SUP-01 | Supremacia inicia sem criar `game.player_objectives` falsos | DB integration |
| MODE-SUP-02 | distribuição inicial de territórios permanece igual ao fluxo vigente | regression/integration |
| MODE-SUP-03 | cartas continuam criadas normalmente | integration |
| MODE-SUP-04 | eventos e fases normais continuam ativos | regression |
| MODE-SUP-05 | total de territórios para vitória é derivado da partida, não de literal autoritativo espalhado no código | source/unit |
| MODE-SUP-06 | `total_territories=0` nunca produz vitória | unit/integration negative |
| MODE-SUP-07 | controlar todos menos um território não vence | integration |
| MODE-SUP-08 | controlar todos os territórios vence | integration |
| MODE-SUP-09 | vencedor é exatamente o proprietário de todos os territórios | DB assertion |
| MODE-SUP-10 | vitória marca `status='finished'` e `phase='finished'` | DB assertion |
| MODE-SUP-11 | vitória registra `winner_player_id` correto | DB assertion |
| MODE-SUP-12 | vitória é avaliada após mudança autoritativa de ownership | source/integration |
| MODE-SUP-13 | mudança exclusiva de tropas não precisa disparar vitória de Supremacia | source/query regression |
| MODE-SUP-14 | nenhum terceiro jogador vence pela eliminação feita por outro | elimination integration |
| MODE-SUP-15 | partida terminal não exige ação extra de manobra/conquista para reconhecer vitória | E2E/integration |
| MODE-SUP-16 | `myObjective` é `null`/ausente conforme contrato em Supremacia | snapshot contract |
| MODE-SUP-17 | UI não fabrica missão secreta para Supremacia | DOM/source |

## Gates BLOCKER — eliminação

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-ELIM-01 | jogador sem territórios sai da ordem ativa conforme comportamento atual | integration |
| MODE-ELIM-02 | jogador eliminado permanece como participante histórico | DB integration |
| MODE-ELIM-03 | automação do bot eliminado é desativada conforme fluxo vigente | integration |
| MODE-ELIM-04 | cartas da mão seguem transferência vigente para o conquistador | integration |
| MODE-ELIM-05 | em Objetivo, avaliações de eliminação existentes continuam funcionando | regression |
| MODE-ELIM-06 | em Supremacia, eliminação só pode encerrar partida se resultar em domínio total | integration |
| MODE-ELIM-07 | conquista do último território do último adversário termina com vencedor correto | integration/E2E |

## Gates BLOCKER — motor de vitória

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-WIN-01 | existe uma fronteira central de avaliação de vitória ou equivalente arquitetural claro | source review |
| MODE-WIN-02 | dispatcher seleciona política pelo ruleset persistido/snapshot autoritativo | unit/integration |
| MODE-WIN-03 | command services não espalham branches de `objective/supremacy` desnecessariamente | source review |
| MODE-WIN-04 | política de Objetivo reutiliza regra existente, não cópia divergente | source review |
| MODE-WIN-05 | política de Supremacia é testável isoladamente | unit test |
| MODE-WIN-06 | finalização respeita o boundary transacional de gameplay | transaction integration |
| MODE-WIN-07 | encerramento do match também finaliza estado de balanceamento conforme comportamento vigente | integration |

## Gates BLOCKER — sorte balanceada ligada

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-DICE-ON-01 | `balanced_dice_enabled=true` usa o resolver atual de perfil padrão | service/integration |
| MODE-DICE-ON-02 | configuração atual normalmente resolve `adaptive-halves-v1` | DB integration fixture/current config |
| MODE-DICE-ON-03 | validação exata do perfil adaptativo permanece vigente | existing dice tests |
| MODE-DICE-ON-04 | fallback seguro atual continua válido quando configuração do catálogo está inválida | regression |
| MODE-DICE-ON-05 | ruleset não altera probabilidades por si só | cross-mode integration |

## Gates BLOCKER — sorte balanceada desligada

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-DICE-OFF-01 | `balanced_dice_enabled=false` resolve perfil uniforme | integration |
| MODE-DICE-OFF-02 | `uniform-v1` é usado quando disponível e válido | DB integration |
| MODE-DICE-OFF-03 | fallback builtin uniforme, se necessário, é registrado como perfil efetivo | failure integration |
| MODE-DICE-OFF-04 | profile snapshot continua sendo persistido | DB assertion |
| MODE-DICE-OFF-05 | resultado não passa pelo algoritmo adaptativo quando desligado | unit/integration/source |
| MODE-DICE-OFF-06 | browser não pode escolher diretamente pesos/probabilidades/perfil arbitrário | negative API/security |
| MODE-DICE-OFF-07 | desligar balanceamento não desativa cosmético de dado nem altera suas regras visuais | regression |

## Gates BLOCKER — bots

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-BOT-01 | bot de Objetivo continua recebendo/interpretando objetivo vigente | regression |
| MODE-BOT-02 | bot de Supremacia funciona sem linha em `game.player_objectives` | bot integration |
| MODE-BOT-03 | estado estratégico do bot representa explicitamente o ruleset ou contexto equivalente | contract/source |
| MODE-BOT-04 | Supremacia possui planner explícito ou caminho testável de expansão territorial | unit tests |
| MODE-BOT-05 | bot de Supremacia consegue selecionar alvo de ataque válido | bot unit/integration |
| MODE-BOT-06 | bot de Supremacia não falha por acesso obrigatório a objetivo inexistente | negative regression |
| MODE-BOT-07 | bot eliminado não recebe novas ações | integration |

## Gates BLOCKER — game snapshot e UI

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-GAME-01 | game snapshot expõe ruleset efetivo da partida | contract/integration |
| MODE-GAME-02 | cliente não consulta profile/store para descobrir ruleset | source review |
| MODE-GAME-03 | Objetivo preserva apresentação da missão atual | visual/E2E regression |
| MODE-GAME-04 | Supremacia mostra identificação compacta do modo | DOM/visual |
| MODE-GAME-05 | Supremacia mostra progresso territorial derivado do snapshot público | DOM/unit |
| MODE-GAME-06 | total exibido corresponde ao total real de territórios da partida | DOM/integration |
| MODE-GAME-07 | informação de Supremacia não reduz de forma relevante a área principal do mapa | visual review |
| MODE-GAME-08 | snapshot de Supremacia não vaza dado privado de objetivos porque tais objetivos não existem | contract/security |

## Gates BLOCKER — rematch e retorno ao lobby

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-REMATCH-01 | rematch preserva ruleset atual da sala | integration |
| MODE-REMATCH-02 | rematch preserva flag atual de balanceamento | integration |
| MODE-REMATCH-03 | rematch cria novo match com novos snapshots autoritativos | DB integration |
| MODE-REMATCH-04 | alterar settings após retorno ao lobby afeta somente próxima partida | integration |
| MODE-REMATCH-05 | match anterior permanece historicamente imutável | DB assertion |
| MODE-REMATCH-06 | retorno ao lobby reabilita edição apenas quando status volta a `waiting` | integration/E2E |

## Gates BLOCKER — segurança

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-SEC-01 | cliente não pode declarar vencedor | negative API/source |
| MODE-SEC-02 | cliente não pode alterar ruleset durante gameplay | negative API |
| MODE-SEC-03 | cliente não pode alterar balanceamento durante gameplay | negative API |
| MODE-SEC-04 | cliente não pode enviar contagem territorial como autoridade de vitória | negative API/source |
| MODE-SEC-05 | cliente não pode injetar profile de dados arbitrário | negative API |
| MODE-SEC-06 | erros não expõem SQL, connection string ou secrets | API security test |
| MODE-SEC-07 | configuração é isolada por room e não afeta outra sala | multi-room integration |

## Gates BLOCKER — regressão

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| MODE-REG-01 | suites atuais de objetivos permanecem verdes | existing tests |
| MODE-REG-02 | suites atuais de combate permanecem verdes | existing tests |
| MODE-REG-03 | suites atuais de turnos/fases permanecem verdes | existing tests |
| MODE-REG-04 | suites atuais de bots permanecem verdes ou são atualizadas sem perda de cobertura | existing tests |
| MODE-REG-05 | suites atuais de dice balance permanecem verdes | existing tests |
| MODE-REG-06 | lobby continua sem scroll de página em viewports-alvo normais | visual regression |
| MODE-REG-07 | gerenciamento de bots continua funcional para o host | lobby E2E |
| MODE-REG-08 | ready/unready e auto-start vigentes continuam funcionais | lobby integration/E2E |
| MODE-REG-09 | reconnect/revision invalidation continuam autoritativos | integration/E2E |

## Cenários de aceitação obrigatórios

### A. Sala padrão preserva comportamento atual

1. criar sala personalizada sem informar novos settings;
2. confirmar `ruleset=objective`;
3. confirmar `balancedDiceEnabled=true`;
4. iniciar com pelo menos dois jogadores;
5. verificar objetivos atribuídos;
6. verificar perfil de dados adaptativo resolvido pelo mecanismo vigente;
7. concluir uma condição de objetivo;
8. verificar vencedor e estado terminal.

Resultado: comportamento equivalente ao jogo atual.

### B. Host troca para Supremacia

1. dois humanos entram na sala;
2. ambos ficam prontos;
3. host abre configurações;
4. host seleciona `Supremacia`;
5. verificar que ready dos humanos é revogado;
6. ambos ficam prontos novamente;
7. iniciar partida;
8. verificar ausência de `game.player_objectives` para o match/sala;
9. verificar game snapshot com ruleset Supremacia e sem objetivo secreto.

Resultado: Supremacia inicia como política da partida, não como objetivo falso.

### C. Vitória terminal de Supremacia

Preparar estado controlado:

```text
Jogador A = todos os territórios menos 1
Jogador B = 1 território
```

Executar conquista válida do último território de B.

Verificar atomicamente:

```text
território final.owner = A
B.turn_position = NULL
room.status = finished
room.phase = finished
room.winner_player_id = A
```

Verificar também que o cliente não exige nova ação para reconhecer a vitória.

### D. Sorte balanceada desligada

1. host desliga `Sorte balanceada`;
2. ready é revogado;
3. jogadores confirmam ready novamente;
4. iniciar partida;
5. verificar `balanced_dice_enabled_snapshot=false`;
6. verificar perfil resolvido uniforme;
7. verificar snapshot completo do perfil persistido;
8. confirmar que algoritmo adaptativo não é usado naquele match.

### E. Concorrência settings vs start

Executar concorrentemente:

- request do host alterando settings;
- request que completaria a prontidão/início.

Aceitar somente um dos resultados consistentes:

1. settings vence: sala permanece `waiting`, nova configuração persiste e humanos deixam de estar prontos; ou
2. start vence: sala deixa `waiting` com snapshot da configuração anterior e alteração de settings falha.

Qualquer match com configuração parcial é BLOCKER.

### F. Reconnect multi-client

1. host configura Supremacia e sorte desbalanceada/uniforme;
2. convidado recebe atualização;
3. desconectar convidado;
4. reconectar sem estado local preservado;
5. consultar snapshot autoritativo;
6. verificar mesmas configurações.

### G. Rematch

1. finalizar partida de Supremacia;
2. aprovar rematch pelo fluxo vigente;
3. verificar novo match;
4. verificar ruleset Supremacia preservado;
5. verificar flag de balanceamento preservada;
6. verificar novos snapshots independentes do match anterior.

## Evidência visual mínima

Capturar ou verificar em regressão visual:

- desktop `1440x900`;
- desktop `1366x768`;
- mobile `390x844`;
- mobile baixo `390x580`.

Em todos:

- botão de configuração não colide com código/status;
- painel não remove acesso ao ready;
- não existe scroll de página causado pela feature em estado normal;
- `Objetivo/Supremacia` permanece legível;
- switch permanece alcançável;
- resumo do modo permanece compacto;
- contraste e foco permanecem adequados.

## Critério de aprovação

A feature só pode ser considerada pronta para merge quando:

1. todos os BLOCKERs aplicáveis estiverem verdes;
2. os sete cenários obrigatórios estiverem cobertos por evidência reproduzível;
3. nenhuma regressão do modo Objetivo estiver aberta;
4. nenhuma regressão do sistema atual de dados balanceados estiver aberta;
5. Supremacia não depender de objetivo sintético;
6. segurança do host e concorrência de start/settings estiverem demonstradas;
7. snapshots históricos de match forem imutáveis e auditáveis;
8. UX permanecer dentro da composição de uma única viewport definida pelo lobby.
