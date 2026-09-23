# SPEC — Modos de Jogo: Objetivo e Supremacia

## Autoridade do documento

Este documento é a fonte autoritativa do WAR Brasil para:

- modos de jogo disponíveis em sala personalizada;
- configuração autoritativa do modo de vitória da sala;
- configuração autoritativa do balanceamento de sorte dos dados;
- regras de vitória de `objective` e `supremacy`;
- integração dessas opções com lobby, início de partida, snapshots, bots, rematch e estado terminal.

A identidade visual, composição de viewport e regras gerais de UX do lobby continuam pertencendo a `docs/pre-game/lobby/SPEC.md`, `docs/pre-game/visual-language.md` e `docs/pre-game/quality-standard.md`.

Este SPEC MUST NOT redefinir as regras normais de ataque, defesa, reforço, cartas, eventos, manobra, barreiras, ordem de turno ou distribuição inicial de territórios. Essas regras continuam sendo compartilhadas pelos dois modos, salvo quando explicitamente indicado aqui.

## Objetivo

A sala personalizada deve permitir que o host configure, antes da partida:

1. o modo de jogo:
   - `Objetivo`;
   - `Supremacia`;
2. o balanceamento de sorte dos dados:
   - ligado;
   - desligado.

A configuração deve permanecer minimalista, integrada à identidade visual vigente e sem transformar o lobby em uma tela de formulário.

As escolhas são regras autoritativas da partida e MUST ser persistidas pelo PostgreSQL antes do início.

## Separação de conceitos

O código atual possui `match_mode` com valores como `classic` e `custom`, usado para identificar a origem/tipo operacional do match.

Esse conceito MUST permanecer separado da regra de vitória.

A implementação MUST introduzir um conceito próprio de ruleset, com valores estáveis:

```text
objective
supremacy
```

A implementação MUST NOT reutilizar `match_mode` para representar `Objetivo` ou `Supremacia`.

A configuração de sorte também é independente do ruleset.

Portanto, uma sala/match possui conceitos ortogonais:

```text
match_mode
  -> origem/tipo operacional da sala ou match

ruleset
  -> objective | supremacy

balanced_dice_enabled
  -> true | false
```

## Defaults e compatibilidade

Salas existentes e novas salas que não forneçam configuração explícita MUST preservar o comportamento atual:

```text
ruleset = objective
balanced_dice_enabled = true
```

Isso significa:

- objetivos continuam sendo atribuídos normalmente;
- a vitória continua sendo avaliada pelo sistema de objetivos existente;
- o sistema atual de balanceamento adaptativo continua sendo usado por padrão.

A migration MUST ser compatível com inserts legados que criem `game.rooms` sem informar os novos campos.

## Fonte de verdade

PostgreSQL MUST ser a única fonte de verdade para:

- ruleset da sala;
- flag de balanceamento de sorte da sala;
- ruleset congelado do match;
- flag de balanceamento congelada do match;
- perfil de dados efetivamente resolvido para o match;
- vencedor ou conjunto de vencedores e estado terminal.

Frontend, realtime, process memory e worker MUST NOT definir ou inferir essas regras como autoridade independente.

Realtime MAY transportar invalidação/revisão, mas o cliente MUST recuperar a configuração autoritativa por snapshot.

## Configuração da sala personalizada

### Autoridade do host

Somente o host da sala pode alterar configurações da sala.

A definição autoritativa de host MUST permanecer no servidor e SHOULD reutilizar o mesmo conceito já usado para gerenciamento de bots.

A implementação SHOULD generalizar essa autoridade para um capability explícito como `canManageRoom`, do qual possam derivar:

- gerenciamento de bots;
- edição de ruleset;
- edição do balanceamento de sorte.

O frontend MUST NOT decidir host apenas pela posição do jogador em um array local.

Uma request forjada por um não-host MUST receber erro de autorização e MUST NOT alterar estado.

### Janela de edição

Configurações da sala só podem ser alteradas enquanto:

```text
room.status = waiting
```

Após a sala entrar em `order_roll`, `playing` ou `finished`, a configuração da partida corrente MUST ser imutável.

Quando a sala retornar ao lobby após a partida, a configuração volta a poder ser editada pelo host.

### Alteração invalida ready

Qualquer alteração efetiva em `ruleset` ou `balanced_dice_enabled` MUST revogar o `ready` de todos os jogadores humanos da sala.

Bots MAY permanecer prontos conforme o comportamento vigente.

