# War Brasil — Passe de Campanha SPEC

Status: **implementação em finalização / XP acumulativo V2, P5 hardening e conteúdo real da Temporada 1 pendentes**  
Branch de integração: **dev**  
Escopo: progressão sazonal por XP, Passe Livre, Passe Elite, compra com Créditos de Campanha, recompensas, claims, integração com partidas e experiência de frontend.

## 1. Autoridade e objetivo

Este documento é a autoridade central para a implementação do Passe de Campanha do Bellum Civile.

Ele define:

- progressão sazonal por XP;
- integração autoritativa com partidas;
- XP acumulativo por ações autoritativas durante a partida;
- liquidação de XP ao encerrar a partida ou ao sair voluntariamente;
- temporada e lifecycle;
- 100 níveis;
- Trilha Livre;
- Trilha Elite;
- preço do Passe Elite;
- catálogo de recompensas;
- distribuição monetária;
- coleções cosméticas sazonais;
- compra retroativa da Trilha Elite;
- estados de coleta;
- entrega idempotente;
- animações de recebimento;
- acesso pela rota /home;
- página principal da Campanha;
- contratos de API;
- modelo de dados;
- integração com Economy V2 e ownership existente;
- acessibilidade, responsividade e performance;
- segurança, antifraude e testes.

Quando este documento tratar de carteira, compras ou ownership, as invariantes existentes de Economy V2 continuam válidas. O Passe não cria uma economia paralela.

Quando este documento tratar de frontend, deve ser aplicado junto de skills/frontend-quality/SKILL.md. A identidade visual vigente do Bellum Civile deve ser preservada.

## 2. Decisões fechadas de produto

A V1 MUST obedecer às seguintes decisões:

1. o Passe possui exatamente 100 níveis;
2. todos os jogadores possuem acesso à Trilha Livre;
3. existe uma Trilha Elite paga;
4. a Trilha Elite custa exatamente 3.000 Créditos de Campanha;
5. comprar Elite não reinicia nem cria progressão separada;
6. o mesmo XP avança Livre e Elite;
7. a Trilha Elite pode ser adquirida depois de o jogador já ter avançado níveis;
15. ao adquirir Elite tardiamente, recompensas Elite de níveis já alcançados tornam-se coletáveis retroativamente;
16. a Trilha Livre concede exatamente 1.000 Créditos de Campanha ao completar toda a distribuição monetária;
17. a Trilha Elite concede 2.500 Créditos de Campanha adicionais;
18. um jogador Elite que conclui e coleta ambas as trilhas recebe 3.500 Créditos no total da temporada;
19. uma recompensa monetária individual MUST ser de pelo menos 5 Créditos;
20. níveis sem recompensa são válidos;
21. um nível MAY possuir mais de uma recompensa;
22. uma recompensa MUST possuir estado de coleta individual;
23. recompensas desbloqueadas não são automaticamente equivalentes a recompensas coletadas;
24. a interface MUST oferecer coleta individual;
25. a interface MUST oferecer COLETAR TODAS quando existir mais de uma recompensa coletável;
26. a Trilha Livre termina com um título exclusivo no nível 100;
27. a Trilha Elite termina com outro título exclusivo no nível 100;
28. o nível 100 não concede moedas na distribuição V1;
29. o Passe deve ser acessível diretamente pela /home;
30. a experiência completa vive em uma superfície dedicada de Campanha;
31. o navegador nunca declara XP, nível, ownership ou claim como autoritativo;
32. XP de partida é acumulado progressivamente por ações elegíveis, mas só entra no progresso sazonal na liquidação;
33. conclusão normal da partida concede bônus mesmo para participante derrotado/eliminado;
34. saída voluntária liquida somente o XP acumulado até a saída, sem bônus de conclusão ou vitória;
35. movimentação/manobra de tropas não concede XP;
36. trocas entre jogadores não concedem XP;
37. o Passe V1 exige exatamente 40.000 XP acumulados para alcançar o nível 100;
38. toda apresentação de XP em partida usa delta confirmado pelo servidor, nunca cálculo local;
39. feedback visual de XP é não bloqueante, usa camada absoluta z-index 99 e respeita reduced motion.

## 3. Nomenclatura

### 3.1 Nome do sistema

Nome de produto na interface:

PASSE DE CAMPANHA

Nome curto de navegação:

CAMPANHA

### 3.2 Trilhas

Persistência e contratos internos:

- free
- premium

Apresentação ao jogador:

- TRILHA LIVRE
- TRILHA DE ELITE

### 3.3 Moeda

A única moeda usada pela V1 é a existente:

campaign-credit

Nome apresentado:

Créditos de Campanha

O Passe MUST NOT criar uma moeda própria.

### 3.4 XP

XP de Campanha é progressão sazonal.

XP:

- não é moeda;
- não pode ser gasto;
- não pode ser transferido;
- não pode ser comprado diretamente na V1;
- não deve ser persistido em economy.wallets.

## 4. Separação de domínios

A arquitetura alvo é:

~~~text
game
  partidas e resultados

catalog
  temporadas, níveis, perfis de XP e recompensas

progression
  XP, progresso, acesso Elite e claims

economy
  Créditos de Campanha, ledger e compras

inventory
  ownership de cosméticos de gameplay

profile
  títulos, backgrounds e apresentação
~~~

Progression é responsável por progresso sazonal.

Economy continua responsável por dinheiro e compras.

Inventory/Profile continuam responsáveis por ownership.

Nenhum item recebido pelo Passe deve possuir uma cópia especial somente porque veio do Passe.

## 5. Temporadas

### 5.1 Entidade de temporada

A implementação SHOULD possuir estrutura equivalente a:

~~~text
catalog.battle_pass_seasons
- id
- slug
- name
- description
- starts_at
- ends_at
- claim_ends_at
- status
- max_level
- hero_asset_ref
- logo_asset_ref nullable
- created_at
- updated_at
~~~

status:

- draft
- announced
- active
- ended
- archived

max_level MUST ser 100 para a V1.

### 5.2 Janelas

starts_at e ends_at definem quando XP sazonal pode ser associado a novos matches.

claim_ends_at define até quando recompensas já desbloqueadas podem ser coletadas.

A duração entre ends_at e claim_ends_at é conteúdo configurável da temporada e não deve ser hardcoded em frontend.

### 5.3 Uma temporada ativa

A V1 SHOULD permitir no máximo uma temporada active para um mesmo instante de tempo.

Validação de catálogo/migration MUST impedir intervalos ativos ambíguos ou detectar a configuração inválida antes de expô-la ao jogador.

### 5.4 Histórico

Temporadas encerradas não devem ser sobrescritas para reutilização.

IDs, níveis, recompensas e claims históricos devem permanecer estáveis.

## 6. Snapshot da temporada por match

A temporada que recebe XP MUST ser resolvida no início do match, não no momento em que a tela final é aberta.

game.matches SHOULD receber equivalentes a:

~~~text
battle_pass_season_id
battle_pass_xp_profile_id
battle_pass_xp_profile_snapshot
~~~

battle_pass_season_id MAY ser NULL quando não existir temporada ativa no início.

### 6.1 Motivo

Um match pode começar antes do fim de uma temporada e terminar depois.

Nesse caso, o XP deve continuar pertencendo à temporada congelada no início daquele match.

Mudanças de balanceamento de XP durante uma partida MUST NOT mudar retroativamente a recompensa daquela execução.

## 7. Perfil de XP acumulativo V1

Valores de XP são conteúdo versionado e MUST NOT ficar espalhados como constantes no frontend ou nos command services.

A V1 substitui o modelo de XP baseado somente em conclusão/vitória por um modelo acumulativo por contribuição durante a partida.

O perfil SHOULD ser estendido para possuir estrutura semanticamente equivalente a:

~~~text
catalog.battle_pass_xp_profiles
- id
- troop_placed_xp
- troop_placed_cap_xp
- card_trade_xp
- card_trade_cap_xp
- troop_lost_dice_xp
- troop_lost_dice_cap_xp
- enemy_troop_defeated_xp
- enemy_troop_defeated_cap_xp
- territory_first_conquest_xp
- territory_second_conquest_xp
- completion_xp
- victory_bonus_xp
- solo_human_bot_multiplier_bps
- created_at
~~~

