# Opening Animation Standard — Ceremonial Choreography

Este documento define o método compartilhado para **aberturas complexas e coreografias cerimoniais** do pré-jogo. Ele complementa `quality-standard.md`, `visual-language.md` e `foundation/SPEC.md`.

O objetivo não é criar um motor genérico de cenas. O objetivo é garantir que aberturas específicas possam ser ambiciosas visualmente sem perder determinismo, performance, acessibilidade, continuidade espacial ou fidelidade ao estado final.

## Princípios invariantes

Toda abertura complexa MUST obedecer aos princípios abaixo.

### 1. Final-state ownership

O estado final da página/cena é a fonte de verdade. A abertura é uma transformação temporária que converge para esse estado.

MUST:

- manter o estado final implementado fora da lógica temporária da abertura;
- remover/desativar efeitos transitórios ao terminar;
- produzir após o cleanup o mesmo resultado que a página teria sem abertura.

MUST NOT:

- manter uma segunda composição final;
- depender do último frame interpolado como única definição do estado estável;
- duplicar câmera, layout ou material final em valores hardcoded dentro da abertura quando esses valores já pertencem à Foundation.

Quando possível, preferir o padrão **stable base + transient opening pass**: o objeto final já existe, e uma camada temporária o transforma/revela sem substituir sua fonte de verdade.

### 2. Same-object continuity

Quando a narrativa diz que um objeto se transforma, o usuário MUST perceber continuidade do mesmo objeto.

MUST NOT simular transformação por troca perceptível de asset, crossfade entre duas versões incompatíveis ou remount visual.

Camadas temporárias MAY compartilhar a mesma geometria do objeto final quando isso preserva identidade e permite cleanup seguro.

### 3. Primed frame before motion

A abertura MUST possuir um estado `primed` no qual:

- assets necessários já estão disponíveis;
- shaders/materiais necessários estão compilados ou preparados quando aplicável;
- o frame inicial da coreografia está aplicado;
- o estado final não pisca antes da abertura;
- pelo menos um frame renderizável é solicitado antes de o progresso começar.

Em R3F, quando necessário, usar `invalidate()` antes do início e iniciar a timeline no frame seguinte. Shaders complexos SHOULD ser pré-compilados com `WebGLRenderer.compileAsync()` quando a implementação corrente permitir.

### 4. One monotonic timeline

Cada abertura MUST ter **uma única timeline normalizada**.

Modelo conceitual:

```text
progress = clamp((now - startedAt) / duration, 0, 1)
```

`now` MUST vir de relógio monotônico (`requestAnimationFrame` timestamp / `performance.now()`).

Aberturas MUST NOT ser coordenadas por cadeias de `setTimeout`, múltiplos clocks independentes ou estados React atualizados a cada frame.

O progresso absoluto é preferido a acumular passos fixos, porque permite seek determinístico, evita dependência da taxa de atualização e reduz drift entre tracks.

### 5. Cue windows, not timeout choreography

A timeline deve ser dividida em **janelas semânticas**.

Exemplo:

```text
spatial-ingress      0.00 → 0.42
material-invocation  0.42 → 0.92
atmosphere           0.30 → 0.88
identity             0.48 → 0.94
primary-action       0.62 → 0.98
settling             0.86 → 1.00
```

Cada track recebe `localProgress(globalProgress, start, end, easing)`.

Aberturas SHOULD declarar essas janelas em um recipe/configuração pequena e testável, em vez de espalhar números mágicos entre componentes.

### 6. Single-property, single-curve

Uma propriedade visual que começa a se mover em uma abertura SHOULD possuir **uma única curva contínua até seu destino**.

MUST NOT encadear duas cue windows diferentes controlando sequencialmente a mesma posição/rotação/escala quando isso produz:

```text
acelera → desacelera/para → acelera novamente
```

Quando a propriedade precisa apenas esperar antes de iniciar, o estado inicial MAY permanecer em hold até sua janela; depois que o movimento começou, a curva deve seguir sem reinicialização até o destino.

Para movimentos espaciais com necessidade de assentamento suave, SHOULD usar smootherstep/quintic ou easing equivalente com derivadas suaves nos extremos. O lifecycle `settling` MAY começar enquanto a curva continua, mas MUST NOT iniciar um segundo easing da mesma propriedade.

### 7. Spatial assembly / radial ingress

Quando uma abertura monta um objeto composto a partir de partes, a SPEC MAY declarar um **spatial ingress** reutilizável.

Padrão recomendado para convergência center-out:

1. agrupar geometrias pela unidade semântica estável (`territoryId`, `cardId`, `panelId`, etc.);
2. calcular centroid/bounds da unidade completa;
3. calcular distância normalizada ao centro do conjunto;
4. derivar `start` monotonicamente dessa distância;
5. gerar origem fora da composição pela direção radial;
6. interpolar origem → destino em uma única curva;
7. usar seed determinístico apenas para pequenas variações que não mudem a ordem semântica.