Uma request que repita exatamente os valores já persistidos MAY ser tratada como no-op e SHOULD NOT revogar ready desnecessariamente.

O reset de ready e a alteração das configurações MUST ocorrer na mesma transação.

### Concorrência com início da partida

A mutação de configuração MUST bloquear/validar a sala de forma que não exista corrida capaz de iniciar uma partida com valores parcialmente atualizados.

Se a partida deixar `waiting` antes da mutação de configuração adquirir autoridade, a mutação MUST falhar sem alterar o match corrente.

Se a mutação de configuração vencer a corrida, ela MUST persistir os novos valores e revogar ready antes que uma tentativa subsequente de start possa prosseguir.

## Contrato HTTP

A configuração SHOULD possuir endpoint próprio de sala, separado da edição do próprio jogador.

Contrato recomendado:

```http
PATCH /api/rooms/:code/settings
Content-Type: application/json
```

Payload permitido:

```json
{
  "ruleset": "supremacy",
  "balancedDiceEnabled": false
}
```

O endpoint MUST:

- autenticar/identificar o jogador da sala pelo mecanismo vigente;
- derivar a autoridade de host no servidor;
- rejeitar sala inexistente;
- rejeitar ator que não pertença à sala;
- rejeitar não-host;
- rejeitar alteração fora de `waiting`;
- validar payload estritamente;
- rejeitar valores desconhecidos;
- não aceitar `userId`, `hostId`, `winnerId`, `diceProfileId` ou qualquer campo autoritativo extra vindo do browser;
- persistir alteração e reset de ready atomicamente;
- retornar estado suficiente para reconciliação ou provocar refresh autoritativo pelo fluxo vigente.

## UX da configuração

### Entrada

O host deve possuir um único botão compacto de configuração na barra de comando da sala.

A superfície principal SHOULD ser representada por um ícone de ajustes/configuração e MUST possuir nome acessível equivalente a `Configurações da sala`.

O controle MUST:

- integrar-se à barra de comando existente;
- evitar adicionar uma nova seção vertical permanente;
- preservar o orçamento de uma viewport definido pelo SPEC do lobby;
- não deslocar ready, código da sala ou ações críticas.

Jogadores não-host MUST NOT receber controles editáveis.

Eles SHOULD ver um resumo somente leitura das regras ativas.

### Painel

Desktop SHOULD usar popover/painel flutuante compacto.

Mobile SHOULD usar um bottom-sheet compacto ou superfície equivalente contida, sem converter a rota em uma página longa.

A configuração deve conter somente dois grupos funcionais:

```text
MODO
[ OBJETIVO | SUPREMACIA ]

SORTE BALANCEADA    [ switch ]
```

A UI MUST evitar texto explicativo longo dentro do painel.

Tooltips, labels acessíveis e descrições curtas fora da composição principal MAY fornecer esclarecimento adicional sem poluir a cena.

### Identidade visual

O painel MUST seguir a linguagem vigente do lobby:

- verde militar profundo;
- latão/dourado para autoridade e seleção;
- branco quente para leitura;
- vermelho reservado para erro, alerta ou conflito;
- geometrias discretamente angulares;
- bordas finas;
- superfícies compactas;
- nenhuma estética de dashboard SaaS genérico.

MUST evitar:

- cards grandes para cada opção;
- parágrafos explicativos extensos;
- switches excessivamente ornamentais;
- efeitos pesados de blur/glassmorphism;
- animações que alterem layout.

Transições SHOULD usar `opacity` e `transform`, ser curtas e respeitar `prefers-reduced-motion`.

### Resumo para todos os jogadores

A sala SHOULD exibir um resumo compacto e somente leitura próximo ao status da operação, por exemplo:

```text
OBJETIVO · BALANCEADO
```

ou

```text
SUPREMACIA · ALEATÓRIO
```

A cópia visual MAY variar, mas MUST comunicar ambos os valores de forma inequívoca.

## Ruleset `objective`

`objective` representa o comportamento atual do WAR Brasil.

Ao iniciar uma partida nesse ruleset:

- territórios são distribuídos normalmente;
- objetivos individuais são atribuídos pelo sistema vigente;
- `game.player_objectives` continua sendo utilizado;
- objetivos podem permanecer privados por jogador;
- fallbacks de objetivos continuam válidos;
- a vitória continua dependendo da política existente de objetivos.

Nenhuma regra de objetivo deve ser duplicada dentro do novo dispatcher de modos.

O sistema existente de objetivos SHOULD permanecer isolado em sua própria política de vitória.

## Ruleset `supremacy`

### Definição