O perfil efetivo MUST ser congelado em battle_pass_xp_profile_snapshot no início do match.

Perfis já usados por partidas/histórico permanecem append-only. Alterações futuras criam novo profile/versionamento.

### 7.1 Valores fechados da V1

| Fonte | Valor V1 | Limite por partida |
| --- | ---: | ---: |
| Tropa colocada no tabuleiro | +1 XP por tropa | 60 XP |
| Troca válida de 3 cartas por reforços | +20 XP por conjunto | 80 XP |
| Tropa própria perdida em comparação de dados | +1 XP por tropa | 50 XP |
| Tropa inimiga derrotada em comparação de dados | +2 XP por tropa | 100 XP |
| 1ª conquista de um território pelo jogador naquele match | +25 XP | por território |
| 2ª conquista do mesmo território pelo mesmo jogador | +10 XP | por território |
| 3ª+ conquista do mesmo território pelo mesmo jogador | 0 XP | — |
| Partida concluída normalmente | +150 XP | uma vez |
| Vitória | +200 XP adicionais | uma vez |

Regras fechadas:

- vitória nos dados vale mais que derrota nos dados;
- dominar território possui peso maior que microações;
- posicionar tropas possui peso baixo;
- movimentar tropas/manobra concede 0 XP;
- deslocamento após conquista concede 0 XP;
- iniciar ataque, por si só, concede 0 XP;
- troca entre jogadores concede 0 XP;
- somente troca do conjunto de cartas do próprio jogo por reforços concede XP;
- caps são aplicados por participante e por match;
- nenhum popup ou grant é produzido quando o delta autoritativo real é 0.

### 7.2 Partida com um humano e bots

Bots continuam recebendo 0 XP.

Quando existir exatamente um humano elegível e os demais participantes forem bots:

~~~text
solo_human_bot_multiplier_bps = 4000
~~~

equivalente a 40%.

O multiplicador MUST fazer parte do snapshot do match.

Caps são aplicados antes do multiplicador.

Para evitar divergência de arredondamento entre eventos e liquidação, o servidor SHOULD manter total bruto elegível e total escalado materializado. O delta visual/autoritativo de cada ação é a diferença entre o novo total escalado e o total escalado anterior.

Conceitualmente:

~~~text
scaled_total = floor(raw_eligible_total * multiplier_bps / 10000)
event_delta  = scaled_total_after - scaled_total_before
~~~

Assim a soma dos deltas apresentados ao jogador coincide exatamente com o valor liquidado.

Microações que produzirem delta inteiro 0 após multiplicador MAY ser coalescidas até existir pelo menos 1 XP real para apresentar.

### 7.3 Caps e antifarm

Os caps existem apenas para fontes repetíveis de baixa/média qualidade.

A V1 MUST usar:

~~~text
troop_placed_cap_xp         = 60
card_trade_cap_xp           = 80
troop_lost_dice_cap_xp      = 50
enemy_troop_defeated_cap_xp = 100
~~~

Conquista territorial não usa um cap global; usa diminishing returns por território:

~~~text
1ª conquista pelo jogador -> 25 XP
2ª conquista              -> 10 XP
3ª+                        -> 0 XP
~~~

A contagem é por:

~~~text
match_id
user_id
territory_id
~~~

Isso impede ping-pong de território como estratégia ótima de farming.

## 8. Elegibilidade e liquidação de XP

XP é acumulado exclusivamente pelo servidor.

Participante elegível para acumular XP de ações MUST:

- possuir user_id;
- não ser bot;
- pertencer ao match congelado;
- possuir battle_pass_season_id congelada no match.

Bots recebem 0 XP.

Participantes sem conta recebem 0 XP.

### 8.1 Conclusão normal

Participante que permanece elegível até a conclusão normal recebe:

~~~text
XP acumulado de ações
+ 150 XP de conclusão
+ 200 XP adicionais se vencedor
~~~

O bônus de conclusão é concedido mesmo que o participante tenha sido derrotado/eliminado normalmente antes do vencedor final.

Eliminação normal não é abandono.

O acumulador do eliminado congela quando ele deixa de poder realizar ações, mas a liquidação final ocorre quando o match termina e inclui o bônus de conclusão.

Múltiplos vencedores recebem individualmente o bônus de vitória.

### 8.2 Saída voluntária

game.match_participants MUST preservar left_at_snapshot ou campo histórico equivalente.

Ao sair voluntariamente antes da conclusão:

~~~text
XP acumulado de ações até a saída
+ 0 conclusão
+ 0 vitória
~~~

A saída dispara liquidação imediata e idempotente do participante.

Depois de settled_at, aquele usuário não pode continuar acumulando XP no mesmo match.

A UI apresenta a liquidação como XP DA PARTIDA SALVO, sem sinal de + sobre o total já visto durante a partida.

### 8.3 Settlement único

Cada participante possui no máximo uma liquidação sazonal por match.

Motivos V1:

~~~text
match_completed
player_left
~~~

A liquidação MUST ser idempotente e reutilizar a chave autoritativa do match.

## 9. Acúmulo autoritativo durante a partida

A V1 passa a possuir dois níveis de persistência:

1. ações de XP da partida, auditáveis/idempotentes;
2. grant sazonal final no settlement.

Estrutura recomendada:

~~~text
progression.battle_pass_match_xp_actions
- id
- match_id
- season_id
- user_id
- source_key
- action_kind
- units
- raw_xp
- awarded_xp
- metadata
- created_at

UNIQUE(match_id, user_id, source_key)
~~~

e read model/acumulador:

~~~text
progression.battle_pass_match_progress
- match_id
- season_id
- user_id
- raw_action_xp
- scaled_action_xp
- troops_placed
- card_sets_redeemed
- troops_lost_dice
- enemy_troops_defeated_dice
- settled_at nullable
- settled_reason nullable
- updated_at

PRIMARY KEY(match_id, user_id)
~~~

Para diminishing returns de conquista, SHOULD existir estrutura equivalente a:

~~~text
progression.battle_pass_match_territory_conquests
- match_id
- user_id
- territory_id
- conquest_count

PRIMARY KEY(match_id, user_id, territory_id)
~~~

### 9.1 Atomicidade com comandos do jogo

O XP pendente MUST ser atualizado dentro da mesma transação que confirma a ação de gameplay.

Exemplos:

~~~text
reforço confirmado
  -> altera tropas
  -> registra XP pendente
  -> COMMIT

resultado de combate confirmado
  -> aplica perdas
  -> registra XP dos participantes afetados
  -> COMMIT

conquista autoritativa confirmada
  -> muda ownership
  -> registra conquista/XP
  -> COMMIT
~~~

Se o comando de gameplay fizer ROLLBACK, o XP pendente correspondente também desaparece.

Retry do mesmo comando MUST NOT duplicar battle_pass_match_xp_actions.

O source_key deve reutilizar identidade autoritativa/idempotente do comando ou evento do servidor; o browser não escolhe uma chave capaz de gerar XP arbitrário.

### 9.2 Pontos de captura V1

- reforço: quando executeReinforcement confirma tropas posicionadas;
- troca de cartas: quando executeTradeCards conclui a troca válida;
- combate: quando a comparação autoritativa aplica perdas de tropas;
- conquista: no instante em que ownership do território muda, não no deslocamento posterior;
- conclusão/vitória: no settlement de término do match;
- saída voluntária: no fluxo autoritativo de saída do jogador.

Manobra/movimentação e troca entre jogadores não possuem hook de XP.

### 9.3 Combate agrega o resultado

Uma resolução pode simultaneamente derrotar tropas inimigas e perder tropas próprias.

O backend mantém as fontes separadas, mas a apresentação daquele comando agrega o delta.

Exemplo:

~~~text
2 tropas inimigas derrotadas -> 4 XP
1 tropa própria perdida      -> 1 XP
TOTAL DO EVENTO              -> 5 XP
~~~

