# Visual Language — Guerra Cerimonial Brasileira

## North Star

O WAR Brasil MUST parecer uma instituição de comando monumental, brasileira e tecnologicamente avançada. A tecnologia é pesada, física e durável; o luxo vem de materiais, iluminação, proporção e ritual, não de excesso decorativo.

A experiência deve comunicar **autoridade sobre território** antes de comunicar “interface”.

## Semântica das cores

- **Verde militar profundo**: instituição, estrutura, superfície, estabilidade.
- **Carvão/preto**: massa, profundidade, metal e ambiente.
- **Dourado/latão**: autoridade, patente, decisão, comando e prestígio.
- **Vermelho sangue/vidro vermelho**: conflito, perigo e mobilização; MUST ser raro fora de estados de guerra.
- **Marfim quente**: texto principal e iluminação neutra.

Distribuição visual de referência, não quota matemática: aproximadamente 70% carvão/verde, 15% marfim, 10% dourado e 5% vermelho.

Tokens iniciais de direção, não valores finais obrigatórios:

```css
--command-void: #070a08;
--command-green-950: #111b14;
--command-green-800: #223026;
--command-brass-700: #8f6e32;
--command-brass-400: #d0aa57;
--command-blood-700: #7f191e;
--command-blood-500: #a4262c;
--command-ivory: #eee8da;
```

## Materiais

Preferir: aço negro, metal oxidado, latão escovado, vidro vermelho iluminado internamente, tecido/canvas verde militar, concreto escuro, lentes e projeção óptica.

Evitar: plástico brilhante, gradiente neon genérico, vidro SaaS, holograma azul/ciano, hexágonos decorativos repetidos, glow indiscriminado e textura aplicada apenas para “parecer jogo”.

Materiais SHOULD responder à luz de forma legível e contida. Reflexo não pode competir com texto ou fronteiras territoriais.

## Objetos de assinatura

### Terra / Globo Estratégico

A Terra representa escala antes do comando. Na entrada, MAY aparecer como estágio inicial do ritual `Terra -> Brasil -> Mesa`, mas MUST NOT virar o protagonista permanente nem um globo sci-fi genérico.

### Mesa de Domínio

Estrutura circular monumental que contém, sustenta ou projeta o Brasil. É o centro espacial do pré-jogo e muda de função por contexto: símbolo na entrada, máquina em Operações, mesa de briefing no Lobby e instrumento didático em Doutrina.

### Brasil de 42 placas

O Brasil MUST ser reconhecível como a mesma geografia territorial do jogo: 42 territórios canônicos, fronteiras preservadas e leitura clara.

Direção visual:

- face superior 2.5D perceptível;
- placas físicas encaixadas em repouso;
- bordas/fronteiras muito visíveis;
- separação leve somente quando o estado semântico pede conflito/operação;
- nenhuma deformação, redistribuição ou “explosão” que destrua a leitura do Brasil;
- profundidade, chanfrado, sombra e lateralidade podem preencher visualmente pequenos vãos sem alterar a geometria lógica;
- a hit-area lógica/semântica MAY permanecer baseada na geometria canônica mesmo quando a face visual recebe inset, extrusão ou bevel.

A apresentação pré-jogo MUST NOT substituir nem redefinir o asset lógico usado pelo tabuleiro. Quando reutilizar geometria, identidade territorial e fronteiras continuam fonte de verdade.

### Coroa Orbital

Três aros inspirados em esfera armilar: **Território**, **Comando** e **Conflito**.

- em repouso: movimento lento, quase arquitetônico;
- em foco: pequenas correções de alinhamento;
- em autorização: alinhamento claro e breve;
- MUST NOT parecer HUD de nave espacial ou loading spinner.

### Insígnia de Comando

Identidade gráfica do jogador. Reaparece em Lobby, Perfil, estados de prontidão e futuras superfícies de progressão. SHOULD funcionar em escalas pequenas e sem depender de uma única cor.

## Tipografia

- títulos/ordens: família condensada, severa e legível;
- corpo/UI: sans de alta legibilidade;
- telemetria/códigos: mono.

Não usar fonte futurista como substituto de design. Caixa alta deve ter hierarquia, tracking e tamanho adequados; corpo extenso em caixa alta é desencorajado.

## Hierarquia espacial

A cena deve ter três planos legíveis:

1. ambiente/arquitetura;
2. objeto de comando em foco;
3. UI textual/interativa.

A UI MUST permanecer legível mesmo se a cena estiver mais clara, escura ou desfocada. Nenhum CTA crítico pode existir apenas “dentro” de geometria 3D.

## Motion

Três velocidades semânticas:

- **ambiente**: 8–30 s; quase imperceptível;
- **interface**: 120–320 ms;
- **cerimônia/câmera**: 350–900 ms.

Movimento MUST comunicar causa: entrada, seleção, foco, prontidão, autorização ou transição. Não animar elementos apenas para manter a tela ocupada.

Microinterações SHOULD ser mecânicas: encaixe, trava, giro curto, alinhamento, pressão, abertura, leitura de relé. Evitar bounce/cartoon, elasticidade exagerada e partículas constantes.

`prefers-reduced-motion: reduce` MUST remover movimentos de câmera, parallax, loops não essenciais e transições espaciais sem remover conteúdo, estado ou ação.

Nenhum efeito deve piscar/pulsar de forma agressiva. Vermelho pode intensificar conflito, mas não deve operar como estrobo.

## Transições entre áreas

As transições SHOULD preservar continuidade espacial: a mesma sala, mesa e Brasil mudam de função em vez de parecer que uma página totalmente nova foi carregada.

A continuidade visual MUST NOT bloquear navegação, criar atraso artificial ou exigir que o renderer permaneça disponível para completar a rota.

## Som

Som é camada futura/optativa. A interface MUST funcionar integralmente mutada.

Direção: cliques metálicos, relés, mecanismos, hum baixo, impacto grave e sinais curtos. Sem bipes sci-fi constantes, locução obrigatória ou som contínuo cansativo.

## Regras negativas

A implementação falha a identidade se:

- parecer dashboard SaaS;
- parecer menu de streaming com cards;
- depender de ciano/neon para parecer futurista;
- usar símbolos visuais tradicionais de WAR como linguagem principal;
- colocar armas, soldados ou explosões como atalho para comunicar guerra;
- usar dourado em todas as ações;
- manter vermelho constante sem estado de conflito;
- sacrificar legibilidade por textura, brilho, transparência ou profundidade;
- deformar/espalhar o Brasil a ponto de perder geografia e fronteiras;
- usar o 3D como justificativa para esconder informação funcional.
