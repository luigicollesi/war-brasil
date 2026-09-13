# SPEC — Home / Entrada no Comando

**Rota:** `/`  
**Cena:** `entrance`  
**Baseline final:** estado estável da Home em `dev`

Segue `../quality-standard.md`, `../visual-language.md`, `../opening-animation-standard.md` e os conceitos `CORE` aplicáveis em `../traceability.md`.

## Fantasia

A Home é uma **gênese cartográfica de comando**.

O jogador não assiste a um mapa chegar até a interface. Ele vê o **mesmo Brasil operacional já montado na Mesa**, inicialmente com as cores canônicas do mapa, ser absorvido/materializado pela linguagem militar da Foundation até se tornar exatamente a Home estável já aprovada em `dev`.

A transformação acontece **dentro do objeto**, não pela troca de tela, câmera ou geografia.

## Objetivos do usuário

O jogador MUST conseguir:

- reconhecer imediatamente o Brasil e WAR Brasil;
- perceber uma abertura clara e intencional, em vez de receber a Home já pronta;
- iniciar o caminho para uma partida;
- acessar Doutrina/Regras;
- acessar Perfil/Comando;
- pular a introdução;
- usar a página sem WebGL ou com motion reduzido.

## Invariantes visuais

Durante toda a Genesis normal, desde o primeiro frame em que o Brasil é visível até `settled`, os seguintes valores MUST permanecer equivalentes ao baseline final de `dev`:

- câmera/preset `table`;
- posição global do `BrazilTerritoryAssembly`;
- rotação global do `BrazilTerritoryAssembly`;
- escala global do `BrazilTerritoryAssembly`;
- geometria e fronteiras relativas dos 42 territórios;
- posição estrutural de `DomainTable`;
- composição final de `OrbitalCrown`, `StrategicGlobe` recuado e `CommandInsignia`.

A Genesis MUST NOT usar viagem lateral, zoom, spin, compressão do conjunto, troca de câmera ou remontagem do Brasil para produzir impacto.

O impacto visual MUST vir principalmente de **transformação de superfície/material, fronteiras, iluminação local e materialização coordenada da interface**.

## Primeiro frame correto

A rota MAY possuir um estado curto de `loading/priming` enquanto WebGL e shaders são preparados, mas MUST NOT exibir o mapa militar final e depois reiniciar a animação.

Quando o Brasil aparecer pela primeira vez em motion normal:

- MUST estar completo e reconhecível;
- MUST usar os fills canônicos de `/war-brasil-42.production.svg`;
- MUST já estar na mesma pose espacial do estado final;
- MUST possuir os mesmos 42 territórios;
- MUST ser o mesmo assembly/mesma geometria que continuará após a abertura;
- MUST começar antes de qualquer militarização perceptível.

A Foundation SHOULD pré-compilar o material/pass temporário antes de liberar esse frame. O início da timeline MUST ocorrer somente após um frame `primed` ter sido solicitado/renderizável conforme `../opening-animation-standard.md`.

## Arquitetura da transformação

A Genesis SHOULD usar o padrão:

```text
BrazilTerritoryAssembly
├── final surface/materials de dev          ← persistentes
└── HomeGenesisPass                         ← temporário
    ├── cores canônicas
    ├── dissolve/materialization field
    └── border/energy accents transitórios
```

A superfície final da Foundation MUST existir independentemente da Genesis.

O `HomeGenesisPass` MAY compartilhar a geometria canônica/final, mas MUST ser visualmente temporário e removível sem alterar o estado estável.

Aos `3000 ms`:

```text
HomeGenesisPass contribution = 0
```

Após cleanup:

```text
Home = baseline estável de dev
```

O resultado final MUST NOT depender de uma cópia de posição, rotação, escala, câmera ou materiais finais armazenada no código específico da Home.

## Timeline

Duração nominal: **3000 ms**.

A timeline MUST ser única, monotônica e normalizada (`0..1`) conforme `../opening-animation-standard.md`.