A UI apresenta um único evento CONFRONTO +5 XP.

### 9.4 Settlement

No término do match:

~~~text
raw_action_xp
+ completion_xp
+ victory_bonus_xp quando aplicável
-> caps/regras já materializados
-> multiplier do match
-> progression.battle_pass_xp_entries
-> progression.battle_pass_progress
-> settled_at
~~~

Na saída voluntária:

~~~text
scaled_action_xp atual
-> progression.battle_pass_xp_entries
-> progression.battle_pass_progress
-> settled_at = agora
-> settled_reason = player_left
~~~

O cliente MUST NOT possuir endpoint capaz de pedir uma quantidade arbitrária de XP.

Não deve existir contrato equivalente a:

~~~text
POST /api/battle-pass/add-xp
{ amount: 5000 }
~~~

## 10. Ledger de XP

XP MUST possuir histórico append-only.

Estrutura conceitual:

~~~text
progression.battle_pass_xp_entries
- id
- season_id
- user_id
- source_type
- source_key
- amount
- metadata
- created_at
~~~

Para partidas:

~~~text
source_type = match
source_key  = game.matches.id
~~~

Deve existir unicidade equivalente a:

~~~text
UNIQUE(season_id, user_id, source_type, source_key)
~~~

Isso impede XP duplicado por:

- retry;
- reconnect;
- dupla finalização;
- rematch command repetido;
- retorno ao lobby;
- repetição de request.

amount MUST ser inteiro positivo para grants de XP.

Correções administrativas futuras devem usar evento explícito e auditável em vez de editar história silenciosamente.

## 11. Progresso materializado

Para leitura rápida, a implementação SHOULD manter:

~~~text
progression.battle_pass_progress
- season_id
- user_id
- xp_total
- level_reached
- created_at
- updated_at

PRIMARY KEY(season_id, user_id)
~~~

xp_total e level_reached são atualizados na mesma transação que insere o XP ledger.

O ledger é o histórico auditável.

battle_pass_progress é o read model materializado.

## 12. Níveis e curva V1 de 40.000 XP

A implementação SHOULD possuir:

~~~text
catalog.battle_pass_levels
- season_id
- level
- required_total_xp

PRIMARY KEY(season_id, level)
~~~

Regras:

- level entre 1 e 100 na V1;
- nível 1 inicia em 0 XP;
- required_total_xp inteiro não negativo;
- required_total_xp estritamente crescente;
- nível 100 exige exatamente 40.000 XP acumulados;
- XP acima de 40.000 permanece capped no nível 100 para fins de level_reached;
- não existe nível 101.

### 12.1 Regra de geração da fixture

A fórmula abaixo é regra de geração do conteúdo V1, não regra de runtime do cliente.

Para a passagem do nível L para L+1, com L entre 1 e 99:

~~~text
step_xp(L) =
  round5(
    225
    + 3 * (L - 1)
    + 0.01 * (L - 1)^2
  )

round5(x) = 5 * round(x / 5)
~~~

A soma das 99 passagens MUST ser exatamente:

~~~text
40.000 XP
~~~

Checkpoints obrigatórios:

| Passagem | XP da passagem |
| --- | ---: |
| 1 -> 2 | 225 |
| 2 -> 3 | 230 |
| 5 -> 6 | 235 |
| 10 -> 11 | 255 |
| 20 -> 21 | 285 |
| 25 -> 26 | 305 |
| 50 -> 51 | 395 |
| 75 -> 76 | 500 |
| 90 -> 91 | 570 |
| 99 -> 100 | 615 |

XP acumulado obrigatório:

| Nível alcançado | required_total_xp |
| --- | ---: |
| 1 | 0 |
| 2 | 225 |
| 5 | 920 |
| 10 | 2.135 |
| 20 | 4.805 |
| 25 | 6.265 |
| 50 | 14.925 |
| 75 | 26.070 |
| 90 | 34.075 |
| 100 | 40.000 |

O seed/fixture MUST materializar os 100 thresholds em catalog.battle_pass_levels.

Servidor e frontend leem required_total_xp do catálogo; nenhum deles recalcula essa fórmula durante gameplay.

### 12.2 Meta de duração

A curva foi calibrada para uma ordem de grandeza aproximada de:

~~~text
450 XP médios/partida -> ~89 partidas equivalentes
500 XP                -> 80
550 XP                -> ~73
600 XP                -> ~67
650 XP                -> ~62
700 XP                -> ~57
800 XP                -> 50
~~~

A meta inicial de telemetria é um jogador humano normal ficar aproximadamente em 500–600 XP por partida completa, resultando em cerca de 65–80 partidas equivalentes para completar o Passe.

Esses valores são alvo de balanceamento da V1 e MAY ser alterados em temporadas futuras por novo catálogo/profile, nunca por mudança retroativa em match já iniciado.

## 13. Catálogo de recompensas

Uma recompensa é entidade de catálogo estável.

Estrutura conceitual:

~~~text
catalog.battle_pass_rewards
- id
- season_id
- level
- track
- position
- reward_kind
- credit_amount nullable
- cosmetic_id nullable
- title_id nullable
- background_id nullable
- presentation_group_key nullable
- created_at
~~~

track:

- free
- premium

reward_kind V1:

- campaign_credit
- game_cosmetic
- commander_title
- profile_background

Regras:

- exatamente um payload de recompensa deve ser preenchido;
- campaign_credit exige credit_amount >= 5;
- um nível pode ter zero, uma ou várias recompensas;
- position ordena múltiplas recompensas no mesmo nível/trilha;
- IDs são estáveis e não dependem de posição visual;
- presentation_group_key serve apenas para agrupar visualmente itens relacionados;
- agrupamento visual não cria ownership de bundle.

## 14. Conteúdo cosmético da temporada V1

A temporada possui três grupos cosméticos.

### 14.1 Conjunto Livre da Temporada

A Trilha Livre entrega ao longo da temporada:

1. dado de ataque;
2. dado de defesa;
3. dado neutro;
4. skin de território;
5. background;
6. título.

Distribuição V1:

| Nível | Recompensa Livre |
| ---: | --- |
| 15 | Dado de Ataque Livre |
| 35 | Dado de Defesa Livre |
| 55 | Dado Neutro Livre |
| 75 | Skin de Território Livre |
| 90 | Background Livre |
| 100 | Título Livre da Temporada |

O título MUST ser a recompensa cosmética final da coleção Livre.

### 14.2 Conjunto Elite Inicial

Ao alcançar o nível 1 e possuir Elite, o jogador pode coletar um conjunto inicial contendo:

- dado de ataque;
- dado de defesa;
- dado neutro;
- skin de território.

Os quatro itens são ownerships independentes.

Todos podem compartilhar:

~~~text
presentation_group_key = premium-initial-set
~~~

A UI os apresenta como CONJUNTO ELITE INICIAL.

### 14.3 Conjunto Elite Final

A segunda coleção Elite é construída na parte final do Passe:

| Nível | Recompensa Elite Final |
| ---: | --- |
| 60 | Dado de Ataque Elite Final |
| 70 | Dado de Defesa Elite Final |
| 80 | Dado Neutro Elite Final |
| 90 | Skin de Território Elite Final |
| 95 | Background Elite Final |
| 100 | Título Elite da Temporada |

O título Elite MUST ser a recompensa final dessa coleção.

### 14.4 Nível 100

No nível 100:

Trilha Livre:

- Título Livre.

Trilha Elite:

- Título Elite.

Não há recompensa monetária no nível 100.

Um jogador Elite pode coletar ambos.

## 15. Orçamento de Créditos

### 15.1 Livre

Total exato:

1.000 Créditos

Padrão dos blocos 1–90:

- final 2 do bloco: +5;
- final 4 do bloco: +15;
- final 7 do bloco: +30;
- final 0 do bloco: +50.

Exemplos:

~~~text
2  -> 5
4  -> 15
7  -> 30
10 -> 50

12 -> 5
14 -> 15
17 -> 30
20 -> 50
~~~

Cada bloco soma 100.

Nos níveis 91–100, para reservar o nível 100 exclusivamente aos títulos:

