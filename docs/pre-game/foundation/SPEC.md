# SPEC — Pre-game Foundation

**ID:** PRE-FOUNDATION  
**Owner:** trilha `foundation`  
**Escopo:** infraestrutura compartilhada do pré-jogo; nenhuma regra de jogo.

Este documento usa a linguagem normativa definida em `../quality-standard.md`.

## Objetivo

Criar a base que faz todas as páginas parecerem partes da mesma instalação de comando, preservando continuidade espacial, identidade territorial e isolamento entre estado visual e estado de negócio.

A Foundation MUST permitir desenvolvimento das páginas sem que cada trilha recrie renderer, câmera, mapa, tokens ou lógica de transição.

## Entregáveis

1. `CommandShell`: casca semântica/responsiva do pré-jogo.
2. `CommandScene`: host 3D compartilhado com fallback 2D.
3. `CameraDirector`: traduz intenção semântica em câmera/transição.
4. `StrategicGlobe`: Terra/Globo usado no ritual de entrada quando aplicável.
5. `DomainTable`: Mesa de Domínio.
6. `BrazilTerritoryAssembly`: apresentação física dos 42 territórios.
7. `OrbitalCrown`: três aros — Território, Comando e Conflito.
8. primitives 2D: tipografia, command labels, divisores, status, painéis mínimos e insígnias.
9. tokens: cor, spacing, depth, material, motion, blur e z-index.
10. contrato público de `CommandSceneIntent` ou equivalente.

Nomes podem mudar durante implementação; responsabilidades não.

## Arquitetura

### Separação de estado

Estado visual MUST permanecer separado de estado de negócio.

Hover, foco, câmera, luz, orbital alignment, explode visual e efeitos MUST NOT:

- provocar refetch de dados de negócio;
- recriar lobby/matchmaking;
- alterar ready, membro, código ou estado da partida;
- tornar-se fonte de verdade paralela.

### Server/Client boundary

SHOULD manter conteúdo/casca estática em Server Components quando apropriado e isolar interações/renderer em Client Components pequenos. A cena MAY ser lazy-loaded. Conteúdo e ação crítica MUST NOT aguardar WebGL.

### Renderer único

Dentro da experiência pré-jogo, SHOULD existir um único host persistente de cena. Troca de modo MUST preferir atualização declarativa do mesmo ambiente a desmontar/recriar Canvas.

Se a arquitetura de rotas tornar persistência literal inviável, a implementação MUST preservar continuidade visual e evitar múltiplos renderers simultâneos, flashes ou remounts que afetem estado funcional.

## Contrato de cena

A API pública expressa **significado**, não implementação.

Estados mínimos:

- `entrance`
- `operations`
- `lobby`
- `doctrine`
- `profile`

Focos mínimos previstos:

- `earth`
- `brazil`
- `table`
- `insignia`
- `none`

O CameraDirector é o único responsável por traduzir intenção em posições de câmera e SHOULD centralizar também a coordenação de luz, vermelho de conflito e movimento dos aros.

Páginas MUST NOT enviar XYZ, quaternion, FOV ou parâmetros de material como parte do contrato normal.

## Contrato do Brasil de 42 territórios

Esta é uma restrição estrutural, não apenas estética.

A representação MUST:

- conter exatamente os 42 territórios do mapa vigente;
- preservar identidade, geometria relativa e fronteiras canônicas;
- preservar a leitura geral do Brasil e a ordem/associação territorial necessária à camada semântica;
- manter fronteiras visualmente legíveis;
- permitir 2.5D perceptível sem deformar ou espalhar o conjunto;
- separar apresentação visual e hit-area lógica quando inset/extrusão/bevel reduzirem a área interativa;
- evitar microterritórios visualmente impossíveis de selecionar quando houver interação.

A representação MAY usar face inset, corpo quase canônico, extrusão, bevel, profundidade e lateralidade para criar separação física. Essas transformações MUST NOT redefinir fronteiras ou conexões do jogo.

Quando reutilizar a geometria do mapa interativo existente, a geometria canônica SHOULD continuar disponível como camada lógica/hit-map para teclado, touch e pointer.

