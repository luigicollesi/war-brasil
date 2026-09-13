# SPEC — Home / Entrada no Comando

**Rota:** `/`  
**Cena:** `entrance`  
**Baseline final:** estado estável da Home em `dev`

Segue `../quality-standard.md`, `../visual-language.md`, `../opening-animation-standard.md` e os conceitos `CORE` aplicáveis em `../traceability.md`.

## Fantasia

A Home é uma **gênese cartográfica de comando** em três movimentos contínuos:

1. os territórios canônicos convergem de fora do enquadramento e montam o Brasil de dentro para fora;
2. com o Brasil montado, a Genesis material converte as cores canônicas na superfície militar enquanto o anel dourado é invocado e completa uma volta;
3. a cena desacelera em uma única continuidade até revelar exatamente a Home estável de `dev`.

Não existe troca entre dois mapas nem reconstrução aproximada do estado final. A Foundation final continua sendo a fonte da verdade.

## Objetivos do usuário

O jogador MUST conseguir:

- reconhecer claramente que os elementos convergentes formam o Brasil;
- perceber ordem espacial: regiões próximas ao centro entram antes e periferia depois;
- perceber Genesis material e anel dourado como um único acontecimento;
- iniciar o caminho para uma partida;
- acessar Doutrina/Regras e Perfil/Comando;
- pular a introdução;
- usar a página sem WebGL ou com motion reduzido.

## Invariantes estruturais

Durante toda a abertura normal:

- câmera/preset `table` MUST permanecer equivalente ao baseline final de `dev`;
- posição, rotação e escala globais de `BrazilTerritoryAssembly` MUST permanecer equivalentes ao baseline final;
- `DomainTable`, `OrbitalCrown`, `StrategicGlobe` recuado e `CommandInsignia` MUST conservar sua composição final;
- os 42 territórios MUST continuar derivados de `/war-brasil-42.production.svg`;
- shapes pertencentes ao mesmo `territoryId` MUST compartilhar o mesmo descritor de ingresso;
- somente a camada canônica transitória MAY receber transform local de entrada;
- a superfície final militar persistente MUST permanecer propriedade da Foundation.

A abertura MUST NOT mover o assembly pai, trocar câmera ou criar um segundo mapa lógico.

## Primeiro frame correto

A rota MAY possuir `loading/priming` enquanto WebGL e shaders são preparados.

No primeiro frame pintável da abertura com motion normal:

- a superfície militar final MUST NOT piscar;
- os territórios canônicos MUST estar preparados em posições de origem fora do enquadramento operacional;
- os fills MUST ser os do SVG canônico;
- o `BrazilTerritoryAssembly` pai já MUST estar em sua pose final;
- o anel dourado permanente MUST iniciar visualmente em opacidade zero;
- nenhum progresso temporal deve ser consumido antes de `primed`.

A Foundation SHOULD pré-compilar o pass temporário e solicitar frames pintáveis antes de publicar `primed`.

## Arquitetura

```text
BrazilTerritoryAssembly              ← pose global permanente de dev
├── FinalTerritorySurface            ← superfície militar persistente
├── FinalTerritoryEdges              ← bordas finais persistentes
└── HomeGenesisPass                  ← temporário
    ├── CanonicalTerritorySurface    ← mesmo geometry, transform local de ingresso
    └── GenesisRingSweep             ← arcos transitórios assimétricos

DomainTable
└── FinalGoldenRing                  ← persistente, opacity 0→final durante Genesis
```

A camada final MAY ficar temporariamente invisível enquanto os territórios canônicos ainda convergem, mas MUST ser restaurada como superfície subjacente quando a Genesis material começar.

No cleanup:

```text
HomeGenesisPass = removido
FinalTerritorySurface = baseline dev
FinalTerritoryEdges = baseline dev
FinalGoldenRing = baseline dev
```

Remover a Genesis MUST NOT causar salto visual.

## Timeline única

Duração nominal: **3000 ms**.

Todo efeito MUST derivar de uma única timeline monotônica normalizada `0..1`. A Home MUST NOT usar cadeias de `setTimeout` para sincronizar tracks.

### Cue windows normativas