~~~text
92 -> 5
94 -> 15
97 -> 30
99 -> 50
~~~

Total Livre confirmado:

1.000 Créditos.

### 15.2 Elite

A Elite adiciona exatamente:

2.500 Créditos

Padrão dos blocos 1–90:

- final 1 do bloco: +5;
- final 3 do bloco: +20;
- final 5 do bloco: +50;
- final 8 do bloco: +75;
- final 0 do bloco: +100.

Exemplo:

~~~text
1  -> 5
3  -> 20
5  -> 50
8  -> 75
10 -> 100
~~~

Cada bloco soma 250.

Nos níveis 91–100:

~~~text
91 -> 5
93 -> 20
95 -> 50
98 -> 75
99 -> 100
~~~

Total Elite adicional confirmado:

2.500 Créditos.

### 15.3 Total de um jogador Elite

Ao concluir e coletar todas as recompensas monetárias:

~~~text
Livre  1.000
Elite  2.500
-------------
Total  3.500
~~~

Como o Passe custa 3.000, a conclusão total retorna o custo e deixa saldo líquido de 500 Créditos em relação ao preço do Passe, além dos cosméticos.

Isso é decisão de produto V1.

## 16. Níveis sem recompensa

Com a distribuição V1, níveis sem qualquer recompensa em nenhuma trilha são válidos.

Fixture inicial:

~~~text
6, 9,
16, 19,
26, 29,
36, 39,
46, 49,
56, 59,
66, 69,
76, 79,
86, 89,
96
~~~

Total: 19 níveis completamente vazios.

A UI MUST continuar mostrando esses níveis na progressão.

Texto recomendado:

SEM RECOMPENSA

A ausência de reward não impede progressão de XP.

## 17. Compra da Trilha Elite

### 17.1 Preço

Preço fixo V1:

3.000 campaign-credit

### 17.2 Integração com Economy V2

A compra SHOULD reutilizar o pipeline transacional atual de storefront/economy:

- wallet autoritativa;
- lock de saldo;
- expectedPrice;
- receipt de purchase;
- ledger de débito;
- idempotency key;
- confirmação somente após commit.

O Passe não deve implementar um débito manual paralelo.

### 17.3 Entitlement de acesso

A arquitetura SHOULD estender o entitlement genérico com um tipo semanticamente equivalente a:

battle_pass_access

Ele referencia uma season_id e concede acesso premium daquela temporada.

O ownership premium SHOULD ser persistido de forma equivalente a:

~~~text
progression.battle_pass_access
- season_id
- user_id
- purchase_id nullable
- access_source
- unlocked_at

PRIMARY KEY(season_id, user_id)
~~~

access_source MAY suportar:

- purchase
- promotion
- admin

A compra normal usa purchase.

### 17.4 Produto e oferta

Cada temporada Elite SHOULD possuir produto/oferta de catálogo estáveis, por exemplo:

~~~text
product.battle-pass.season-1
offer.battle-pass.season-1
~~~

Preço da offer:

3.000 campaign-credit

A interface da Campanha pode iniciar a compra diretamente, mas deve usar o mesmo serviço econômico.

### 17.5 Compra tardia

Se o usuário já estiver, por exemplo, no nível 63:

- seu XP não muda;
- seu level_reached não muda;
- progression.battle_pass_access é criado;
- todas as rewards premium com level <= 63 passam a ser claimable;
- nenhuma recompensa deve ser concedida silenciosamente antes do claim, exceto se no futuro uma temporada declarar explicitamente auto-claim, o que está fora da V1.

## 18. Estados de recompensa

O snapshot de frontend MUST representar semanticamente os seguintes estados:

### locked

O nível ainda não foi alcançado.

### premium_locked

O nível foi alcançado, mas a recompensa pertence à Elite e o usuário ainda não possui o Passe Elite.

### claimable

O nível/trilha são elegíveis e ainda não existe claim.

### claiming

Estado transitório exclusivamente de UI enquanto o request autoritativo está pendente.

### claimed

Existe claim persistido e a entrega foi confirmada.

### 18.1 Estado é por recompensa

O estado não pertence ao nível como um todo.

Exemplo válido:

~~~text
Nível 20

Livre
CLAIMABLE

Elite
CLAIMED
~~~

Múltiplas recompensas no mesmo nível podem possuir estados diferentes.

## 19. Claims

Estrutura conceitual:

~~~text
progression.battle_pass_reward_claims
- user_id
- reward_id
- season_id
- claimed_at

PRIMARY KEY(user_id, reward_id)
~~~

reward_id referencia o catálogo de rewards.

season_id pode ser mantido para consulta eficiente e integridade histórica.

### 19.1 Elegibilidade

Para coletar reward Livre:

- usuário autenticado;
- reward pertence à temporada solicitada;
- level_reached >= reward.level;
- janela de claim aberta;
- reward não coletada anteriormente.

Para reward Elite, além disso:

- progression.battle_pass_access precisa existir para aquela season.

### 19.2 Idempotência

Repetir o mesmo claim MUST NOT duplicar moeda ou ownership.

Um retry de reward já coletada SHOULD retornar sucesso idempotente com:

~~~text
alreadyClaimed = true
~~~

ou contrato semanticamente equivalente.

## 20. Entrega de recompensas

Claim é uma transação autoritativa.

Fluxo:

~~~text
BEGIN
  autenticar
  bloquear progresso/acesso necessário
  carregar reward
  validar temporada/nível/trilha/janela
  verificar claim
  conceder reward
  inserir claim
COMMIT
~~~

O claim só pode aparecer como sucesso depois do COMMIT.

### 20.1 Créditos

Para campaign_credit:

1. lock da wallet;
2. incremento do balance;
3. insert em economy.ledger_entries;
4. insert do claim.

Ledger:

~~~text
reason = battle_pass_reward
domain_reference = reward_id
idempotency_key = battle-pass:<season>:<user>:<reward>
delta > 0
~~~

Nenhum crédito pode ser concedido sem ledger.

### 20.2 Cosmético de gameplay

Deve ser reutilizado inventory.cosmetics.

acquisition_source:

reward

Não criar tabela de cosméticos do Passe.

### 20.3 Títulos

Deve ser reutilizado profile.commander_titles ou a ownership canônica vigente.

### 20.4 Backgrounds

Deve ser reutilizado profile.commander_backgrounds ou a ownership canônica vigente.

### 20.5 Item já possuído

Se, por alguma exceção operacional, o usuário já possuir o item:

- ownership insert pode ser idempotente/no-op;
- claim ainda é registrado;
- a recompensa fica CLAIMED;
- V1 não converte item duplicado em Créditos automaticamente.

Conteúdo sazonal deve ser configurado para minimizar essa situação.

## 21. COLETAR TODAS

A V1 MUST possuir ação COLETAR TODAS.

Ela coleta todas as recompensas atualmente elegíveis da temporada.

Ordenação determinística:

1. level crescente;
2. free antes de premium ou outra ordem fixa documentada;
3. position crescente;
4. reward_id como desempate final.

A operação SHOULD ocorrer em uma única transação limitada ao Passe atual.

Se uma concessão falhar antes do commit, nenhuma recompensa do batch deve aparecer parcialmente coletada.

O retorno deve resumir:

- quantidade total;
- Créditos recebidos;
- cosméticos recebidos;
- títulos;
- backgrounds;
- rewards que já estavam claimed em retry.

## 22. Animações de coleta

A animação ocorre somente depois de confirmação autoritativa do servidor.

Nunca:

~~~text
anima -> concede reward
~~~

Sempre:

~~~text
servidor concede -> commit -> frontend anima
~~~

### 22.1 Créditos

Microanimação curta.

Comportamento:

1. card recebe highlight;
2. valor +N CR aparece;
3. saldo visual pode atualizar;
4. card muda para COLETADO.

Duração recomendada:

400–700 ms.

### 22.2 Cosmético padrão

Reveal curto:

1. preview ganha foco;
2. item cresce via transform;
3. texto RECOMPENSA OBTIDA;
4. nome/raridade;
5. estado final COLETADO.

