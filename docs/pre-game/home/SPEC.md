# SPEC — Home / Entrada no Comando

**Rotas:** `/` (landing pública) e `/home` (comando autenticado)  
**Cena:** `entrance` compartilhada  
**Baseline final:** estado estável da Home em `dev`

Segue `../quality-standard.md`, `../visual-language.md`, `../opening-animation-standard.md` e os conceitos `CORE` aplicáveis em `../traceability.md`.

A rota `/` é exclusivamente a porta de entrada: executa a cerimônia e oferece `ENTRAR NO COMANDO`. Após uma sessão válida, a navegação segue para `/home`. A rota `/home` reutiliza a mesma composição e a mesma Foundation, porém inicia estabilizada e expõe diretamente o estado autenticado ou o onboarding necessário; não repete a Genesis.

## Fantasia

A Home é uma **gênese cartográfica de comando** em quatro movimentos contínuos:

1. os territórios canônicos convergem de fora do enquadramento e montam o Brasil de dentro para fora;
2. com o Brasil montado, a Genesis material converte as cores canônicas na superfície militar enquanto o anel dourado é invocado e completa uma volta;
3. logo após o clímax da Genesis, o **Profile Orb** translúcido é ativado e seus anéis orbitais assentam junto das últimas animações de identidade e comando;
4. a cena desacelera numa única continuidade até revelar exatamente o estado estável final.

Não existe troca entre dois mapas nem reconstrução aproximada do estado final. A Foundation final continua sendo a fonte da verdade.

## Objetivos do usuário

O jogador MUST conseguir:

- reconhecer claramente que os elementos convergentes formam o Brasil;
- perceber ordem espacial: regiões próximas ao centro entram antes e periferia depois;
- perceber Genesis material e anel dourado como um único acontecimento;
- perceber o Profile Orb como a assinatura de identidade/comando da cena;
- iniciar o caminho para uma partida;
- acessar Doutrina/Regras e Perfil/Comando;
- pular a introdução;
- usar a página sem WebGL ou com motion reduzido.

## Invariantes estruturais

Durante toda a abertura normal:

- câmera/preset `table` MUST permanecer equivalente ao baseline final;
- posição, rotação e escala globais de `BrazilTerritoryAssembly` MUST permanecer equivalentes ao baseline final;
- `DomainTable`, `OrbitalCrown`, `StrategicGlobe` recuado e `CommandInsignia`/`ProfileOrbAssembly` MUST continuar pertencendo à Foundation;
- os 42 territórios MUST continuar derivados de `/war-brasil-42.production.svg`;
- shapes pertencentes ao mesmo `territoryId` MUST compartilhar o mesmo descritor de ingresso;
- somente a camada canônica transitória MAY receber transform local de entrada;
- a superfície final militar persistente MUST permanecer propriedade da Foundation.

A abertura MUST NOT mover o assembly pai, trocar câmera ou criar um segundo mapa lógico.

## Primeiro frame correto

A rota MAY possuir `loading/priming` enquanto WebGL e shaders são preparados.

No primeiro frame pintável com motion normal:

- a superfície militar final MUST NOT piscar;
- os territórios canônicos MUST estar preparados em posições de origem fora do enquadramento operacional;
- os fills MUST ser os do SVG canônico;
- o `BrazilTerritoryAssembly` pai já MUST estar em sua pose final;
- o anel dourado permanente de `DomainTable` MUST **já nascer com opacidade zero**, sem um frame anterior visível;
- o Profile Orb MUST começar fora de leitura visual e não pode piscar antes de seu cue;
- nenhum progresso temporal deve ser consumido antes de `primed`.

A correção de first-paint MUST existir no próprio estado inicial renderizado. Não é suficiente mostrar o anel e zerar sua opacidade posteriormente por effect.

## Arquitetura

