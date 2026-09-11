# SPEC — Perfil / Salão de Comando

**Rota:** `/profile`  
**Cena:** `profile`

## Fantasia

O perfil é um **Salão de Comando**: patente, insígnia, campanhas e conquistas têm presença física. O objetivo é criar prestígio, não apenas exibir números.

## Escopo inicial

A página deve funcionar mesmo que parte do sistema de progressão ainda não exista. Dados não disponíveis aparecem como estados honestos/placeholder de produto, nunca estatísticas inventadas.

## Hierarquia

1. Insígnia de Comando
2. nome do jogador
3. patente/progresso, se suportado por dados reais
4. estatísticas reais disponíveis
5. histórico/campanhas, quando disponíveis
6. medalhas/conquistas, quando disponíveis

## Representação

Medalhas e placas podem ser objetos físicos na parede/sala, mas seus nomes e requisitos devem existir em HTML. Dourado aumenta com prestígio sem tornar toda a interface dourada.

## Estados

`guest`, `loading`, `loaded`, `empty-history`, `partial-data`, `error`, `reduced-motion`.

## Privacidade

Não expor identificadores internos, códigos de autenticação ou dados não destinados ao perfil público/privado da aplicação.

## Mobile

A parede física torna-se composição vertical: insígnia, patente e registros. Não preservar perspectiva 3D se ela reduzir legibilidade.

## Não fazer

- inventar ranking/patente sem modelo de dados;
- usar cards KPI de dashboard como composição principal;
- transformar medalhas em loot/cassino;
- carregar toda a história de partidas de uma vez sem necessidade;
- bloquear a página por ausência de assets 3D.

## Definition of Done

A página transmite progressão e autoridade usando apenas dados reais disponíveis, possui estados vazios dignos e passa `profile/EVAL.md`.