Sem alterar layout estrutural.

### 22.3 Marco importante

Dados, territory skin, background e títulos MAY usar apresentação central curta.

Nível 100 deve possuir apresentação especial:

~~~text
CAMPANHA CONCLUÍDA

TRILHA LIVRE
Título Livre

TRILHA ELITE
Título Elite
~~~

Quando o jogador não possui Elite, somente o resultado Livre é mostrado como adquirido.

### 22.4 Claim all

COLETAR TODAS MUST NOT reproduzir dezenas de overlays sequenciais.

A UI deve mostrar uma apresentação resumida:

~~~text
RECOMPENSAS RECEBIDAS

+1.250 CR
3 dados
1 território
1 background
2 títulos
~~~

Itens de maior valor podem receber destaque maior dentro da mesma tela.

### 22.5 Reduced motion

Com prefers-reduced-motion: reduce:

- remover zooms;
- remover slides longos;
- remover flashes decorativos;
- remover animações repetidas;
- atualizar para o estado final rapidamente;
- preservar feedback textual de sucesso.

## 23. Marcadores visuais de coleta

Cards MUST comunicar estado por texto/ícone, nunca somente por cor.

### claimed

~~~text
✓ COLETADO
~~~

### claimable

~~~text
DISPONÍVEL
COLETAR
~~~

### locked

~~~text
BLOQUEADO
NÍVEL 42
~~~

### premium_locked

~~~text
ELITE
ATIVAR TRILHA DE ELITE
~~~

### empty level

~~~text
SEM RECOMPENSA
~~~

## 24. Acesso pela /home

A /home autenticada passa a possuir quatro destinos principais:

~~~text
01 OPERAÇÕES
02 DOUTRINA
03 COMANDO
04 CAMPANHA
~~~

CAMPANHA é acesso primário ao Passe.

href alvo recomendado:

/campaign

### 24.1 Resumo na Home

Quando existe temporada ativa, o destino Campanha SHOULD apresentar informação compacta equivalente a:

- nome/temporada;
- nível atual;
- progresso para o próximo nível;
- número de rewards claimable.

Exemplo:

~~~text
04
CAMPANHA

TEMPORADA 01
NÍVEL 38
████████░░

3 RECOMPENSAS PARA COLETAR
~~~

Rewards premium_locked não contam no badge de claimable.

### 24.2 Sem temporada

A opção permanece legível, mas não promete progressão inexistente.

Exemplo:

~~~text
CAMPANHA
NENHUMA CAMPANHA ATIVA
~~~

### 24.3 Alterações estruturais esperadas

A implementação deve considerar os contratos atuais em:

- src/components/pre-game/home/command-home-client.tsx;
- HomeDestinationId;
- command-home-scene-intent;
- command-home.module.css.

O grid não deve simplesmente comprimir quatro destinos em telas estreitas.

Direção:

~~~text
desktop amplo -> 4 colunas
tablet        -> 2 x 2
mobile        -> composição vertical/2 colunas conforme espaço real
~~~

Sem overflow horizontal acidental.

## 25. Página /campaign

A experiência completa deve viver em:

/campaign

A página é autenticada e noindex, consistente com outras superfícies privadas.

Estrutura:

1. Hero da temporada;
2. Progresso atual;
3. CTA Elite;
4. Trilhas de recompensa;
5. ações de claim;
6. informações compactas da temporada.

## 26. Hero

Conteúdo mínimo:

- CAMPANHA // TEMPORADA;
- nome da temporada;
- tempo restante;
- nível;
- XP atual;
- XP necessário para o próximo nível;
- CTA para recompensas;
- CTA ATIVAR TRILHA DE ELITE quando aplicável;
- asset sazonal.

Identidade visual:

- dark military surface;
- marfim;
- latão;
- vermelho já existente quando semântico;
- tipografia brand/display/mono atual;
- placas e linhas técnicas coerentes com Intendência e Comando.

Não criar nova linguagem visual desconectada.

## 27. Visual das trilhas

### 27.1 Desktop

Layout preferencial:

~~~text
ELITE
[reward][reward][reward][reward]

---------- progress axis ----------

LIVRE
[reward][reward][reward][reward]
~~~

Elite acima.

Livre abaixo.

O nível atual deve possuir hierarquia visual superior.

### 27.2 Mobile

Não reduzir o desktop por scale.

Mobile deve transformar cada nível em unidade vertical:

~~~text
NÍVEL 38

LIVRE
[reward / estado]

ELITE
[reward / estado]
~~~

A composição deve continuar legível em viewport estreito.

## 28. Navegação de 100 níveis

A página MUST evitar exigir rolagem manual desde o nível 1 toda vez.

Ao abrir a temporada:

- posicionar o nível atual na área útil;
- permitir navegar para anteriores/próximos;
- não usar animação longa obrigatória;
- respeitar reduced motion.

A implementação MAY usar scroll horizontal controlado em desktop desde que:

- seja semanticamente navegável por teclado;
- não produza overflow da página inteira;
- preserve foco;
- ofereça alternativa de navegação clara.

## 29. CTA Elite

Quando o usuário ainda não possui Elite:

~~~text
ATIVAR TRILHA DE ELITE
3.000 CR
~~~

A área SHOULD informar quantas rewards retroativas ficariam imediatamente disponíveis.

Exemplo:

~~~text
17 RECOMPENSAS JÁ DESBLOQUEADAS
~~~

Ao abrir confirmação:

- saldo atual;
- preço 3.000;
- resumo do que fica imediatamente claimable;
- confirmação explícita;
- estado de saldo insuficiente;
- nenhum débito silencioso.

## 30. Depois da compra Elite

Após compra confirmada:

1. refresh autoritativo;
2. mensagem TRILHA DE ELITE ATIVADA;
3. quantidade de novas rewards claimable;
4. opções:
   - COLETAR TODAS;
   - VER RECOMPENSAS.

Não tocar automaticamente dezenas de animações.

## 31. Integração pós-partida e feedback durante o match

A tela final da partida SHOULD mostrar a liquidação autoritativa sem obrigar navegação.

Exemplo de conclusão:

~~~text
PROGRESSO DE CAMPANHA

PARTIDA CONCLUÍDA  +150 XP
-------------------------
TOTAL DA PARTIDA    485 XP

NÍVEL 17 -> 18
~~~

Exemplo de vitória:

~~~text
PROGRESSO DE CAMPANHA

VITÓRIA
CONCLUSÃO          +150 XP
VITÓRIA            +200 XP
-------------------------
TOTAL DA PARTIDA    735 XP
~~~

A tela apenas apresenta resultado já persistido.

Não concede XP.

### 31.1 Objetivo do feedback imediato

Toda ação autoritativa que efetivamente acrescentar XP ao acumulador do jogador SHOULD produzir feedback visual curto.

O feedback:

- confirma ganho real;
- não é autoridade;
- nunca calcula XP localmente;
- nunca bloqueia interação;
- não captura pointer;
- não altera layout;
- não substitui o settlement final.

### 31.2 Camada e stacking

A hierarquia de jogo V1 passa a reservar:

~~~text
5     mapa
20    overlays do mapa
30    tooltip
40    HUD
80    backdrop de modal
81    modal
90    toast
99    feedback de XP
120   cinematic de dados 3D
~~~

Adicionar token equivalente a:

~~~css
--z-game-xp-feedback: 99;
~~~

O root SHOULD ser absoluto sobre a game viewport:

~~~text
position: absolute
inset: 0
z-index: 99
pointer-events: none
overflow: hidden
~~~

A cinematic 3D continua acima em 120.

### 31.3 Posição

O feedback principal aparece no centro superior da viewport, abaixo do HUD.

Desktop:

~~~text
top aproximado: clamp(82px, 12dvh, 128px)
left: 50%
~~~

Mobile deve respeitar HUD, safe area e player rail sem causar overflow.

### 31.4 Intensidades

A V1 usa quatro intensidades visuais, não uma animação diferente por action_kind.

#### micro — 650 ms

Para:

- reforços posicionados;
- microresultado de combate/perda quando não agregado a feedback maior.