Em `supremacy`, não existem objetivos secretos ou individuais.

A condição única de vitória é:

> uma única facção controlar todos os territórios existentes na partida.

No mapa atual isso corresponde a `42/42`, mas a política autoritativa MUST comparar controle com a quantidade real de territórios persistidos para a sala, e MUST NOT depender de um literal `42` espalhado pela lógica de vitória.

### Inicialização

Ao iniciar `supremacy`:

- territórios são distribuídos normalmente;
- cartas são criadas normalmente;
- eventos permanecem ativos;
- combate, reforço, manobra e demais fases permanecem ativos;
- MUST NOT ser criada uma linha de `game.player_objectives` para cada jogador apenas para simular Supremacia.

Supremacia é uma política da partida, não um objetivo secreto coletivo.

### Vitória

A vitória de Supremacia deve ser avaliada após mudança autoritativa de controle territorial.

Uma implementação equivalente deve verificar:

```text
owned_by_candidate == total_territories_in_room
```

A condição MUST exigir `total_territories > 0`.

Estados como `41/42` MUST NOT encerrar a partida.

Ao satisfazer a condição:

- `game.rooms.status` MUST tornar-se `finished`;
- `game.rooms.phase` MUST tornar-se `finished`;
- `winner_player_id` MAY permanecer como ponte de compatibilidade para um vencedor principal;
- o conjunto normalizado de vencedores MUST ser autoritativo quando uma mutação puder concluir mais de um objetivo simultaneamente;
- a finalização MUST ocorrer na mesma transação autoritativa da mutação que determinou a vitória, ou no mesmo command boundary transacional antes do commit;
- o mecanismo existente de encerramento do balanceamento de dados MUST ser respeitado;
- nenhum terceiro jogador pode vencer por uma eliminação realizada por outro jogador.

### Conquista terminal

Se a conquista do último território também eliminar o último adversário territorialmente:

1. a posse do território é atualizada;
2. a eliminação vigente é processada;
3. cartas da mão são tratadas conforme a regra atual;
4. Supremacia é avaliada para o conquistador;
5. a sala entra em estado terminal.

A partida terminal MUST NOT exigir uma ação adicional do jogador para reconhecer a vitória.

Se existir `pendingConquest` apenas para movimentação pós-conquista, o estado terminal MUST NOT deixar uma ação obrigatória bloqueando a vitória. A implementação MAY limpar esse estado no encerramento ou garantir que snapshots/cliente não o tratem como ação necessária após `finished`.

## Motor de vitória unificado

Os comandos de gameplay SHOULD depender de uma fronteira única de avaliação de vitória, por exemplo:

```text
evaluateGameVictory(...)
```

Essa fronteira despacha por ruleset:

```text
objective
  -> política atual de objetivos

supremacy
  -> política de domínio total
```

Callsites de batalha, conquista, tropas, manobra e eventos SHOULD NOT espalhar condicionais específicas de ruleset.

O objetivo arquitetural é permitir que futuras regras de vitória sejam adicionadas sem acoplar todos os command services a cada modo.

## Eventos que exigem avaliação de vitória

Para `objective`, os eventos relevantes continuam sendo os vigentes, incluindo mudanças de tropas e controle territorial quando aplicável ao tipo de objetivo.

Para `supremacy`, somente eventos capazes de mudar ownership territorial precisam reavaliar vitória.

Alterações exclusivamente de quantidade de tropas MUST NOT disparar consulta de vitória de Supremacia sem necessidade.

## Eliminação

A eliminação territorial existente deve continuar funcionando nos dois modos.

Quando um jogador perde seu último território:

- o jogador MUST permanecer como participante histórico da sala/match;
- MUST sair da ordem ativa de turnos conforme o comportamento vigente;
- automação de bot desse jogador MUST ser desativada conforme o comportamento vigente;
- cartas da mão MUST seguir a regra vigente de transferência para o conquistador;
- em `objective`, avaliações de objetivos de eliminação continuam válidas;
- em `supremacy`, apenas a vitória do conquistador por domínio total deve ser avaliada.

## Saída voluntária durante a partida

Uma desconexão de rede após o início da partida MUST NOT remover automaticamente o jogador. O assento continua ativo e a conta deve ser reconduzida à partida ao reconectar.

A saída definitiva durante `order_roll`, `playing` ou `finished` MUST ocorrer somente por ação explícita do próprio jogador.

Ao sair de uma partida ainda não terminada, a mutação MUST ocorrer em um único command boundary transacional e:

- persistir `left_at` no participante em vez de apagar sua linha histórica;
- remover o participante da ordem ativa;
- descartar todas as cartas de sua mão;
- cancelar negociações pendentes que dependam dele;
- neutralizar batalha/conquista pendente que tenha ficado inválida pela saída;
- redistribuir seus territórios somente entre participantes ainda ativos;
- preservar as tropas existentes nos territórios redistribuídos;
- priorizar sempre os jogadores com menor quantidade atual de territórios, sorteando apenas entre empatados nesse mínimo;
- corrigir o jogador atual e a rodada quando o participante que saiu possuía a vez;
- reavaliar condições de vitória somente depois que a redistribuição inteira estiver persistida.

A avaliação decorrente da redistribuição MUST observar todos os candidatos contra o mesmo estado final do tabuleiro antes de encerrar a partida. Se dois ou mais jogadores concluírem seus objetivos simultaneamente, todos MUST ser registrados como vencedores.

`game.room_winners` é a representação normalizada do resultado plural. `game.rooms.winner_player_id` permanece somente como compatibilidade para consumidores legados.

Quando apenas um participante ativo permanecer após a saída e nenhuma condição específica já tiver encerrado o jogo, ele vence por abandono dos demais. Quando nenhum participante ativo permanecer, a partida MAY terminar sem vencedor.

Depois que `left_at` é persistido:

- comandos novos e snapshots privados do jogador MUST ser rejeitados;
- retries idempotentes do mesmo comando de saída MAY consultar o receipt já persistido;
- o jogador MUST deixar de contar como participação ativa para o conector de navegação;
- seu registro histórico MUST continuar disponível até o lifecycle seguro de limpeza/reset da sala.

## Balanceamento de sorte

### Semântica do toggle

O toggle `Sorte balanceada` é independente de `ruleset`.

```text
balanced_dice_enabled = true
```

significa: usar o mecanismo atual de seleção/resolução do perfil de balanceamento de dados para um novo match.

```text
balanced_dice_enabled = false
```

significa: usar um perfil uniforme, sem pressão adaptativa sobre os resultados.

### Ligado

Quando ligado, a implementação MUST preservar o comportamento atual de resolução do perfil padrão em `catalog.dice_balance_settings`.

Na configuração atual, isso normalmente resolve `adaptive-halves-v1`.

Fallbacks seguros já existentes MAY continuar valendo quando a configuração persistida estiver inválida.

### Desligado

Quando desligado, o match MUST resolver explicitamente o perfil uniforme vigente, preferencialmente `uniform-v1` quando disponível no catálogo.

Se houver perfil uniforme builtin seguro já suportado pelo sistema, ele MAY ser usado como fallback de segurança, mas o match MUST registrar o perfil efetivamente utilizado.

Desligar o balanceamento MUST NOT remover o sistema de snapshot de perfil dos dados.

### Imutabilidade do match

O perfil de dados efetivo MUST continuar congelado por match.

Alterar `balanced_dice_enabled` no lobby após uma partida terminar MUST afetar somente partidas futuras.

Partidas históricas MUST continuar identificando:

- se o balanceamento estava habilitado;
- qual perfil foi efetivamente resolvido;
- o snapshot completo do perfil usado.

## Snapshot do match

A configuração efetiva MUST ser congelada no registro autoritativo do match.

O snapshot persistente SHOULD possuir equivalentes estáveis a:

```text
ruleset_snapshot
balanced_dice_enabled_snapshot
match_mode_snapshot
resolved_profile_id
dice_balance_profile_snapshot
```

`match_mode_snapshot` continua representando o conceito existente e MUST NOT ser renomeado para significar ruleset.

O start MUST capturar a configuração da sala na mesma transação que cria o match e seus artefatos iniciais.

## Lobby snapshot

O snapshot compartilhado da sala MUST expor no mínimo:

```text
ruleset
balancedDiceEnabled
canManageRoom
```

ou contratos semanticamente equivalentes.

O snapshot MUST ser suficiente para:

- host renderizar controles editáveis;
- convidados renderizarem resumo somente leitura;
- todos observarem mudanças por sincronização vigente;
- clientes reconectados recuperarem a configuração correta sem depender de estado local anterior.

## Game snapshot

O snapshot de partida MUST expor o ruleset efetivo congelado do match/sala corrente.

A UI do jogo MUST conseguir distinguir `objective` de `supremacy` sem consultar profile, store ou outro domínio externo.

Em `objective`:

- o objetivo privado vigente continua disponível conforme o contrato existente.