```text
BrazilTerritoryAssembly              ← pose global permanente
├── FinalTerritorySurface            ← superfície militar persistente
├── FinalTerritoryEdges              ← bordas finais persistentes
└── HomeGenesisPass                  ← temporário
    ├── CanonicalTerritorySurface    ← mesmo geometry, transform local de ingresso
    └── GenesisRingSweep             ← arcos transitórios assimétricos

DomainTable
└── FinalGoldenRing                  ← persistente, nasce opacity 0 e é revelado na Genesis

CommandInsignia
└── ProfileOrbAssembly               ← persistente
    ├── ProfileOrb-Core              ← esfera translúcida
    ├── ProfileOrb-OrbitA            ← órbita inclinada
    ├── ProfileOrb-OrbitB            ← órbita inclinada
    ├── ProfileOrb-OrbitC            ← órbita inclinada
    └── ProfileOrb-Glyph             ← marca central
```

A camada final do mapa MAY ficar temporariamente invisível enquanto os territórios convergem, mas MUST ser restaurada como superfície subjacente quando a Genesis material começar.

No cleanup:

```text
HomeGenesisPass = removido
FinalTerritorySurface = baseline estável
FinalTerritoryEdges = baseline estável
FinalGoldenRing = baseline estável
ProfileOrbAssembly = estado final persistente
```

Remover a Genesis MUST NOT causar salto visual.

## Timeline única

Duração nominal: **3000 ms**.

Todo efeito MUST derivar de uma única timeline monotônica normalizada `0..1`. A Home MUST NOT usar cadeias de `setTimeout` para sincronizar tracks.

### Cue windows normativas

| Track | Janela | Intenção |
| --- | ---: | --- |
| `territoryIngress` | `0.00–0.44` | convergência radial center-out dos territórios |
| `genesis` | `0.44–0.82` | materialização + bordas + anel dourado + sweep 360° |
| `atmosphere` | `0.30–0.94` | presença gradual do ambiente |
| `identity` | `0.72–0.98` | identidade/chrome entram após o clímax do mapa |
| `profileActivation` | `0.80–0.99` | Profile Orb surge e suas órbitas assentam |
| `primaryAction` | `0.80–0.99` | CTA/dock chegam ao estado final junto do Profile Orb |
| `settling` | `0.88–1.00` | fase semântica; não inicia novo easing |

O pequeno overlap entre `genesis` e `profileActivation` MAY existir para evitar um corte perceptível, mas a leitura dominante do Profile Orb deve ocorrer somente no final da Genesis.

`settling` MUST NOT reiniciar posição, rotação, escala, opacidade ou qualquer propriedade já em movimento.

## Ingresso radial dos territórios

### Unidade lógica e ordem center-out

A unidade de coreografia é `territoryId`, não `ExtrudeGeometry` individual. Se um território gerar múltiplas shapes, todas MUST compartilhar `radialRank`, spawn, início, fim e curva de progresso.

Para cada território:

```text
radialDistance = distance(territoryCentroid, brazilCentroid)
radialRank = radialDistance / maxTerritoryDistance
```

A ordem MUST ser monotônica em relação a `radialRank`: centro primeiro, periferia depois. MUST NOT depender da ordem dos paths, `Math.random()`, timers individuais ou batches discretos.

### Onda contínua e movimento único

O stagger deve formar uma onda sobreposta. Uma transformação como `pow(radialRank, 1.35)` MAY concentrar mais cedo a região central sem quebrar a ordem radial.

Cada território MUST possuir uma única curva espacial:

```text
spawn ─────────────────────────────→ final
```

MUST NOT existir `ingress → stop → assembly-lock → novo impulso`. A progressão SHOULD usar smootherstep/quintic ou equivalente.

O spawn MUST ficar suficientemente distante para começar fora do enquadramento operacional. Um `zLift` determinístico MAY criar profundidade, desde que termine exatamente em zero.

## Genesis material