Exemplo:

~~~text
REFORÇOS POSICIONADOS
+8 XP
~~~

#### standard — 850 ms

Para:

- troca de cartas;
- confronto de dados agregado.

Exemplo:

~~~text
CONFRONTO
+5 XP
2 tropas derrotadas · 1 perdida
~~~

#### major — 1.000–1.100 ms

Para:

- primeira conquista;
- reconquista válida.

Exemplos:

~~~text
TERRITÓRIO DOMINADO
+25 XP
~~~

~~~text
RECONQUISTA
+10 XP
~~~

#### terminal — 1.300–1.500 ms

Para:

- conclusão;
- vitória;
- settlement na saída.

Saída voluntária usa linguagem sem + sobre o total já apresentado:

~~~text
PROGRESSO DE CAMPANHA

XP DA PARTIDA SALVO
287 XP
~~~

### 31.5 Princípios de animação

Aplicar skills/frontend-quality/SKILL.md.

Animações MUST preferir:

- opacity;
- transform;
- pseudo-elementos estáticos com opacity/transform.

Evitar animação contínua de propriedades que provoquem layout/reflow.

Direção visual:

~~~text
entrada:
opacity 0
translateY(6px)
scale(.97)

ênfase:
opacity 1
translateY(0)
scale(1)

saída:
opacity 0
translateY(-8px)
~~~

Major MAY usar halo radial sutil animado somente por transform/opacity.

Sem partículas pesadas, canvas extra ou dependência nova na V1.

### 31.6 Queue e coalescing

Existe no máximo uma apresentação de XP ativa.

Eventos entram em fila cronológica:

~~~text
queued
-> entering
-> visible
-> leaving
-> complete
~~~

Não sobrepor vários popups.

Eventos de uma mesma resolução/comando SHOULD ser agregados.

Exemplos:

- posicionar 8 tropas -> um popup +8 XP;
- resultado de dados com 2 derrotadas e 1 perdida -> um popup +5 XP;
- vitória -> uma composição terminal contendo conclusão + vitória.

Se cinematic de dados estiver ativa, o evento permanece queued e começa somente depois da cinematic.

Eventos cujo delta autoritativo final seja 0 não produzem popup.

### 31.7 Contrato autoritativo de apresentação

Contrato conceitual:

~~~text
GameXpPresentationEvent
- id
- matchId
- sourceKey
- kind
- xp
- label
- detail nullable
- intensity
- occurredAt
~~~

kind V1:

~~~text
troops_placed
card_trade
combat
territory_conquered
territory_reconquered
match_completed
match_won
match_settled
~~~

O evento MUST ser derivado no servidor a partir do mesmo commit que persistiu battle_pass_match_xp_actions ou settlement.

O browser não envia xp, kind ou label como prova de progressão.

A entrega MAY ocorrer pela response do comando e/ou canal realtime privado, mas MUST ser específica ao participante; XP individual não deve ser broadcast público para todos os jogadores.

Retry/reconnect MUST usar id/sourceKey para deduplicar apresentação local.

### 31.8 Componentização frontend

Estrutura alvo:

~~~text
src/lib/shared/progression/
  battle-pass-game-xp-event.ts

src/hooks/
  use-game-xp-feedback.ts

src/components/progression/battle-pass/
  game-xp-feedback.tsx
  game-xp-feedback.module.css
~~~

GameXpFeedback é montado uma única vez no runtime da partida.

Nenhum command component cria seu próprio toast de XP.

### 31.9 Acessibilidade e reduced motion

O visual animado SHOULD ser aria-hidden.

Um único live region separado anuncia o evento:

~~~html
role="status"
aria-live="polite"
aria-atomic="true"
~~~

Exemplo de anúncio:

~~~text
Território dominado. Mais 25 experiência de campanha.
~~~

Com prefers-reduced-motion: reduce:

- remover translate;
- remover scale;
- remover halo em expansão;
- preservar conteúdo textual;
- usar apresentação estática curta, aproximadamente 800 ms;
- não remover a confirmação de XP.

O feedback não recebe foco e não interfere no teclado.

## 32. Contrato de leitura

Endpoint recomendado:

~~~text
GET /api/battle-pass
~~~

ou equivalente REST sob /api/progression.

Snapshot SHOULD conter:

~~~text
season
progress
xp
level
xpToNextLevel
premiumAccess
premiumPrice
walletBalance
claimableCount
levels[]
rewards[]
~~~

Cada reward contém estado derivado autoritativamente.

Não enviar informações secretas ou administrativas.

## 33. Claim individual

Endpoint recomendado:

~~~text
POST /api/battle-pass/rewards/claim
~~~

Entrada mínima:

~~~json
{
  "rewardId": "..."
}
~~~

O servidor deriva:

- user;
- season;
- level;
- track;
- payload;
- entitlement.

O cliente não envia quantidade monetária nem ID de ownership a conceder.

## 34. Claim all

Endpoint recomendado:

~~~text
POST /api/battle-pass/rewards/claim-all
~~~

Entrada MAY conter seasonId, mas o servidor valida a temporada.

Não aceitar lista arbitrária de valores monetários ou tipos de entitlement fornecida pelo browser.

## 35. Compra Elite

A compra SHOULD reutilizar o endpoint/serviço de compra econômico existente com:

- offerId;
- expectedPrice = 3000;
- idempotency key.

Caso exista wrapper específico de UI da Campanha, ele deve apenas adaptar o fluxo; não duplicar lógica econômica.

## 36. Serviços sugeridos

Estrutura preferencial:

~~~text
src/lib/shared/progression/
  battle-pass-contract.ts
  battle-pass-reward-state.ts
  battle-pass-xp.ts
  battle-pass-game-xp-event.ts

src/lib/server/progression/
  battle-pass-service.ts
  battle-pass-repository.ts
  battle-pass-match-xp-service.ts
  battle-pass-reward-service.ts

src/hooks/
  use-game-xp-feedback.ts

src/components/progression/battle-pass/
  game-xp-feedback.tsx
  game-xp-feedback.module.css
  battle-pass-page.tsx
  battle-pass-hero.tsx
  battle-pass-progress.tsx
  battle-pass-track.tsx
  battle-pass-level.tsx
  battle-pass-reward-card.tsx
  battle-pass-reward-preview.tsx
  battle-pass-premium-panel.tsx
  battle-pass-claim-feedback.tsx
~~~

Os nomes MAY ser ajustados às convenções encontradas durante implementação.

A separação de responsabilidade é obrigatória; os componentes não devem executar SQL ou decidir eligibility.

## 37. Reuso de previews

A UI MUST reutilizar componentes canônicos quando aplicável:

- ProfileTitleRenderer;
- TerritorySkinPreview;
- ProfileCosmeticImage;
- previews de dados existentes;
- coin.svg para Créditos.

Não implementar um segundo renderer de título, territory skin ou moeda apenas para o Passe.

## 38. Identidade visual

O Passe deve preservar os tokens conceituais já usados na Intendência:

- marfim aproximado #eee8da;
- latão aproximado #d0aa57;
- vermelho militar existente;
- superfícies verde/preto;
- tipografias atuais.

A implementação SHOULD reutilizar variáveis/tokens existentes quando já estiverem disponíveis.

Não fazer um refactor visual global como pré-requisito.

## 39. Frontend Quality

Aplicar skills/frontend-quality/SKILL.md.

MUST verificar:

- conteúdo acessível;
- ausência de overflow horizontal acidental;
- min-width: 0 onde grids/flex exigirem;
- wrapping;
- contraste;
- foco visível;
- teclado;
- botões com área adequada;
- aria-live para feedback de claim;
- estados não representados somente por cor;
- reduced motion;
- imagens com dimensões conhecidas;
- evitar layout shift;
- lazy loading para assets fora do viewport;
- não carregar previews pesados de 100 níveis simultaneamente sem necessidade;
- estabilidade em desktop/mobile e alturas reduzidas.

## 40. Performance frontend

A página possui 100 níveis e potencialmente muitas imagens.

Portanto:

