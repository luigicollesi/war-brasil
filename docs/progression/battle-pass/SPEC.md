# War Brasil — Passe de Campanha SPEC

Status: **implementação em finalização / P5 hardening e conteúdo real da Temporada 1 pendentes**  
Branch de integração: **dev**  
Escopo: progressão sazonal por XP, Passe Livre, Passe Elite, compra com Créditos de Campanha, recompensas, claims, integração com partidas e experiência de frontend.

## 1. Autoridade e objetivo

Este documento é a autoridade central para a implementação do Passe de Campanha do Bellum Civile.

Ele define:

- progressão sazonal por XP;
- integração autoritativa com partidas;
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
8. ao adquirir Elite tardiamente, recompensas Elite de níveis já alcançados tornam-se coletáveis retroativamente;
9. a Trilha Livre concede exatamente 1.000 Créditos de Campanha ao completar toda a distribuição monetária;
10. a Trilha Elite concede 2.500 Créditos de Campanha adicionais;
11. um jogador Elite que conclui e coleta ambas as trilhas recebe 3.500 Créditos no total da temporada;
12. uma recompensa monetária individual MUST ser de pelo menos 5 Créditos;
13. níveis sem recompensa são válidos;
14. um nível MAY possuir mais de uma recompensa;
15. uma recompensa MUST possuir estado de coleta individual;
16. recompensas desbloqueadas não são automaticamente equivalentes a recompensas coletadas;
17. a interface MUST oferecer coleta individual;
18. a interface MUST oferecer COLETAR TODAS quando existir mais de uma recompensa coletável;
19. a Trilha Livre termina com um título exclusivo no nível 100;
20. a Trilha Elite termina com outro título exclusivo no nível 100;
21. o nível 100 não concede moedas na distribuição V1;
22. o Passe deve ser acessível diretamente pela /home;
23. a experiência completa vive em uma superfície dedicada de Campanha;
24. o navegador nunca declara XP, nível, ownership ou claim como autoritativo.

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

## 7. Perfis de XP

Valores de XP por partida e curva de XP por nível são balanceamento de conteúdo e MUST NOT ficar espalhados como constantes no frontend ou nos command services.

A implementação SHOULD possuir:

~~~text
catalog.battle_pass_xp_profiles
- id
- completion_xp
- victory_bonus_xp
- solo_human_bot_multiplier_bps
- created_at
~~~

O perfil efetivo deve ser congelado por match.

### 7.1 Valores ainda não fechados

Este SPEC não transforma sugestões preliminares de XP em regra definitiva.

Antes do seed da primeira temporada ainda devem ser definidos:

- XP base por partida concluída;
- bônus de vitória;
- eventual multiplicador para partida com um único humano e bots;
- required_total_xp de cada nível.

A arquitetura MUST permitir alterar esses valores criando uma nova configuração/versionamento sem mudar código de gameplay.

## 8. Elegibilidade de XP por partida

XP é concedido exclusivamente pelo servidor.

MUST receber XP somente participante que:

- tenha user_id;
- não seja bot;
- pertença ao match congelado;
- seja elegível pelas regras de conclusão.

Bots recebem 0 XP.

Participantes sem conta recebem 0 XP.

### 8.1 Saída antecipada

Para distinguir conclusão de abandono, game.match_participants SHOULD preservar um snapshot equivalente a:

~~~text
left_at_snapshot
~~~

ou outro campo histórico semanticamente equivalente.

A política V1 SHOULD considerar saída voluntária antes do encerramento como não elegível ao XP de conclusão.

Essa regra deve ser aplicada no servidor e coberta por testes.

## 9. Ponto autoritativo de concessão de XP

O fluxo existente de encerramento de match é o ponto de integração.

Conceitualmente:

~~~text
finalizeGameVictories / finalizeGameWithoutWinner
  -> finishDiceBalanceMatchForRoom
      -> snapshotMatchParticipants
      -> awardBattlePassMatchXp
      -> finalizar game.matches
      -> limpar current_match_id