A Home MUST NOT coordenar a abertura por sequência de `setTimeout`.

### Cue windows de referência

As janelas abaixo são contrato de intenção e MAY receber pequenos ajustes de easing sem mudar a leitura geral:

| Track | Janela aproximada | Intenção |
| --- | ---: | --- |
| leitura canônica | `0.00–0.12` | Brasil claramente colorido antes da transformação |
| ativação territorial | `0.08–0.42` | fronteiras/acentos começam a capturar o mapa |
| materialização militar | `0.16–0.82` | cores canônicas cedem ao material final |
| atmosfera/Foundation | `0.28–0.88` | ambiente ganha presença sem trocar composição |
| identidade/chrome | `0.40–0.92` | interface institucional se materializa |
| CTA/telemetria/footer | `0.56–0.96` | ação principal se torna dominante |
| assentamento | `0.86–1.00` | últimos resíduos transitórios desaparecem |

Nenhum track deve causar pop-in no fim de sua janela.

## Materialização territorial

A transformação principal SHOULD ocorrer no GPU por uniforms/shader ou técnica equivalente de custo controlado.

### Campo de Genesis

O efeito deve parecer a superfície colorida sendo **capturada e convertida em material de comando**, não um filtro de fade uniforme.

SHOULD combinar:

- progresso global;
- coordenadas locais estáveis do mapa/território;
- offset espacial suave;
- seed determinístico derivado de `territoryId`;
- variação local de baixa amplitude;
- threshold suavizado para evitar serrilhado duro.

O padrão MAY propagar-se a partir da região central do mapa com leve viés direcional, desde que:

- não dependa de screen-space;
- não mude de desenho ao redimensionar;
- não destrua a leitura simultânea de vários territórios;
- não crie aparência de scanner sci-fi/ciano.

### Cores

No início, cada território usa a cor canônica extraída do SVG vigente.

Durante a Genesis, a camada colorida deve desaparecer de forma espacialmente estruturada, revelando os **materiais militares finais já pertencentes à Foundation**.

Preferir revelar a superfície final persistente em vez de recalcular por interpolação uma cópia aproximada do material de `dev`.

### Fronteiras

Fronteiras MUST permanecer espacialmente estáveis e legíveis.

MAY existir uma passagem transitória curta de latão/luz ao longo das fronteiras, com intensidade limitada e sem pulsação contínua. Ao final, a borda MUST ser exatamente a da Foundation.

### Profundidade

A Genesis MUST NOT separar placas nem alterar `position.z` dos territórios para simular fragmentação.

Sensação de profundidade MAY vir de:

- resposta de material;
- roughness/metalness transitórios na camada de abertura;
- iluminação/emissive local;
- noise/dissolve de superfície;
- normal/edge treatment que não mude a geometria lógica.

## Coreografia da interface

O mapa é o protagonista inicial. Identidade, chrome, atmosfera, CTA, telemetria e footer entram depois em janelas coordenadas.

MUST:

- usar as posições finais já existentes em `dev` como destino;
- evitar reflow animado quando `opacity`/`transform` resolvem;
- evitar que todos os elementos apareçam no mesmo frame;
- manter `ENTRAR NO COMANDO` como ação dominante quando sua janela estiver concluída;
- não esconder controles focáveis em `opacity: 0` sem ajustar sua disponibilidade interativa.

A coreografia DOM SHOULD usar Web Animations API ou CSS compositor-friendly e compartilhar o mesmo evento de início/duração da timeline principal.

## Lifecycle da Home

Abertura normal:

```text
loading → primed → playing → settling → settled
```

Estados funcionais posteriores:

```text
settled/awaiting-entry → command-open → destination-focus → transitioning
```

Atalhos:

```text
skip            → settled
reduced-motion  → settled
WebGL failure   → fallback funcional
```

React MAY refletir mudanças de lifecycle, mas MUST NOT receber `progress` por frame como estado.

## Navegação e interrupção

