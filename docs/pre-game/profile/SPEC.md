# SPEC — Perfil / Quartel do Comandante

**Rota:** `/profile`  
**Cena:** `profile`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

O perfil é o **Quartel do Comandante**: um espaço pessoal militar onde identidade, economia, rede social, memória de partidas e personalização coexistem ao redor de uma Mesa de Comando. A tela MUST parecer uma área viva do jogo, não uma dashboard web com tema militar.

As áreas do produto são tratadas como estações do Quartel:

- **Dossiê do Comandante** — retrato/ícone, nome, título cosmético e presença;
- **Tesouraria** — duas moedas de valor distinto;
- **Rede de Comando** — amigos, solicitações, busca e contatos recentes;
- **Livro de Campanha** — partidas recentes e acesso progressivo ao histórico;
- **Intendência** — vitrine de itens cosméticos/personalização;
- **Mesa de Comando** — eixo visual que reage à estação ativa e conecta a PROFILE à Foundation.

## Princípio de integridade

Todo dado exibido MUST ter origem identificável. Estruturas ainda sem backend MAY usar dados locais temporários somente quando estiverem explicitamente classificados como `local-static` ou `evaluation-fixture` no contrato.

A UI MUST NOT transformar ausência de fonte em dado competitivo real. Não inventar como se fossem dados persistidos:

- ranking, patente, nível ou taxa de vitória;
- saldo remoto;
- amizade persistida;
- histórico real do usuário;
- compra concluída;
- inventário possuído;
- disponibilidade comercial remota.

## Hierarquia principal

1. identidade do jogador;
2. Tesouraria;
3. estação ativa;
4. Rede de Comando;
5. Livro de Campanha;
6. Intendência;
7. Mesa de Comando/Foundation como cenário e resposta visual.

A cena nunca pode competir com a legibilidade desses conteúdos.

## Dossiê do Comandante

MUST reservar espaço para:

- imagem/retrato/ícone do jogador;
- fallback textual/monograma quando não houver imagem;
- nome público;
- título cosmético opcional;
- presença (`online`, `in-lobby`, `in-match`, `offline`) quando houver fonte.

Título cosmético MUST permanecer semanticamente separado de patente/rank competitivo.

## Tesouraria

MUST comportar duas moedas distintas:

- moeda comum;
- moeda premium/mais valiosa.

As duas moedas MUST ser distinguíveis por pelo menos três sinais: símbolo/forma, label textual e tratamento visual. Cor isolada não é suficiente.

Saldo indisponível MUST aparecer como indisponível; zero só pode ser exibido quando zero for o valor real da fonte.

## Rede de Comando

MUST prever:

- lista limitada de amigos;
- estado de presença;
- solicitações recebidas quando suportadas;
- busca de novos jogadores;
- contatos/jogadores recentes quando suportados;
- estados vazio, indisponível e erro.

Busca de jogadores SHOULD ser sob demanda e MUST NOT exigir carregar o diretório inteiro na PROFILE.

Ações futuras (`adicionar`, `aceitar`, `remover`, `bloquear`, `convidar`) MUST passar por uma boundary de serviço; componentes visuais não persistem relações diretamente.

## Livro de Campanha

A página inicial exibe somente uma janela de partidas recentes. O contrato MUST manter continuação explícita (`hasMore`, cursor ou equivalente) e MUST NOT carregar histórico ilimitado.

Cada resumo de operação MAY conter, quando houver fonte:

- código/nome da operação;
- data;
- resultado;
- modo;
- duração;
- participantes resumidos.

Detalhes extensos pertencem ao Dossiê da Operação, não à lista principal.

## Intendência

A PROFILE contém uma **vitrine**, não a loja completa.

MUST prever itens de personalização como:

- retratos/ícones;
- molduras;
- títulos;
- insígnias;
- coleções futuras.

Cada item deve identificar preço e moeda quando houver fonte. Nesta etapa, nenhuma ação pode simular compra persistida. Se checkout/inventário não existirem, usar ação neutra como `Ver item`.

## Mesa de Comando e Foundation

A PROFILE consome somente a API pública semântica da Foundation. MUST NOT importar `three`, `@react-three/fiber`, `Canvas`, câmera ou renderer.

A estação ativa MAY alterar somente intenção semântica, como `focus`, `territoryExplode` e `orbitalAlignment`.

A Mesa de Comando em HTML/SVG MUST permanecer funcional e legível mesmo quando WebGL estiver indisponível.

## Desktop

Alvo principal: `1440x900`.

A composição SHOULD caber em `100dvh` sem exigir scroll global para o uso principal. Conteúdo volumoso deve rolar dentro da estação ativa.

O layout desktop SHOULD ser assimétrico e espacial; MUST NOT degenerar em grade uniforme de cards KPI.

## Mobile

Alvo principal: `390x844` com touch.

No mobile, o Quartel torna-se **Terminal de Campo**:

- identidade e carteira permanecem imediatamente legíveis;
- somente uma estação principal fica expandida por vez;
- navegação entre sistemas usa controles touch claros;
- nenhuma função depende de hover ou perspectiva;
- scroll interno/global deve ser previsível e sem overflow horizontal.

## Estados mínimos

- `guest`;
- `loading`;
- `loaded`;
- `partial-data`;
- `empty-history`;
- `empty-social`;
- `error`;
- `reduced-motion`;
- `scene-fallback`.

## Privacidade

MUST NOT expor:

- IDs internos sem função pública;
- tokens/códigos de autenticação;
- payload bruto de backend;
- dados privados de outros jogadores;
- presença ou histórico não destinados ao perfil público.

## Acessibilidade

- nome, título, moedas, presença e preços possuem equivalente textual;
- moedas não dependem apenas de cor;
- foco é visível;
- controles touch têm área adequada;
- reduced-motion preserva mudança de contexto sem motion ornamental;
- objetos decorativos ficam fora da árvore acessível;
- fallback 2D mantém todas as estações operáveis.

## Não fazer

MUST NOT:

- usar tabs genéricas como linguagem visual principal no desktop;
- transformar todas as estações em cards iguais;
- duplicar renderer/câmera da Foundation;
- carregar todos os usuários para busca social;
- carregar histórico ilimitado;
- simular compra concluída;
- usar saldo fictício indistinguível de saldo real;
- criar autenticação, banco social ou checkout como efeito colateral do redesign;
- bloquear a PROFILE se WebGL falhar.

## Definition of Done

A PROFILE representa um Quartel pessoal coerente em desktop e mobile, contém Dossiê, Tesouraria, Rede de Comando, Livro de Campanha e Intendência, usa somente contratos de dados auditáveis, permanece funcional sem WebGL e passa `EVAL.md` integralmente.