# SPEC — Títulos por Conquistas

Status: **catálogo definido; concessão automática ainda não implementada**

Este documento especializa `docs/pre-game/profile/SPEC.md` para títulos cosméticos
desbloqueados por conquistas, participação no beta e marcos econômicos.

A migration `058-commander-title-achievement-catalog.sql` cria somente os registros
em `catalog.commander_titles`. Ela MUST NOT conceder ownership automaticamente.

## 1. Objetivo

O sistema futuro de conquistas MUST transformar fatos autoritativos já confirmados
pelo servidor em ownership permanente de títulos de comandante.

O browser MUST NOT:

- declarar que uma conquista ocorreu;
- informar contadores finais;
- informar gasto acumulado;
- escolher `acquisition_source`;
- conceder diretamente uma linha em `profile.commander_titles`.

A concessão MUST ser idempotente e server-authoritative.

## 2. Catálogo inicial

| ID | Título | Raridade | Fonte | Style key | Condição futura |
| --- | --- | --- | --- | --- | --- |
| `title.beta-tester` | BETA TESTER | epic | `tactical-tech` | `cyan-holo-drift_glow-blue-medium` | possuir conta criada/ativa durante a janela oficial de beta |
| `title.first-victory` | VITORIOSO | uncommon | `command-display` | `bronze-metal` | atingir 1 vitória autoritativa |
| `title.total-conquest-1` | CONQUISTADOR | rare | `military-stencil` | `red-metal_glow-red-soft` | atingir 1 vitória controlando todos os territórios |
| `title.total-conquest-10` | DOMINADOR | epic | `military-stencil` | `crimson-metal-sheen_glow-red-medium` | atingir 10 vitórias controlando todos os territórios |
| `title.total-conquest-100` | IMPERADOR | legendary | `imperial` | `gold-metal-sheen_glow-gold-strong-breathe` | atingir 100 vitórias controlando todos os territórios |
| `title.victories-1000` | SOBERANO | legendary | `imperial` | `night-aurora-drift_glow-gold-strong` | atingir 1.000 vitórias autoritativas, sem exigir domínio total |
| `title.store-purchase` | PATRONO | rare | `ceremonial` | `bronze-satin_glow-amber-medium` | concluir a primeira compra elegível na Intendência |
| `title.store-spend-100-brl` | GRÃO-PATRONO | epic | `ceremonial` | `gold-satin-sheen_glow-amber-medium` | gasto real elegível acumulado ficar estritamente acima de R$ 100,00 |
| `title.store-spend-1000-brl` | MECENAS | legendary | `ceremonial` | `gold-metal-sheen_glow-gold-strong-breathe` | gasto real elegível acumulado ficar estritamente acima de R$ 1.000,00 |

Os títulos desta tabela MUST NOT possuir linha em
`catalog.commander_title_pricing` enquanto continuarem sendo recompensas.

## 3. Origem de aquisição

Quando a concessão automática for implementada:

- `title.beta-tester` MUST usar `acquisition_source='promotion'`;
- todos os demais títulos deste SPEC MUST usar `acquisition_source='reward'`.

`purchase` MUST NOT ser usado para Patrono, Grão-Patrono ou Mecenas, pois a
compra desbloqueia a conquista; o título não é o item diretamente comprado.

## 4. Beta Tester

### 4.1 Janela de elegibilidade

A implementação futura MUST possuir uma janela/flag autoritativa de beta.

Enquanto essa janela estiver ativa, uma conta efetivamente criada e persistida
deve ser elegível a `title.beta-tester`.

Registros temporários de cadastro, tentativas de e-mail ou cadastros não
confirmados MUST NOT conceder o título.

### 4.2 Rollout

Quando a concessão for implementada durante o beta, SHOULD existir uma operação
idempotente de backfill para contas já criadas dentro da janela elegível.

Após o encerramento oficial do beta:

- novas contas MUST NOT receber o título;
- ownership já concedido MUST permanecer;
- a data de encerramento/flag MUST ser controlada no servidor, nunca no cliente.

## 5. Vitórias

### 5.1 Fonte de verdade

Os títulos de vitória MUST ser avaliados a partir do estado terminal
autoritativo da partida persistida.

Somente uma partida realmente finalizada com vencedor persistido pode incrementar
o contador de vitória.

Partidas de teste automatizado, fixtures de desenvolvimento ou estados abortados
MUST NOT contar.

### 5.2 Vitória comum