| Track | Janela | Intenção |
| --- | ---: | --- |
| `territoryIngress` | `0.00–0.44` | convergência radial center-out dos territórios |
| `genesis` | `0.44–0.96` | materialização + bordas + anel dourado + sweep 360° |
| `atmosphere` | `0.30–0.92` | presença gradual do ambiente |
| `identity` | `0.50–0.94` | identidade/chrome entram sem competir com a montagem |
| `primaryAction` | `0.62–0.98` | CTA/footer chegam ao estado final |
| `settling` | `0.88–1.00` | fase semântica de desaceleração/observação; não inicia novo easing |

`settling` MUST NOT reiniciar posição, rotação, opacidade ou qualquer propriedade já em movimento.

## Ingresso radial dos territórios

### Unidade lógica

A unidade de coreografia é `territoryId`, não `ExtrudeGeometry` individual.

Se um território gerar múltiplas shapes, todas MUST compartilhar:

- `radialRank`;
- `spawnPosition`;
- `start`;
- `end`;
- curva de progresso.

### Ordem center-out

Para cada território deve ser calculado um centro geométrico a partir das bounds de todas as suas shapes.

```text
radialDistance = distance(territoryCentroid, brazilCentroid)
radialRank = radialDistance / maxTerritoryDistance
```

A ordem de início MUST ser monotônica em relação a `radialRank`: territórios centrais começam primeiro; a periferia começa depois.

A ordem MUST NOT depender de:

- ordem dos paths no SVG;
- `Math.random()`;
- timers individuais;
- grupos/batches discretos.

### Onda contínua

O stagger deve formar uma onda sobreposta. Não pode existir leitura de "lote 1 terminou, lote 2 começou".

A janela de início SHOULD ocupar aproximadamente os primeiros 32% do span de `territoryIngress`, deixando a maior parte do tempo de voo sobreposta entre territórios.

Uma transformação monotônica como `pow(radialRank, 1.35)` MAY ser usada para concentrar mais cedo a região central sem quebrar a ordem radial.

### Origem

O spawn MUST ficar suficientemente distante para que o território comece fora do enquadramento operacional do mapa.

A direção SHOULD partir radialmente do centro do Brasil em direção ao centro do território e continuar para fora.

A distância MAY considerar:

- diagonal das bounds do mapa;
- tamanho do próprio território;
- pequena extensão proporcional ao `radialRank`.

Um `zLift` determinístico MAY criar profundidade de chegada, desde que desapareça continuamente até zero e não altere a geometria final.

### Movimento único

Cada território MUST possuir uma única curva espacial:

```text
spawn ─────────────────────────────→ final
```

MUST NOT existir:

```text
ingress → stop → assembly-lock → stop → final
```

A progressão SHOULD usar smootherstep/quintic ou curva equivalente com velocidade e aceleração suaves nos extremos.

Ao terminar sua curva, o transform local do território MUST ser exatamente o transform canônico/final esperado pela Foundation.

## Genesis material

A Genesis só domina visualmente quando a onda de montagem chega ao Brasil completo.

A transformação SHOULD ocorrer no GPU por uniforms/shader de custo controlado.

O efeito MUST combinar:

- um único `genesisProgress`;
- coordenadas locais estáveis;
- seed determinístico por `territoryId`;
- campo espacial de baixa frequência;
- threshold suavizado.

A camada canônica colorida desaparece espacialmente e revela a superfície militar final persistente por baixo.

MUST NOT ser apenas fade global, desaturação ou troca de asset.

## Anel dourado sincronizado

A invocação do anel dourado MUST usar o **mesmo `genesisProgress`** da transformação material.

Durante `genesis`:

- o anel permanente de `DomainTable` progride de opacidade zero para sua opacidade final de `dev`;
- um `GenesisRingSweep` transitório SHOULD tornar o giro perceptível por segmentos/lacunas assimétricos;
- o sweep MUST completar exatamente `2π` entre `genesis=0` e `genesis=1`;
- o sweep MUST desaparecer até o final da janela;
- o anel permanente MUST terminar no estado material original da Foundation.

Um círculo perfeitamente uniforme não é evidência suficiente de rotação; o elemento transitório deve possuir assimetria visual.