MUST NOT usar ordem de array/asset como substituto da ordem espacial quando a narrativa exige proximidade geográfica.

O stagger SHOULD ser contínuo e com overlap; batches discretos só são permitidos quando a SPEC exige explicitamente leitura por grupos.

Múltiplas geometrias pertencentes à mesma unidade semântica MUST compartilhar o mesmo descritor de movimento para não separar visualmente uma unidade lógica.

### 8. Shared progress for coupled effects

Quando dois efeitos representam o mesmo acontecimento narrativo, SHOULD compartilhar o mesmo progresso local em vez de manter clocks/cues quase iguais.

Exemplo:

```text
genesisProgress
├── material reveal
├── border activation
├── permanent ring opacity
└── transient ring sweep rotation
```

Isso reduz drift e torna seek/snapshot determinístico.

Um efeito auxiliar transitório MAY ser usado para tornar uma transformação perceptível quando o objeto permanente é visualmente simétrico; no cleanup, somente o objeto permanente deve restar.

### 9. Render-domain ownership

Cada tipo de movimento deve usar a camada mais apropriada.

| Necessidade | Técnica preferida |
| --- | --- |
| material, dissolve, reveal, ruído, brilho local | shader/uniform GPU |
| transform de objeto 3D explicitamente previsto pelo spec | refs mutáveis em `useFrame` |
| texto, chrome e UI DOM | Web Animations API ou CSS `transform`/`opacity` |
| estado de negócio / navegação | React/DOM; nunca frame loop |
| fallback sem WebGL | composição 2D estável; animação opcional e simples |

No `useFrame`, MUST evitar `setState`. Atualizações por frame SHOULD mutar refs, uniforms e propriedades Three diretamente, mantendo cálculos curtos e reutilizando objetos temporários.

### 10. Deterministic procedural motion

Ruído, ordem territorial, offsets e variações MAY ser procedurais, mas MUST ser determinísticos.

MUST:

- derivar seeds de identificadores estáveis;
- usar coordenadas locais/normalizadas do objeto quando o efeito pertence ao objeto;
- produzir o mesmo resultado visual para o mesmo `progress`, viewport e seed.

MUST NOT usar `Math.random()` por montagem/frame para elementos avaliados por snapshot.

### 11. Complex material transitions

Para transições de superfície, SHOULD preferir transformação no GPU a dezenas de animações React independentes.

Padrão recomendado quando existe um estado final aprovado:

```text
final surface (persistente)
+ opening surface/pass (temporário)
+ progress uniform
→ opening pass desaparece
→ somente final surface permanece
```

Quando duas superfícies compartilham geometria, a implementação MUST evitar z-fighting por técnica apropriada (`polygonOffset`, pequena estratégia de depth ou equivalente) sem deslocar perceptivelmente a geometria lógica.

Dissolves SHOULD usar threshold suavizado/anti-aliased e ruído estável; padrões em screen-space que mudam ao redimensionar SHOULD ser evitados quando a transformação é percebida como parte do objeto.

### 12. DOM choreography

Tracks DOM que precisam apenas de opacidade/transform SHOULD usar Web Animations API ou CSS compositor-friendly.

Quando sincronização precisa com WebGL for necessária, todos os tracks MUST compartilhar o mesmo evento de início e duração. A implementação de teste MUST conseguir posicionar a animação DOM em um `currentTime` determinístico equivalente ao progresso solicitado.

Mudanças de layout (`top`, `left`, `width`, reflow contínuo) SHOULD ser evitadas durante a abertura quando `transform` resolve o mesmo problema.

O princípio `single-property, single-curve` também se aplica ao DOM: keyframes intermediários não devem criar parada/reaceleração não intencional do mesmo transform.

### 13. Lifecycle padrão

Aberturas complexas SHOULD usar o seguinte lifecycle semântico:

```text
loading → primed → playing → settling → settled
                    ↘ bypassed
                    ↘ fallback
```

- `loading`: recursos ainda não garantem o primeiro frame correto;
- `primed`: frame inicial correto e pronto para pintura;
- `playing`: `0 <= progress < settlingStart`;
- `settling`: aproximação final sem reiniciar as curvas em andamento;
- `settled`: abertura removida; estado estável é a única fonte visual;
- `bypassed`: skip/reduced-motion leva diretamente ao estado estável;
- `fallback`: WebGL indisponível; conteúdo e ação permanecem funcionais.

React SHOULD observar apenas mudanças de lifecycle. `progress` por frame não deve virar estado React.

### 14. Skip, navigation and interruptions

A abertura é ornamental e MUST NOT bloquear função.

