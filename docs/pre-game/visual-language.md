# Visual Language — Guerra Cerimonial Brasileira

## North Star

O WAR Brasil deve parecer uma instituição de comando monumental, rica e tecnologicamente avançada. A tecnologia é pesada, física e durável; o luxo vem de materiais, iluminação e proporção, não de excesso decorativo.

## Semântica das cores

- **Verde militar profundo**: instituição, estrutura, superfície, estabilidade.
- **Carvão/preto**: massa, profundidade, metal e ambiente.
- **Dourado/latão**: autoridade, patente, decisão, comando e prestígio.
- **Vermelho sangue/vidro vermelho**: conflito, perigo e mobilização. Deve ser raro fora de estados de guerra.
- **Marfim quente**: texto principal e iluminação neutra.

Distribuição visual de referência: 70% carvão/verde, 15% marfim, 10% dourado, 5% vermelho.

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

Evitar: plástico brilhante, gradiente neon genérico, vidro SaaS, holograma azul/ciano, hexágonos decorativos repetidos, glow indiscriminado.

## Objetos de assinatura

### Mesa de Domínio

Estrutura circular monumental que contém ou projeta o Brasil. É o centro espacial do pré-jogo.

### Brasil de 42 placas

Os 42 territórios devem poder ser percebidos como peças físicas encaixadas. Em repouso formam unidade; ao entrar em operações, podem separar-se levemente e revelar linhas de conflito.

### Coroa Orbital

Três aros inspirados em uma esfera armilar: Território, Comando e Conflito. Movimento lento em repouso; alinhamento é usado como momento cerimonial de autorização.

### Insígnia de Comando

Identidade gráfica do jogador. Reaparece em lobby, perfil, ranking e estados de prontidão.

## Tipografia

- títulos/ordens: família condensada, severa e legível;
- corpo/UI: sans de alta legibilidade;
- telemetria/códigos: mono.

Não usar fonte futurista como substituto de design. Caixa alta deve ser usada com hierarquia e espaçamento apropriados.

## Motion

Três velocidades semânticas:

- **ambiente**: 8–30 s; quase imperceptível;
- **interface**: 120–320 ms;
- **cerimônia/câmera**: 350–900 ms.

Movimento deve comunicar causa. Não animar elementos apenas para manter a tela ocupada.

`prefers-reduced-motion: reduce` remove movimentos de câmera, parallax, loops não essenciais e transições espaciais; conteúdo e ações permanecem equivalentes.

## Som

Som é camada futura/optativa. A interface nunca depende dele. Direção: cliques metálicos, relés, mecanismos, hum baixo, impacto grave e sinais curtos. Sem bipes sci-fi constantes.

## Regras negativas

A implementação falha a identidade se:

- parecer dashboard SaaS;
- parecer menu de streaming com cards;
- depender de ciano/neon para parecer futurista;
- usar símbolos visuais tradicionais de WAR como linguagem principal;
- colocar armas/soldados/explosões como atalho para comunicar guerra;
- usar dourado em todas as ações;
- manter vermelho constante sem estado de conflito;
- sacrificar legibilidade por textura, brilho ou transparência.