A ordem/identidade territorial MUST permanecer estável entre estados visuais. Um território não pode trocar de identidade, índice semântico ou vizinhança porque a apresentação mudou.

Se zoom ou aproximação de câmera alterar a escala aparente do mapa, a implementação SHOULD compensar stroke/borda quando necessário para que fronteiras continuem perceptíveis. Zoom não pode transformar a leitura territorial em manchas sem separação.

Gestos touch MUST distinguir intenção de pan/scroll/zoom de seleção quando houver interação territorial. Movimento do dedo não deve disparar seleção acidental como efeito colateral.

## Objetos de assinatura

### StrategicGlobe

Serve à escala inicial `Terra -> Brasil`. MUST poder desaparecer/recuar após cumprir seu papel. Não é requisito funcional de navegação.

### DomainTable

É o eixo espacial. A mesma Mesa SHOULD mudar de função entre modos em vez de ser trocada por cenários desconectados.

### OrbitalCrown

Três aros independentes semanticamente: Território, Comando e Conflito. Movimento idle é lento; alinhamento é reservado a foco/autorização.

### Insignia

Primitive compartilhada para identidade/estado do jogador em Lobby e Perfil. MUST continuar legível sem animação e sem uma única cor como único sinal.

## Lifecycle e transições

Transições SHOULD manter a sensação de uma única instalação.

MUST:

- não bloquear redirect funcional por animação;
- não produzir flash branco/preto não intencional;
- não desmontar conteúdo enquanto a câmera termina movimento;
- permitir skip/reduced-motion quando a transição for ornamental;
- ter estado final determinístico para visual regression.

## Performance

MUST:

- não bloquear conteúdo por carregamento 3D;
- possuir fallback quando WebGL falhar;
- não criar renderer concorrente por página.

SHOULD:

- limitar/adaptar DPR;
- reutilizar geometries/materials/objects estáveis;
- reduzir loops ambientais ou renderizar sob demanda quando a cena estiver estática;
- evitar sombras dinâmicas caras como requisito visual;
- lazy-load código/asset pesado quando isso não prejudicar continuidade;
- degradar efeitos antes de degradar legibilidade/interação.

Não fixar metas artificiais de FPS/bundle sem baseline medida; seguir `quality-standard.md`.

## Responsividade

Mobile não é desktop comprimido.

MUST:

- manter ação primária em região touch acessível;
- não depender de hover;
- não forçar a perspectiva 3D quando ela prejudicar conteúdo;
- preservar mapa/objeto como atmosfera/foco sem sobrepor texto funcional;
- evitar seleção territorial acidental durante gesto de navegação/scroll quando territórios forem interativos.

SHOULD usar layout fluido/mobile-first antes de hardcode por aparelho.

## Acessibilidade

MUST:

- manter contraste do texto independente da luz 3D;
- manter foco visível;
- retirar decoração 3D da árvore de acessibilidade quando ela não tiver função;
- oferecer equivalente DOM para informação funcional mostrada na cena;
- respeitar `prefers-reduced-motion`;
- não depender apenas de cor, som, hover ou movimento;
- evitar efeitos de flash/pulsação agressivos.

Quando territórios forem interativos fora do jogo, identidade/foco SHOULD ser operáveis por teclado e pointer/touch de forma coerente.

## Fallback 2D

Sem WebGL, a experiência MUST continuar com:

- identidade cromática/material reconhecível;
- conteúdo completo;
- navegação completa;
- estados funcionais completos;
- composição estável, nunca tela vazia ou spinner infinito.

O fallback não precisa simular 3D; precisa preservar significado e hierarquia.

## Não fazer

MUST NOT:

- construir motor genérico de cenas sem necessidade;
- transformar o shell em design system de toda a aplicação;
- duplicar cena por página;
- acoplar Three.js a APIs de matchmaking/realtime;
- substituir o mapa lógico do jogo pelo asset cenográfico;
- criar uma segunda geometria territorial incompatível;
- espalhar/deformar territórios apenas para “parecer 3D”;
- usar animação como requisito para compreender estado.

## Definition of Done

Contrato público estável, todos os modos renderizáveis isoladamente, Brasil de 42 territórios validado, fallback funcional e todos os gates de `EVAL.md` aprovados conforme `quality-standard.md`.