## Fronteiras

As bordas finais podem nascer junto da Genesis usando o mesmo progresso, desde que:

- não alterem posição;
- preservem leitura territorial;
- terminem exatamente com material/opacidade da Foundation;
- não introduzam pulso contínuo após a abertura.

## Assentamento contínuo

`settling` é um estado semântico do lifecycle, não uma nova animação.

Quando `globalProgress >= settlingStart`:

- a cena MAY publicar `settling`;
- nenhuma propriedade em movimento pode ter sua curva reiniciada;
- não pode surgir nova chamada de easing para a mesma propriedade;
- não pode existir plateau perceptível seguido de nova aceleração.

A leitura temporal esperada é uma única desaceleração contínua até o estado final.

O mesmo princípio SHOULD ser aplicado a identidade, chrome, CTA e footer: depois que um transform começa, ele deve percorrer um único segmento até seu destino, sem keyframes intermediários que façam o movimento parar e recomeçar.

## Coreografia DOM

O mapa permanece protagonista.

MUST:

- manter posições finais de `dev` como destino;
- preferir `transform`/`opacity` compositor-friendly;
- evitar reflow animado;
- escalonar identidade/chrome/CTA sem criar uma segunda cerimônia após a Genesis;
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

A abertura MUST NOT atrasar navegação funcional esperando os 3000 ms. Interrupção deve limpar a Genesis de forma segura.

## Determinismo e seek

A Home MUST possuir seek interno para checkpoints determinísticos.

Checkpoints recomendados para esta coreografia:

```text
0.00 / 0.12 / 0.25 / 0.44 / 0.60 / 0.78 / 0.90 / 1.00 / post-cleanup
```

`seek=1.00` MUST poder permanecer em hold antes do cleanup para comparação entre último frame e `post-cleanup`.

Para mesmo viewport, seed e progresso, a imagem MUST ser reproduzível.

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

- calcular descritores de ingresso uma vez por conjunto de geometrias;
- atualizar transforms por refs no frame loop;
- usar um único progresso Genesis para material, bordas e anel;
- prewarm shader/material antes de `playing`.

## Reduced motion

Com `prefers-reduced-motion: reduce`, a Home SHOULD entrar diretamente em `settled`.

A sequência espacial de ingresso, sweep 360° e dissolve prolongado MUST ser omitida.

Conteúdo, CTA, hierarquia e navegação permanecem equivalentes.

## Fallback sem WebGL

O fallback 2D é contingência funcional e MUST representar diretamente o estado estável.

MUST NOT ser usado como etapa da abertura WebGL nem fazer crossfade para fingir continuidade.

## Resize e mobile

Desktop e mobile compartilham a mesma regra center-out e seeds.

Descritores de uma execução SHOULD ser congelados depois do priming; resize/orientation durante a abertura MUST NOT:

- reiniciar a timeline;
- trocar seed/ordem radial;
- teleportar territórios;
- piscar a superfície final antes do tempo.

## Não fazer

MUST NOT:

- substituir o estado final de `dev`;
- mover câmera ou `BrazilTerritoryAssembly` pai para criar impacto;
- ordenar ingresso por `territoryId` ou ordem do SVG;
- iniciar todos os territórios simultaneamente;
- criar batches discretos de chegada;
- executar um segundo `assemblyLock` espacial;
- iniciar Genesis e ring em clocks diferentes;
- usar círculo uniforme como único indicador de giro;
- iniciar novo easing no estado `settling`;
- usar dois mapas lógicos/Canvas;
- usar `Math.random()`;
- coordenar a abertura com cadeia de timeouts;
- adicionar biblioteca de animação apenas para esta timeline.

## Definition of Done

Os territórios canônicos entram de fora em uma onda radial contínua, centro primeiro e periferia por último, e chegam exatamente à geografia final. A partir do encaixe, uma única curva Genesis converte material, revela bordas e invoca o anel dourado enquanto um sweep completa 360°. O assentamento é uma desaceleração contínua, sem stop/restart. Aos 3000 ms o frame coincide com `dev`; remover a infraestrutura transitória não altera visualmente a Home. Skip, reduced-motion, fallback, resize e navegação continuam funcionais.