Cada vitória elegível incrementa o contador geral do jogador.

Marcos:

- 1 vitória -> `title.first-victory`;
- 1.000 vitórias -> `title.victories-1000`.

O marco de 1.000 vitórias NÃO exige que todas as vitórias tenham sido por
domínio total.

### 5.3 Domínio total

Uma vitória por domínio total ocorre quando, no estado autoritativo que encerra
a partida, o vencedor controla todos os territórios existentes naquela partida.

A regra MUST ser derivada como:

```text
territorios_controlados_pelo_vencedor == total_territorios_da_partida
total_territorios_da_partida > 0
```

A lógica MUST NOT depender de um literal `42`, embora o mapa Brasil atual tenha
42 territórios.

Essa definição é compatível com o ruleset `supremacy` definido em
`docs/game-modes/SPEC.md`, mas a conquista deve ser baseada no fato autoritativo
de domínio total, não apenas no nome do ruleset.

Marcos acumulados:

- 1 -> `title.total-conquest-1`;
- 10 -> `title.total-conquest-10`;
- 100 -> `title.total-conquest-100`.

Uma mesma partida de domínio total também conta como uma vitória comum.

## 6. Marcos econômicos

### 6.1 Patrono

`title.store-purchase` deve ser concedido após a primeira compra elegível
concluir com sucesso na Intendência.

A implementação MUST reagir à confirmação server-side da compra e MUST NOT
conceder com base em clique, abertura de checkout ou resposta produzida apenas
pelo browser.

### 6.2 Grão-Patrono e Mecenas

Os thresholds são estritos:

```text
GRÃO-PATRONO -> gasto_liquido_brl > 100,00
MECENAS      -> gasto_liquido_brl > 1000,00
```

Logo:

- exatamente R$ 100,00 ainda não concede Grão-Patrono;
- exatamente R$ 1.000,00 ainda não concede Mecenas.

Valores monetários MUST ser representados como inteiros em centavos no caminho
autoritativo:

```text
100,00 BRL  -> 10000 centavos
1000,00 BRL -> 100000 centavos
```

O contador MUST vir de pagamentos reais confirmados em BRL ou de uma projeção
financeira autoritativa equivalente.

Débitos de `campaign-credit` MUST NOT ser interpretados como valor BRL.

Reembolsos, estornos e chargebacks MUST reduzir ou invalidar o gasto elegível
antes da avaliação dos thresholds. A política final de revogação de um título
já concedido após estorno deve ser definida junto da implementação de pagamentos;
ela não deve ser inferida pelo frontend.

## 7. Serviço de concessão futuro

A implementação SHOULD possuir uma única fronteira de domínio equivalente a:

```text
grantCommanderTitle(userId, titleId, acquisitionSource)
```

Essa operação MUST:

1. validar que o título existe e está ativo;
2. inserir `profile.commander_titles` de forma idempotente;
3. usar o `acquisition_source` definido neste SPEC;
4. atualizar `catalog.commander_title_stats.acquisition_count` somente quando
   uma nova ownership for realmente criada;
5. executar as mutações relacionadas na mesma transação;
6. nunca equipar automaticamente um novo título, salvo futura decisão explícita.

A chave primária `(user_id,title_id)` existente em `profile.commander_titles`
deve continuar sendo a proteção relacional contra grant duplicado.

## 8. Contadores e recomputação

A implementação futura SHOULD manter projeções incrementais para evitar contar
todo o histórico a cada finalização de partida ou pagamento.

Entretanto, as projeções MUST ser reconstruíveis a partir das fontes duráveis
autoritativas.

Eventos repetidos/retries MUST ser idempotentes e não podem incrementar o mesmo
match ou pagamento duas vezes.

Uma solução futura MAY introduzir uma tabela de progresso por conquista, desde
que:

- a fonte de verdade continue sendo o histórico autoritativo;
- exista identificação estável do evento processado;
- os grants continuem idempotentes.

## 9. Não objetivos desta entrega

Esta entrega NÃO implementa:

- listeners de finalização de partida;
- contadores de vitória;
- contadores de domínio total;
- integração com provedor de pagamento;
- cálculo de gasto BRL;
- backfill de Beta Tester;
- grants automáticos;
- notificações de conquista;
- equipagem automática.

Ela apenas:

1. define o catálogo visual;
2. persiste os nove títulos;
3. documenta as condições autoritativas para implementação posterior.