A Genesis só domina visualmente quando a onda de montagem chega ao Brasil completo.

O efeito SHOULD ocorrer no GPU e MUST combinar:

- um único `genesisProgress`;
- coordenadas locais estáveis;
- seed determinístico por `territoryId`;
- campo espacial de baixa frequência;
- threshold suavizado.

A camada canônica desaparece espacialmente e revela a superfície militar final persistente. MUST NOT ser apenas fade global, desaturação ou troca de asset.

## Anel dourado sincronizado

A invocação do anel dourado MUST usar o **mesmo `genesisProgress`** da transformação material.

### First paint

Durante uma abertura normal, `FinalGoldenRing` MUST ser criado inicialmente em `opacity = 0`. A implementação MUST NOT depender de um effect posterior para corrigir sua primeira pintura.

### Durante Genesis

- o anel permanente progride de zero para sua opacidade final;
- sua rotação completa uma volta de `2π` durante a mesma janela;
- `GenesisRingSweep` SHOULD tornar o giro perceptível por segmentos/lacunas assimétricos;
- o sweep MUST desaparecer até o final da janela;
- o anel permanente MUST terminar no estado material final da Foundation.

Um círculo perfeitamente uniforme não é evidência visual suficiente de rotação; o sweep fornece assimetria legível.

## Profile Orb

### Forma principal

O símbolo de perfil/comando MUST ser percebido principalmente como uma **esfera translúcida**, e não como um conjunto de aros opacos.

A esfera SHOULD usar material fisicamente coerente para translucidez. No stack WebGL atual, `MeshPhysicalMaterial` com `transmission`/`thickness` é preferível a simplesmente reduzir muito `opacity` da superfície principal.

O núcleo SHOULD:

- manter tom verde militar profundo;
- permitir leitura parcial do ambiente através da superfície;
- preservar reflexo/volume suficiente para continuar parecendo esfera;
- manter a marca central dourada legível;
- evitar aparência de bolha colorida excessivamente brilhante.

### Anéis orbitais

Os aros ao redor do Profile Orb são **órbitas**, não a massa principal do símbolo.

MUST:

- existir em planos inclinados distintos;
- girar continuamente como anéis planetários após a abertura;
- usar velocidades diferentes e baixas;
- permanecer subordinados visualmente à esfera;
- usar movimento baseado em `delta`, não velocidade por frame fixa.

Reduced motion MUST impedir a rotação ornamental contínua.

### Ativação na abertura

O Profile Orb MUST usar o mesmo relógio global da abertura, através de `profileActivation`.

Durante `profileActivation`:

- o conjunto parte de presença visual praticamente nula;
- escala/assentamento cresce continuamente até sua escala final;
- as três órbitas convergem deterministicamente para suas orientações finais;
- não deve existir clock independente, timeout ou `Math.random()`;
- o cue deve coincidir com as últimas animações do dock/identidade.

Após a abertura, o controller determinístico da Genesis deixa de controlar as órbitas e entra apenas o movimento ambiente contínuo.

## Assentamento contínuo

`settling` é lifecycle semântico, não uma nova animação.

Quando `globalProgress >= settlingStart`:

- a cena MAY publicar `settling`;
- nenhuma propriedade em movimento pode ter sua curva reiniciada;
- não pode surgir novo easing para a mesma propriedade;
- não pode existir plateau perceptível seguido de nova aceleração.

Identidade, chrome, CTA, footer e Profile Orb devem percorrer um único segmento depois de iniciados.

## Coreografia DOM

O mapa permanece protagonista; Profile Orb, identidade e comando compõem a fase final.

MUST:

- manter posições finais como destino;
- preferir `transform`/`opacity` compositor-friendly;
- evitar reflow animado;
- atrasar a maior parte da entrada do CTA/dock até o fim da Genesis;
- manter `ENTRAR NO COMANDO` como ação dominante no estado final.

## Lifecycle