MUST:

- permitir skip quando a duração for perceptível;
- terminar imediatamente em estado `settled` quando necessário para navegação;
- não atrasar redirect esperando a animação concluir;
- suportar unmount/route change sem timers órfãos ou recursos GPU transitórios vazando.

### 15. Reduced motion

`prefers-reduced-motion: reduce` MUST remover movimentos espaciais e coreografias não essenciais.

Por padrão, uma abertura puramente ornamental SHOULD entrar diretamente em `settled`. Uma variante reduzida curta MAY existir somente se não depender de pan, zoom, parallax, escala ampla, rotação ou repetição desconfortável.

### 16. Performance and resource lifecycle

MUST:

- reutilizar geometria estável;
- limitar criação de materiais/objetos dentro do frame loop;
- não alocar arrays/vetores por frame quando refs reutilizáveis resolvem;
- fazer dispose de materiais/texturas/targets exclusivos da abertura após cleanup;
- não fazer dispose de recursos compartilhados pertencentes à Foundation;
- não manter renderer concorrente apenas para executar a abertura.

SHOULD:

- calcular descritores espaciais no priming/memoization, não por frame;
- prewarm shaders da abertura;
- degradar primeiro efeitos secundários, não legibilidade;
- limitar DPR/adaptar qualidade conforme Foundation;
- permitir que cenas estáveis reduzam renderização contínua quando aplicável.

### 17. Deterministic seek for evals

Toda abertura complexa MUST possuir uma forma interna de avaliação determinística capaz de posicionar a coreografia em um progresso normalizado conhecido sem aguardar tempo real.

Esse mecanismo MAY ser um helper de teste, prop interna, controller ou harness; não precisa ser API pública de produção.

Deve ser possível avaliar pelo menos checkpoints suficientes para representar início, transições semânticas, settling, último frame e cleanup.

`progress = 1.00` e `post-cleanup` são estados diferentes de teste: o primeiro valida o último frame da timeline; o segundo valida que remover a infraestrutura temporária não altera visualmente o resultado.

## Recipe mínimo

Uma abertura SHOULD conseguir ser descrita por um recipe pequeno:

```ts
type OpeningRecipe = {
  id: string;
  durationMs: number;
  settlingStart: number;
  cues: Record<string, {
    start: number;
    end: number;
  }>;
};
```

O recipe contém **tempo e semântica**, não coordenadas de câmera, XYZ de objetos ou cópias do layout final.

## Técnicas proibidas por padrão

A menos que uma SPEC específica justifique explicitamente, MUST NOT:

- encadear `setTimeout` para montar a coreografia;
- atualizar React state por frame;
- usar um segundo Canvas/renderer para a intro;
- remontar o objeto final quando a intro termina;
- duplicar o layout final dentro do código da abertura;
- usar aleatoriedade não determinística;
- usar crossfade entre dois objetos diferentes para fingir continuidade;
- controlar a mesma propriedade por duas curvas sequenciais que gerem stop/restart;
- ordenar assembly espacial por índice de array quando a ordem semântica é geométrica;
- esconder stutter de compilação com um fade sem resolver o priming;
- adicionar biblioteca de animação apenas para uma timeline que o stack atual já suporta.

## Referências oficiais

- React Three Fiber — performance pitfalls: https://r3f.docs.pmnd.rs/advanced/pitfalls
- React Three Fiber — scaling/on-demand rendering: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- React Three Fiber — `useFrame`: https://r3f.docs.pmnd.rs/api/hooks
- Three.js — `Object3D`: https://threejs.org/docs/pages/Object3D.html
- Three.js — `Material`: https://threejs.org/docs/pages/Material.html
- Three.js — `ShaderMaterial`: https://threejs.org/docs/pages/ShaderMaterial.html
- Three.js — `WebGLRenderer.compileAsync`: https://threejs.org/docs/pages/WebGLRenderer.html
- MDN — Web Animations API: https://developer.mozilla.org/docs/Web/API/Web_Animations_API
- MDN — `requestAnimationFrame`: https://developer.mozilla.org/docs/Web/API/Window/requestAnimationFrame
- MDN — `prefers-reduced-motion`: https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion

## Definition of Done compartilhada

Uma abertura complexa só está pronta quando:

- primeiro frame intencional é reproduzível;
- timeline é única e seekable;
- propriedades não sofrem stop/restart por curvas encadeadas;
- efeitos semanticamente acoplados compartilham progresso quando aplicável;
- todos os tracks convergem sem salto;
- o estado final pós-cleanup é idêntico ao baseline estável;
- reduced-motion/skip/fallback funcionam;
- não existe `setState` por frame nem timeout choreography;
- recursos transitórios são liberados;
- snapshots intermediários e final são determinísticos.