- não carregar todos os assets full-resolution imediatamente;
- usar previews adequados;
- priorizar somente hero e conteúdo visível;
- usar lazy loading no restante;
- evitar montar renderizadores 3D de dados para todos os 100 níveis simultaneamente;
- previews estáticos/leves SHOULD ser usados na trilha;
- renderização detalhada MAY ocorrer ao abrir reward;
- evitar timers por card;
- um único relógio/estado pode derivar tempo restante da temporada;
- animações devem preferir transform e opacity.

## 41. Semântica e acessibilidade

MUST:

- trilhas possuir heading/label semântico;
- reward card possuir nome acessível;
- estado de claim ser textual;
- botões COLETAR e COLETAR TODAS serem operáveis por teclado;
- modal/painel de Elite prender/restaurar foco corretamente quando modal for utilizado;
- feedback de claim usar aria-live polite;
- erro de compra/claim ser anunciado;
- reduced motion preservar informação;
- ícones decorativos terem aria-hidden;
- não aninhar controles interativos inválidos.

## 42. Segurança

MUST NOT:

- aceitar XP declarado pelo frontend;
- aceitar level declarado como prova de elegibilidade;
- aceitar credit_amount do browser;
- aceitar reward payload arbitrário;
- aceitar season premium sem purchase/access persistido;
- confiar em claimed local;
- conceder reward fora de transação;
- manipular wallet sem ledger;
- criar ownership baseado em asset_ref enviado pelo cliente.

Toda decisão autoritativa vem de PostgreSQL e dos serviços server-only.

## 43. Concorrência

Casos obrigatórios:

### Dois claims simultâneos da mesma reward

Resultado:

- uma única concessão;
- um único claim;
- ambos requests podem receber resposta idempotente segura;
- nenhuma duplicação de Créditos.

### Claim individual concorrente com claim-all

Resultado:

- no máximo uma concessão de cada reward;
- unique constraints e locks preservam consistência.

### Duas compras Elite simultâneas

O pipeline econômico/idempotência MUST impedir débito duplicado e access duplicado.

## 44. Realtime

A V1 não exige que progressão dependa de WebSocket para consistência.

PostgreSQL continua autoritativo.

Após partida:

- response/snapshot pode trazer delta de XP;
- UI pode atualizar;
- refresh HTTP recupera estado correto.

Uma invalidação realtime MAY ser adicionada para sincronizar múltiplas abas, mas não deve ser requisito para conceder XP ou claim.

## 45. Cache

Pode ser cacheado brevemente:

- catálogo compartilhado da temporada;
- níveis;
- rewards;
- assets editoriais.

Não cachear como autoridade compartilhada:

- XP do usuário;
- level materializado do usuário;
- premium access do usuário;
- claim state;
- wallet;
- saldo;
- eligibility de claim.

Esses dados permanecem frescos/autoritativos conforme as invariantes de Economy e Profile.

## 46. Assets sazonais

A temporada MAY possuir:

- hero;
- logo;
- background/editorial art.

Assets de recompensa continuam pertencendo aos catálogos canônicos de cosméticos/títulos/backgrounds.

Não duplicar arquivos de item apenas para o Passe.

Assets editoriais devem seguir a estratégia vigente de R2/asset delivery.

## 47. Validação de catálogo

Antes de ativar uma temporada, testes/validação SHOULD garantir:

- exatamente 100 níveis;
- thresholds de XP válidos;
- nível 100 com required_total_xp exatamente 40.000;
- primeiro step exatamente 225 e último step exatamente 615;
- XP profile com todos os valores/caps V1;

- total free credit = 1000;
- total premium credit = 2500;
- nenhum credit reward entre 1 e 4;
- ambos os títulos no nível 100;
- nenhum credit reward no nível 100;
- conjunto Livre com os seis componentes esperados;
- conjunto Elite inicial com 3 dados + território;
- conjunto Elite final com 3 dados + território + background + título;
- todas as referências de reward existentes;
- nenhum reward_id duplicado;
- position única dentro de season/level/track;
- premium offer com preço 3000;
- assets editoriais obrigatórios resolvíveis;
- claim window coerente.

## 48. Validação específica da matriz V1

A fixture inicial MUST produzir exatamente:

Livre:

- 1.000 Créditos;
- 3 dados;
- 1 território;
- 1 background;
- 1 título.

Elite adicional:

- 2.500 Créditos;
- conjunto inicial: 3 dados + 1 território;
- conjunto final: 3 dados + 1 território + 1 background + 1 título.

Jogador Elite completo:

- 3.500 Créditos;
- 9 dados;
- 3 territory skins;
- 2 backgrounds;
- 2 títulos.

Total cosmético:

16 itens.

## 49. Histórico e exclusão de conta

XP entries, progress, access e claims possuem user_id.

Política de ON DELETE deve seguir as convenções de privacidade/account deletion existentes.

Histórico de match pode preservar snapshots sem reter vínculo pessoal além do necessário, conforme o contrato atual de game.match_participants.

A implementação MUST revisar FKs antes da migration final; este SPEC não autoriza reter dados pessoais contrariando o fluxo de exclusão existente.

## 50. Erros públicos

Erros devem ser estáveis e genéricos.

Exemplos:

- BATTLE_PASS_NOT_ACTIVE
- BATTLE_PASS_REWARD_NOT_FOUND
- BATTLE_PASS_LEVEL_REQUIRED
- BATTLE_PASS_PREMIUM_REQUIRED
- BATTLE_PASS_REWARD_ALREADY_CLAIMED
- BATTLE_PASS_CLAIM_WINDOW_CLOSED
- BATTLE_PASS_PURCHASE_ALREADY_OWNED
- ECONOMY_INSUFFICIENT_BALANCE
- ECONOMY_PRICE_CHANGED

Não expor SQL, IDs internos desnecessários ou detalhes de locks.

## 51. Testes de domínio

MUST cobrir:

- threshold de nível;
- curva V1 soma exatamente 40.000 XP;
- 1 -> 2 exige 225 XP;
- 99 -> 100 exige 615 XP;
- XP suficiente/insuficiente;
- cap no nível 100;
- match sem temporada;
- match cruzando fim de temporada;
- tropa posicionada e cap de 60 XP;
- troca de cartas e cap de 80 XP;
- tropas perdidas nos dados e cap de 50 XP;
- tropas derrotadas nos dados e cap de 100 XP;
- combate agrega vitória/derrota em um único delta;
- primeira conquista +25;
- segunda conquista do mesmo território +10;
- terceira+ conquista do mesmo território +0;
- movimentação/manobra +0;
- troca entre jogadores +0;
- conclusão +150;
- vitória +200 adicionais;
- vitória com um vencedor;
- múltiplos vencedores;
- derrotado/eliminado recebe conclusão;
- bot;
- participante sem user;
- saída voluntária liquida ações sem conclusão/vitória;
- settlement idempotente;
- retry de action XP;
- dois matches diferentes;
- rematch;
- multiplicador solo+bots 40% sem divergência de arredondamento;
- total de créditos por trilha;
- mínimo 5;
- nível vazio;
- múltiplas rewards no mesmo nível;
- purchase premium retroativa;
- reward free;
- reward premium;
- premium_locked;
- claimable;
- claimed.

## 52. Testes de integração PostgreSQL

MUST cobrir:

- migrations;
- constraints;
- XP action ledger idempotente;
- acumulador por match;
- atualização de progress somente no settlement;
- concorrência de action XP;
- concorrência de settlement;
- settlement em saída voluntária;
- rollback de gameplay também faz rollback do XP pendente;
- caps por fonte;
- diminishing returns de território;
- XP final coincide com soma dos deltas autoritativos apresentados;

- compra Elite com wallet/ledger/receipt;
- purchase duplicada;
- claim credit;
- claim cosmetic;
- claim title;
- claim background;
- claim duplicada;
- claim-all;
- claim-all concorrente;
- rollback em erro;
- account ownership;
- season lifecycle.

## 53. Testes frontend

MUST cobrir os fluxos críticos:

### /home