~~~

awardBattlePassMatchXp MUST executar dentro da mesma fronteira transacional autoritativa do encerramento.

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

## 12. Níveis

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
- required_total_xp inteiro não negativo;
- required_total_xp estritamente crescente a partir do nível 2;
- nível 1 MAY iniciar em 0 XP;
- o nível 100 é o máximo;
- XP acima do requisito do nível 100 não cria nível 101.

A curva não deve ser calculada por fórmula fixa no cliente.

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

## 31. Integração pós-partida

A tela final da partida SHOULD mostrar progressão de Campanha sem obrigar navegação.

Exemplo:

~~~text
PROGRESSO DE CAMPANHA

PARTIDA CONCLUÍDA  +X XP
VITÓRIA            +Y XP
------------------------
TOTAL              +Z XP

NÍVEL 17 -> 18

NOVA RECOMPENSA DISPONÍVEL
VER CAMPANHA
~~~

A tela apenas apresenta resultado já persistido.

Não concede XP.

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

src/lib/server/progression/
  battle-pass-service.ts
  battle-pass-repository.ts
  battle-pass-match-xp-service.ts
  battle-pass-reward-service.ts

src/components/progression/battle-pass/
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
- XP suficiente/insuficiente;
- cap no nível 100;
- match sem temporada;
- match cruzando fim de temporada;
- vitória com um vencedor;
- múltiplos vencedores;
- bot;
- participante sem user;
- abandono;
- retry do XP;
- dois matches diferentes;
- rematch;
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
- XP ledger idempotente;
- atualização de progress;
- concorrência de XP;
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
- modal/painel de ativação.

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

### P1 — XP de partida

- snapshot season/profile no match;
- left_at snapshot;
- awardBattlePassMatchXp;
- idempotência;
- resposta pós-partida.

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
- XP por ataque individual;
- XP por território individual;
- XP por tropas eliminadas;
- XP baseado em evento declarado pelo browser.

Essas features futuras não devem ser antecipadas com complexidade desnecessária.

## 58. Critério de conclusão

A feature está concluída quando:

1. /home apresenta Campanha como quarto destino;
2. /campaign apresenta temporada ativa com identidade Bellum Civile;
3. existem exatamente 100 níveis;
4. XP é concedido por match somente no servidor;
5. match congela temporada/perfil de XP;
6. XP ledger impede duplicação;
7. progress apresenta nível correto;
8. Livre funciona sem compra;
9. Elite custa exatamente 3.000 Créditos;
10. compra Elite usa Economy V2 e é idempotente;
11. compra tardia libera rewards anteriores sem alterar XP;
12. Livre contém exatamente 1.000 Créditos;
13. Elite adiciona exatamente 2.500 Créditos;
14. nenhuma reward monetária é menor que 5;
15. níveis vazios funcionam;
16. coleção Livre entrega 3 dados, território, background e título;
17. Elite inicial entrega 3 dados + território;
18. Elite final entrega 3 dados, território, background e título;
19. Livre e Elite entregam títulos distintos no nível 100;
20. nível 100 não entrega moeda;
21. reward state diferencia locked, premium_locked, claimable e claimed;
22. claim individual é transacional e idempotente;
23. claim-all funciona sem duplicar grants;
24. Créditos recebidos entram em economy.ledger_entries;
25. cosméticos reutilizam ownership existente;
26. animações só iniciam após confirmação do servidor;
27. claim-all não reproduz dezenas de overlays;
28. reduced motion funciona;
29. /home e /campaign não possuem overflow horizontal acidental;
30. navegação por teclado e foco são preservados;
31. assets não causam carregamento inicial desnecessário dos 100 níveis;
32. testes de domínio, banco, frontend e concorrência críticos estão verdes.

## 59. Resumo canônico V1

~~~text
PASSE DE CAMPANHA
100 níveis

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