`ENTRAR NO COMANDO`, `OPERAÇÕES`, `DOUTRINA` e `COMANDO` continuam controles DOM acessíveis.

- `OPERAÇÕES` -> `/matchmaking`;
- `DOUTRINA` -> `/rules`;
- `COMANDO` -> `/profile`.

A abertura MUST NOT atrasar navegação funcional esperando os 3000 ms.

Se uma ação exigir sair da abertura, a implementação MUST finalizar/limpar a Genesis de forma segura e executar a ação imediatamente.

## Determinismo e eval

A Home MUST possuir mecanismo interno de `seek`/override para avaliação visual determinística nos progressos:

```text
0.00 / 0.15 / 0.35 / 0.60 / 0.85 / 1.00 / post-cleanup
```

O mecanismo não precisa ser API de usuário e não pode mudar o comportamento normal de produção.

Para o mesmo viewport, seed e progresso, a imagem MUST ser reproduzível.

## Performance

MUST:

- não usar `setState` dentro de `useFrame`;
- não criar dezenas de timers por território;
- não recriar geometria por frame;
- não criar renderer/Canvas adicional;
- não alocar ruído aleatório por frame;
- liberar materiais/texturas exclusivos da Genesis após cleanup;
- preservar recursos compartilhados da Foundation.

SHOULD:

- usar um/few uniforms globais para progresso;
- derivar seeds territorialmente sem estado React;
- prewarm shader/material da Genesis;
- reutilizar geometria da Foundation;
- manter cálculos por frame pequenos e refresh-rate independent.

## Reduced motion

Com `prefers-reduced-motion: reduce`, a Home SHOULD entrar diretamente em `settled`.

MUST NOT executar:

- dissolve espacial prolongado;
- grandes movimentos de escala/câmera;
- parallax;
- pulso repetitivo;
- animação necessária para compreender a UI.

Conteúdo, hierarquia, CTA e navegação permanecem equivalentes.

## Fallback sem WebGL

O fallback 2D existe como contingência funcional, não como ator da Genesis WebGL.

Quando WebGL falhar:

- conteúdo e navegação MUST permanecer disponíveis;
- não deve existir tela vazia/spinner infinito;
- não é necessário imitar a Genesis shader;
- a composição 2D SHOULD representar diretamente o estado estável.

Na execução WebGL normal, MUST NOT existir crossfade perceptível entre um Brasil 2D e o Brasil 3D para simular transformação.

## Desktop e mobile

Desktop e mobile usam a mesma lógica de Genesis e seeds.

Mobile MUST preservar o estado final mobile já existente em `dev` e MUST NOT ser apenas desktop escalado.

Resize/orientation change durante a abertura MUST NOT:

- reiniciar a timeline;
- trocar seeds;
- reposicionar o Brasil para uma pose intermediária;
- causar flash do estado final antes de retornar à Genesis.

## Não fazer

MUST NOT:

- substituir o estado final de `dev`;
- iniciar mostrando o mapa militar final e depois voltar ao mapa colorido;
- deslocar o Brasil lateralmente como gesto principal;
- animar escala/rotação/câmera do assembly durante a Genesis;
- usar dois mapas visíveis para simular continuidade;
- trocar asset colorido por asset verde;
- usar fade global como transformação principal;
- usar `Math.random()` para a aparência avaliada;
- coordenar tracks com cadeia de timeouts;
- manter lógica temporária da abertura como fonte do estado estável;
- adicionar biblioteca de animação apenas para esta timeline sem justificativa separada.

## Definition of Done

A Home abre com o Brasil canônico colorido já na pose operacional. O mesmo objeto é materializado territorialmente até revelar a Foundation militar final. Interface e atmosfera surgem em tracks coordenados. Aos 3000 ms o último frame coincide com o baseline de `dev`; após remover toda infraestrutura Genesis, nada muda visualmente. Skip, reduced-motion, fallback, resize e navegação permanecem funcionais, e todos os gates de `EVAL.md` passam.