- quarto destino Campanha;
- estado sem temporada;
- nível/progresso;
- badge claimable;
- teclado;
- desktop;
- mobile.

### partida

- feedback z-index 99;
- queue de eventos;
- agregação por comando;
- cinematic suspende apresentação sem perder evento;
- deduplicação por id/sourceKey;
- reforço;
- troca de cartas;
- confronto;
- conquista;
- reconquista;
- conclusão;
- vitória;
- saída com XP DA PARTIDA SALVO;
- aria-live único;
- reduced motion;
- nenhuma animação para delta 0;
- nenhuma interação bloqueada.

### /campaign

- Livre sem Elite;
- premium_locked;
- compra Elite;
- saldo insuficiente;
- retroactive unlock;
- claim individual;
- claim all;
- claimed marker;
- nível vazio;
- nível 100;
- reduced motion;
- viewport estreito;
- ausência de overflow.

## 54. Regressão visual

A feature depende fortemente de layout.

SHOULD existir validação visual para:

- desktop largo;
- desktop baixo;
- tablet;
- mobile estreito;
- estado Free;
- estado Elite;
- rewards pendentes;
- nível atual;
- nível 100;
- modal/painel de ativação;
- feedback XP micro;
- feedback XP standard;
- feedback XP major;
- feedback XP terminal;
- feedback durante viewport mobile;
- feedback com reduced motion.

## 55. Rollout

Implementação recomendada em fases.

### P0 — Fundação de dados

- migration progression/catalog;
- season;
- levels;
- XP profile;
- rewards;
- progress;
- XP entries;
- access;
- claims;
- constraints;
- seeds/fixture da temporada.

### P1 — XP acumulativo de partida

- estender XP profile com valores/caps V1;
- snapshot completo season/profile no match;
- action ledger por comando/evento;
- battle_pass_match_progress;
- contador de conquistas por território;
- hooks em reforço, troca de cartas, combate e conquista;
- left_at snapshot;
- settlement por conclusão;
- settlement por saída voluntária;
- conclusão +150;
- vitória +200;
- multiplicador solo+bots;
- idempotência de actions;
- idempotência de settlement;
- resposta pós-partida;
- eventos privados de apresentação de XP.

### P2 — Claims

- grant de Créditos;
- grant de cosméticos;
- grant de títulos;
- grant de backgrounds;
- claim individual;
- claim all.

### P3 — Elite

- entitlement battle_pass_access;
- produto/oferta 3000;
- integração Economy;
- compra retroativa.

### P4 — Frontend

- /home;
- /campaign;
- hero;
- trilhas;
- reward states;
- previews;
- purchase;
- claims;
- animations;
- responsive/reduced motion.

### P5 — Hardening

- concorrência;
- catálogo validator;
- performance;
- regressão visual;
- E2E;
- observabilidade.

## 56. Observabilidade

Logs server-side SHOULD permitir correlacionar:

- season_id;
- match_id;
- user_id quando permitido;
- XP entry;
- reward_id;
- claim;
- purchase_id.

Não logar secrets, session tokens ou dados de pagamento.

Eventos relevantes:

- battle_pass_xp_action_recorded;
- battle_pass_xp_action_duplicate_ignored;
- battle_pass_xp_settled;
- battle_pass_xp_settlement_duplicate_ignored;
- battle_pass_xp_granted;
- battle_pass_xp_duplicate_ignored;
- battle_pass_premium_unlocked;
- battle_pass_reward_claimed;
- battle_pass_claim_duplicate;
- battle_pass_claim_failed.

## 57. Fora de escopo da V1

Não fazem parte deste SPEC:

- missões diárias;
- missões semanais;
- compra direta de XP;
- skip de nível;
- presente de Passe;
- transferência de reward;
- marketplace;
- refund automático do Passe;
- prestígio após nível 100;
- nível 101+;
- trilhas adicionais;
- auto-claim obrigatório;
- XP por simplesmente iniciar um ataque;
- XP por movimentação/manobra de tropas;
- XP por troca entre jogadores;
- XP por terceira ou posterior reconquista do mesmo território pelo mesmo jogador no match;
- XP baseado em evento declarado pelo browser.

Essas features futuras não devem ser antecipadas com complexidade desnecessária.

## 58. Critério de conclusão

A feature está concluída quando:

1. /home apresenta Campanha como quarto destino;
2. /campaign apresenta temporada ativa com identidade Bellum Civile;
3. existem exatamente 100 níveis;
4. XP é calculado e acumulado por ações somente no servidor;
5. match congela temporada/perfil completo de XP;
6. action ledger impede duplicação de ações de XP;
7. settlement final impede duplicação do grant sazonal;
8. progresso sazonal só é alterado no settlement;
9. saída voluntária preserva XP de ações e remove bônus de conclusão/vitória;
10. derrotado/eliminado normalmente recebe bônus de conclusão;
11. movimentação/manobra e troca entre jogadores concedem 0 XP;
12. caps e diminishing returns antifarm estão ativos;
13. nível 100 exige exatamente 40.000 XP;
14. progress apresenta nível correto;
15. Livre funciona sem compra;
16. Elite custa exatamente 3.000 Créditos;
17. compra Elite usa Economy V2 e é idempotente;
18. compra tardia libera rewards anteriores sem alterar XP;
19. Livre contém exatamente 1.000 Créditos;
20. Elite adiciona exatamente 2.500 Créditos;
21. nenhuma reward monetária é menor que 5;
22. níveis vazios funcionam;
23. coleção Livre entrega 3 dados, território, background e título;
24. Elite inicial entrega 3 dados + território;
25. Elite final entrega 3 dados, território, background e título;
26. Livre e Elite entregam títulos distintos no nível 100;
27. nível 100 não entrega moeda;
28. reward state diferencia locked, premium_locked, claimable e claimed;
29. claim individual é transacional e idempotente;
30. claim-all funciona sem duplicar grants;
31. Créditos recebidos entram em economy.ledger_entries;
32. cosméticos reutilizam ownership existente;
33. feedback de XP e animações de claim só iniciam após confirmação autoritativa correspondente;
34. claim-all não reproduz dezenas de overlays;
35. feedback de XP em partida usa somente delta confirmado pelo servidor;
36. feedback de XP usa queue, não sobrepõe eventos e não bloqueia interação;
37. cinematic de dados posterga feedback correspondente até poder ser visto;
38. reduced motion preserva a informação sem movimento desnecessário;
39. /home e /campaign não possuem overflow horizontal acidental;
40. navegação por teclado e foco são preservados;
41. assets não causam carregamento inicial desnecessário dos 100 níveis;
42. action XP, settlement, claims e compra Elite possuem cobertura de concorrência/integridade;
43. testes de domínio, banco, frontend e concorrência críticos estão verdes.

## 59. Resumo canônico V1

~~~text
PASSE DE CAMPANHA
100 níveis
40.000 XP para alcançar o nível 100

XP DE PARTIDA
  tropa colocada                 +1 (cap 60)
  troca de cartas               +20 (cap 80)
  tropa perdida nos dados        +1 (cap 50)
  tropa inimiga derrotada        +2 (cap 100)
  1ª conquista do território    +25
  2ª conquista                  +10
  3ª+                             0
  conclusão                    +150
  vitória                      +200 adicional
  manobra/movimentação            0
  troca entre jogadores           0

CURVA
  nível 1 -> 2                 225 XP
  nível 99 -> 100              615 XP
  acumulado nível 100       40.000 XP

TRILHA LIVRE
Preço: 0
Créditos: 1.000
Cosméticos:
  3 dados
  1 território
  1 background
  1 título no nível 100

TRILHA ELITE
Preço: 3.000 CR
Créditos adicionais: 2.500

Conjunto Elite Inicial:
  3 dados
  1 território

Conjunto Elite Final:
  3 dados
  1 território
  1 background
  1 título no nível 100

TOTAL PARA ELITE COMPLETO:
  3.500 CR
  16 cosméticos
  2 títulos finais distintos

CLAIM:
  individual
  coletar todas
  persistente
  idempotente
  animado após commit

ACESSO:
  /home -> CAMPANHA -> /campaign
~~~
