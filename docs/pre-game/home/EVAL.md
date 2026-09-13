# EVAL — Home / Entrada

Avaliar conforme `../quality-standard.md`, `../opening-animation-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| HOME-01 | `OPERAÇÕES` navega para `/matchmaking` | e2e/manual |
| HOME-02 | `DOUTRINA` navega para `/rules` | e2e/manual |
| HOME-03 | `COMANDO` navega para `/profile` | e2e/manual |
| HOME-04 | intro é pulável e reduced-motion entra diretamente em estado funcional estável | e2e/manual + snapshot |
| HOME-05 | fallback funcional existe quando WebGL está indisponível | fallback test |
| HOME-06 | metadata/structured data relevante não sofre regressão | inspection/test |
| HOME-07 | 390x844 não tem overflow horizontal nem ação dependente de hover | mobile/touch |
| HOME-08 | timeline só inicia depois de existir frame `primed` renderizável | source + temporal snapshot |
| HOME-09 | Brasil continua derivado dos 42 territórios canônicos | visual + FND gates |
| HOME-10 | `ENTRAR NO COMANDO` permanece ação dominante no estado final | visual/semantic inspection |
| HOME-11 | destinos continuam controles DOM acessíveis e independentes do Canvas | accessibility inspection |
| HOME-12 | primeiro estado da abertura não pisca o mapa militar final antes dos territórios canônicos | temporal snapshot |
| HOME-13 | câmera e transform global do `BrazilTerritoryAssembly` permanecem equivalentes ao baseline final durante toda a abertura | source + temporal snapshots |
| HOME-14 | somente a camada canônica transitória recebe transform local de ingresso; o assembly final não é movido | source inspection |
| HOME-15 | shapes com mesmo `territoryId` compartilham o mesmo descritor de movimento | source + seek snapshot |
| HOME-16 | ordem de início é radial center-out: territórios mais centrais começam antes da periferia | source + temporal snapshots |
| HOME-17 | stagger radial é contínuo/overlapped e não dividido em batches discretos | temporal snapshots |
| HOME-18 | origens de ingresso ficam fora do enquadramento operacional e são determinísticas | source + intro-0/intro-12 |
| HOME-19 | cada território usa uma única curva spawn→final; não existe segundo `assemblyLock` espacial | source + motion capture |
| HOME-20 | todos os territórios atingem exatamente a posição canônica até `territoryIngress=1` | seek snapshot + source |
| HOME-21 | Genesis material começa no mesmo marco em que o ingresso termina e usa uma única timeline normalizada de 3000 ms | source inspection |
| HOME-22 | materialização territorial é espacialmente estruturada/determinística e não um fade global | browser + source |
| HOME-23 | Genesis revela os materiais finais persistentes da Foundation; não duplica definição de pose/material final na Home | source inspection |
| HOME-24 | anel dourado permanente inicia invisível e usa o mesmo `genesisProgress` da materialização | source + temporal snapshots |
| HOME-25 | sweep assimétrico do anel completa exatamente 360° durante a mesma janela Genesis e desaparece até o fim | source + browser |
| HOME-26 | bordas finais surgem coordenadas ao mesmo progresso Genesis e terminam no estado exato da Foundation | visual regression |
| HOME-27 | `settling` é apenas fase semântica; não inicia novo easing ou segundo impulso de movimento | source + motion capture |
| HOME-28 | identidade/chrome/CTA/footer não possuem sequência visual “move → para → move” na mesma propriedade | browser + CSS inspection |
| HOME-29 | aos 3000 ms o frame coincide com o estado final baseline de `dev` sem salto perceptível | visual regression |
| HOME-30 | `post-cleanup` coincide com `intro-100`; remover Genesis não altera posição, cor, material, câmera ou opacidade | visual regression + source |
| HOME-31 | nenhum `setState` React ocorre dentro de `useFrame`; progresso usa refs/uniforms/propriedades Three | source inspection |
| HOME-32 | shaders/materials são primed/prewarm quando aplicável e o início não apresenta stutter perceptível | source + browser/profile |
| HOME-33 | recursos exclusivos da Genesis são liberados sem destruir recursos compartilhados | source + profiler/inspection |
| HOME-34 | seek determinístico cobre `0/.12/.25/.44/.60/.78/.90/1/post-cleanup` | source + harness |
| HOME-35 | resize/orientation durante a abertura não reinicia timeline, ordem radial ou seeds | browser/mobile |
| HOME-36 | navegação não espera os 3000 ms; interrupção faz cleanup seguro | e2e/manual |
| HOME-37 | fallback 2D não participa da intro WebGL normal | source + browser |
| HOME-38 | implementação não adiciona Canvas/renderer nem biblioteca de animação adicional | source/dependency inspection |

## Score / 100

- 25 — qualidade da convergência radial e leitura de montagem;
- 20 — Genesis material + sincronização do anel;
- 20 — fidelidade exata ao estado final de `dev`;
- 15 — fluidez temporal/assentamento sem stop-restart;
- 10 — determinismo, priming e ausência de stutter/pop-in;
- 10 — mobile, reduced-motion, fallback, cleanup e performance.

Aprovação: **>= 85 + todos os BLOCKERs**.

## Testes de percepção

### HOME-V1 — Center-out inequívoco

Observar os primeiros ~45% da abertura. A montagem deve nascer visualmente do centro do Brasil para a periferia. Não é necessário reconhecer uma sequência rígida de estados, mas a periferia não pode dominar antes das regiões centrais.

### HOME-V2 — Onda, não lotes

A entrada deve parecer uma onda contínua com bastante overlap. Se houver leitura de grupos separados (“primeiro lote terminou, depois outro começou”), reprovar.

### HOME-V3 — Mesmo território, mesmo movimento

Territórios que possuam múltiplas shapes devem mover seus componentes juntos, preservando a leitura de uma única unidade geográfica.

### HOME-V4 — Movimento único

Acompanhar um território central, um intermediário e um periférico. Cada um deve executar uma trajetória contínua desde spawn até a posição final. Se desacelerar até parar e depois receber novo impulso para encaixar, reprovar.

### HOME-V5 — Genesis começa no Brasil montado

Em `intro-44`, o Brasil deve estar geometricamente montado e a transição material deve estar apenas começando. Não deve existir intervalo morto entre encaixe e Genesis.

### HOME-V6 — Material + anel são um acontecimento

Entre `intro-44` e `intro-96`, observar simultaneamente mapa e anel. Conforme as cores cedem ao material militar, o anel permanente ganha presença e o sweep dourado percorre a volta. Se parecerem animações independentes ou dessicronizadas, reprovar.

### HOME-V7 — Giro perceptível

O sweep deve possuir assimetria suficiente para tornar o giro visível. Um círculo uniforme cuja rotação não pode ser percebida não satisfaz o gate.

### HOME-V8 — Genesis territorial

Entre ~44% e ~90%, regiões canônicas cedem espacialmente ao material militar. Fade uniforme, troca de asset ou desaturação global reprovam.

### HOME-V9 — Assentamento contínuo

Observar especialmente os últimos 25%. Não deve existir padrão “rápido → pausa/plateau → rápido → final”. O movimento deve perder energia de forma contínua numa única trajetória.

### HOME-V10 — Interface acompanha, não recomeça

Identidade, chrome, CTA e footer podem começar em tempos diferentes, mas depois de iniciar seu transform devem ir continuamente ao destino. Keyframes intermediários que criem novo impulso perceptível reprovam.

### HOME-V11 — Estado final baseline

Comparar `intro-100` com a Home de `dev` no mesmo viewport/estado funcional. Câmera, Mesa, Brasil, Coroa, globo, insígnia, anel, bordas, identidade, CTA, footer e chrome devem coincidir.

### HOME-V12 — Cleanup invisível

Capturar `intro-100`, liberar o hold/cleanup e capturar `post-cleanup`. Diferença estrutural ou salto em material/opacidade reprova.

### HOME-V13 — Repetibilidade

Executar três vezes os checkpoints no mesmo viewport. Ordem de entrada, spawn radial, dissolve e sweep devem coincidir.

### HOME-V14 — Priming

Com cache frio e throttling razoável, a timeline não deve começar antes de geometrias/material temporário estarem prontos. Não aceitar salto grande no primeiro frame animado.

## Estados para snapshot

Desktop `1440x900` e mobile `390x844`:

- `loading/priming`;
- `intro-0` — territórios canônicos ainda em suas origens de entrada; mapa militar não pisca;
- `intro-12` — centro já converge, periferia começa/aguarda conforme radial rank;
- `intro-25` — onda de montagem claramente em curso;
- `intro-44` — Brasil montado; Genesis/anel iniciam;
- `intro-60` — materialização e sweep claramente visíveis;
- `intro-78` — material militar dominante e anel em giro;
- `intro-90` — fase semântica `settling`, sem nova aceleração;
- `intro-100` — último frame em hold pré-cleanup;
- `post-cleanup` — somente Foundation estável;
- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `reduced-motion`;
- `fallback`.

## Inspeção técnica obrigatória

```text
[ ] BrazilTerritoryAssembly pai não é animado pela abertura
[ ] descriptor é indexado por territoryId, não por shape index
[ ] radialRank vem de distância geométrica ao centro
[ ] não existe Math.random() no ingresso/Genesis
[ ] não existem batches/timers por território
[ ] cada território possui uma única curva espacial
[ ] Genesis material e ring usam o mesmo genesisProgress
[ ] sweep executa 2π e é transitório
[ ] settling não inicia nova interpolação
[ ] opening progress não é React state por frame
[ ] não existe segundo Canvas ou segundo asset lógico do Brasil
[ ] materiais transitórios possuem cleanup
[ ] materiais/geometrias compartilhados não são disposed pela Genesis
[ ] seek=1 pode permanecer em hold antes do cleanup
[ ] reduced-motion não executa movimento ornamental prolongado
```

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Home em `../traceability.md` MUST estar presentes. Omissão reprova mesmo com score >= 85.