```text
loading → primed → playing → settling → settled
```

Atalhos:

```text
skip            → settled
reduced-motion  → settled
WebGL failure   → fallback funcional
```

React MAY refletir lifecycle, mas MUST NOT receber progresso por frame em state.

## Navegação

- `OPERAÇÕES` -> `/matchmaking`;
- `DOUTRINA` -> `/rules`;
- `COMANDO` -> `/profile`.

A abertura MUST NOT atrasar navegação esperando os 3000 ms. Interrupção deve limpar a Genesis de forma segura.

## Determinismo e seek

A Home MUST possuir seek interno para checkpoints determinísticos:

```text
0.00 / 0.12 / 0.25 / 0.44 / 0.60 / 0.82 / 0.90 / 1.00 / post-cleanup
```

`seek=1.00` MUST poder permanecer em hold antes do cleanup. Para mesmo viewport, seed e progresso, a imagem MUST ser reproduzível.

## Performance

MUST:

- não usar `setState` dentro de `useFrame`;
- não criar timers por território;
- não recriar geometrias por frame;
- não criar Canvas/renderer adicional;
- não usar `Math.random()` em comportamento avaliado;
- reutilizar geometria da Foundation;
- liberar materiais exclusivos da Genesis no cleanup;
- não destruir materiais/geometrias compartilhados.

SHOULD:

- calcular descritores de ingresso uma vez;
- atualizar transforms por refs no frame loop;
- usar um único `genesisProgress` para material, bordas e anel;
- usar `profileActivation` do mesmo relógio para o Profile Orb;
- prewarm shaders/materiais antes de `playing`.

## Reduced motion

Com `prefers-reduced-motion: reduce`, a Home SHOULD entrar diretamente em `settled`.

A sequência espacial de ingresso, sweep 360°, dissolve prolongado e rotação ornamental contínua do Profile Orb MUST ser omitida. Conteúdo, CTA, hierarquia e navegação permanecem equivalentes.

## Fallback sem WebGL

O fallback 2D é contingência funcional e MUST representar diretamente o estado estável. MUST NOT ser usado como etapa da abertura WebGL nem fazer crossfade para fingir continuidade.

## Resize e mobile

Desktop e mobile compartilham regra center-out, seeds e timeline. Descritores de uma execução SHOULD ser congelados depois do priming; resize/orientation durante a abertura MUST NOT reiniciar timeline, trocar seed, teleportar territórios ou causar flash de elementos finais.

## Não fazer

MUST NOT:

- substituir o estado final da Foundation;
- mover câmera ou `BrazilTerritoryAssembly` pai para criar impacto;
- ordenar ingresso por `territoryId` ou ordem do SVG;
- iniciar todos os territórios simultaneamente;
- criar batches discretos ou segundo `assemblyLock`;
- iniciar Genesis e ring em clocks diferentes;
- exibir o anel dourado antes de zerar sua opacidade;
- representar perfil principalmente por aros opacos sem esfera;
- usar clock independente para o Profile Orb durante a abertura;
- manter rotação ornamental do Profile Orb em reduced motion;
- iniciar novo easing no estado `settling`;
- usar dois mapas lógicos/Canvas;
- usar `Math.random()`;
- coordenar a abertura com cadeia de timeouts;
- adicionar biblioteca de animação apenas para esta timeline.

## Definition of Done

Os territórios entram de fora em onda radial contínua, centro primeiro e periferia por último, e chegam exatamente à geografia final. A Genesis converte material e invoca o anel dourado sem flash de first-paint. Logo depois, o Profile Orb translúcido surge junto das últimas animações de comando e suas órbitas assentam antes de entrar em movimento ambiente planetário. O settling continua numa única trajetória, sem stop/restart. Aos 3000 ms o frame final está estável; remover a infraestrutura transitória não produz salto visual. Skip, reduced-motion, fallback, resize e navegação continuam funcionais.