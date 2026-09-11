# SPEC — Perfil / Salão de Comando

**Rota:** `/profile`  
**Cena:** `profile`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

O perfil é um **Salão de Comando**: identidade, patente/progresso quando existirem, campanhas e conquistas ganham presença física. O objetivo é criar prestígio e memória, não um dashboard de KPIs.

## Princípio de integridade

A página MUST funcionar mesmo que parte do sistema de progressão ainda não exista.

Dados indisponíveis MUST aparecer como ausência/estado futuro claramente identificado. MUST NOT inventar:

- patente;
- ranking;
- nível;
- taxa de vitória;
- histórico;
- medalha/conquista;
- posição global;
- qualquer estatística sem fonte real.

A estética nunca justifica dado falso.

## Fonte de verdade

Cada informação exibida SHOULD ter origem identificável em contrato existente de perfil, autenticação ou dados de partida.

Quando a fonte ainda não existir, a interface MAY mostrar estrutura vazia/indisponível, mas não valor simulado indistinguível de dado real.

## Hierarquia

1. Insígnia de Comando;
2. nome/identidade pública adequada do jogador;
3. patente/progresso, somente quando suportado;
4. estatísticas reais disponíveis;
5. campanhas/histórico, quando disponíveis;
6. medalhas/conquistas, quando disponíveis.

A ausência de itens 3–6 não pode quebrar composição nem rebaixar o perfil a tela de erro.

## Insígnia de Comando

É o objeto central da identidade do jogador e SHOULD reutilizar a primitive compartilhada da Foundation.

Pode ganhar profundidade, metal, gravação e sinais de patente quando esses estados forem reais. MUST permanecer reconhecível em 2D, mobile e reduced-motion.

## Salão físico

Medalhas, placas e registros MAY aparecer como objetos físicos na sala, mas nomes, descrição/requisito e estado devem existir em HTML.

Dourado SHOULD crescer com autoridade/prestígio real sem transformar toda a página em superfície dourada. Vermelho não é cor padrão do perfil; permanece reservado a conflito/alerta.

## Estados

- `guest`
- `loading`
- `loaded`
- `empty-history`
- `partial-data`
- `no-progression-system`
- `error`
- `reduced-motion`
- `scene-fallback`

Todos os estados MUST ter significado textual claro.

## Visitante/autenticação

Se `/profile` puder ser acessado sem identidade autenticada, `guest` MUST explicar o estado e oferecer somente ações realmente disponíveis. O redesign MUST NOT inventar fluxo de autenticação novo.

Se autenticação já for exigida pelo produto, preservar o contrato existente.

## Privacidade

MUST NOT expor:

- IDs internos sem função de produto;
- tokens/códigos de autenticação;
- dados privados de outras pessoas;
- informações de partida não destinadas ao perfil;
- payload bruto de backend.

Qualquer futura distinção entre perfil público/privado exige contrato próprio.

## Histórico e volume de dados

Se houver muitas partidas/campanhas, SHOULD usar paginação, janela ou carregamento progressivo coerente com o backend. MUST NOT carregar toda a história apenas para preencher o cenário.

Estado vazio deve parecer parte digna do Salão de Comando, não falha.

## Mobile

A parede/sala física torna-se composição vertical:

- Insígnia;
- identidade/patente real;
- registros;
- medalhas/conquistas.

MUST priorizar leitura e touch. A perspectiva 3D MAY ser reduzida/removida se competir com o conteúdo.

## Acessibilidade

- valores e labels existem em texto;
- medalhas não dependem apenas de ícone/cor;
- foco é visível;
- reduced-motion preserva hierarquia;
- objetos puramente decorativos ficam fora da árvore acessível.

## Não fazer

MUST NOT:

- inventar ranking/patente/estatística;
- usar cards KPI como composição principal;
- tratar medalhas como loot/cassino;
- carregar histórico ilimitado sem necessidade;
- bloquear página por ausência de 3D;
- exibir placeholder numérico que pareça dado real;
- criar autenticação/progressão como efeito colateral deste redesign.

## Definition of Done

A página transmite identidade, progressão e autoridade usando somente dados reais disponíveis, possui estados vazios/parciais honestos, respeita privacidade e passa `EVAL.md` integralmente.