Em `supremacy`:

- `myObjective` MUST ser `null` ou ausente de forma contratualmente explícita;
- a UI MUST NOT apresentar uma missão secreta sintética;
- o progresso de domínio MAY ser derivado dos territórios públicos do snapshot;
- a interface SHOULD mostrar `SUPREMACIA` e progresso territorial de forma compacta.

## UI durante a partida

### Objetivo

O modo `Objetivo` preserva a apresentação atual de missão individual.

### Supremacia

A interface deve substituir a leitura de missão por uma leitura compacta de domínio, por exemplo:

```text
SUPREMACIA
17 / 42 TERRITÓRIOS
```

O valor total SHOULD ser derivado do estado real da partida.

O mapa já torna ownership público; portanto contagens territoriais por jogador MAY ser apresentadas sem criar vazamento de informação privada.

A UI MUST NOT adicionar um painel grande permanente que reduza de forma relevante a área do mapa.

## Bots

Bots MUST funcionar em ambos os rulesets.

O estado estratégico do bot MUST deixar de exigir semanticamente um objetivo individual quando o ruleset for `supremacy`.

Em `objective`, o planejamento vigente baseado em objetivo continua válido.

Em `supremacy`, o bot SHOULD usar uma estratégia equivalente a expansão territorial, considerando ao menos:

- territórios inimigos adjacentes;
- redução de fronteiras vulneráveis;
- oportunidade de eliminar adversários enfraquecidos;
- aproximação do domínio total.

A implementação MAY reutilizar o planner de expansão existente, mas MUST existir um caminho explícito e testável para Supremacia sem criar `game.player_objectives` falsos.

## Rematch e retorno ao lobby

### Rematch

Um rematch iniciado diretamente a partir de uma partida finalizada MUST preservar:

- `ruleset` da sala;
- `balanced_dice_enabled` da sala.

Cada rematch cria um novo match e MUST congelar novamente os valores e o perfil efetivo daquele novo match.

### Retorno ao lobby

Ao retornar a sala para `waiting`:

- configurações atuais da sala permanecem visíveis;
- host pode alterá-las para a próxima partida;
- qualquer alteração segue novamente a regra de reset de ready.

## Acessibilidade

MUST:

- possuir nome acessível para o botão de configurações;
- implementar `Sorte balanceada` como controle com semântica de switch ou equivalente;
- representar estado ligado/desligado além de cor;
- representar seleção `Objetivo/Supremacia` semanticamente;
- manter foco visível;
- permitir operação por teclado;
- manter configuração legível em contraste adequado;
- manter resumo somente leitura compreensível por texto.

## Segurança e confiança

MUST NOT:

- confiar em ruleset enviado por comando de gameplay durante a partida;
- confiar em perfil de dados enviado pelo browser;
- aceitar alteração de settings por não-host;
- permitir alteração após o start da partida corrente;
- permitir que o cliente declare vencedor;
- derivar Supremacia apenas de contagem mantida no frontend;
- criar endpoint público capaz de modificar diretamente pressão/probabilidades internas dos dados.

## Fora de escopo desta entrega

Não fazem parte desta V1:

- mais de dois rulesets;
- editor avançado de probabilidades;
- escolha manual de perfis de dados pelo usuário;
- configuração de percentual territorial para Supremacia;
- vitória por tempo;
- vitória por pontos;
- equipes/alianças;
- capitais;
- draft de objetivos;
- presets de sala além das duas opções especificadas;
- alteração de configurações durante partida em andamento.

## Critério de conclusão

A feature está concluída quando:

1. uma sala personalizada persiste e sincroniza `Objetivo` ou `Supremacia`;
2. somente o host pode alterar o ruleset e a sorte balanceada enquanto a sala aguarda início;
3. alterar configuração revoga ready humano de forma atômica;
4. `Objetivo` preserva integralmente o comportamento de vitória atual;
5. `Supremacia` inicia sem objetivos individuais e termina somente quando uma facção controla todos os territórios;
6. bots conseguem jogar Supremacia sem objetivo falso;
7. sorte balanceada ligada preserva o mecanismo atual;
8. sorte balanceada desligada produz dados uniformes via perfil autoritativo congelado;
9. match congela ruleset, flag de balanceamento e perfil efetivo;
10. lobby e jogo apresentam o modo de forma compacta, responsiva e alinhada à identidade visual existente;
11. reconnect, rematch e retorno ao lobby preservam as invariantes definidas acima;
12. todos os gates BLOCKER de `EVAL.md` estão verdes.
