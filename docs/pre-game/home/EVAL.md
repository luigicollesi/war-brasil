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
| HOME-12 | primeiro estado não pisca o mapa militar final antes dos territórios canônicos | temporal snapshot |
| HOME-13 | câmera e transform global do `BrazilTerritoryAssembly` permanecem equivalentes ao baseline final | source + temporal snapshots |
| HOME-14 | somente a camada canônica transitória recebe transform local de ingresso | source inspection |
| HOME-15 | shapes com mesmo `territoryId` compartilham o mesmo descritor de movimento | source + seek snapshot |
| HOME-16 | ordem de início é radial center-out: territórios centrais começam antes da periferia | source + snapshots |
| HOME-17 | stagger radial é contínuo/overlapped e não dividido em batches discretos | temporal snapshots |
| HOME-18 | origens de ingresso ficam fora do enquadramento operacional e são determinísticas | source + intro-0/12 |
| HOME-19 | cada território usa uma única curva spawn→final; não existe segundo `assemblyLock` | source + motion capture |
| HOME-20 | todos os territórios atingem exatamente a posição canônica ao final do ingresso | seek snapshot + source |
| HOME-21 | Genesis usa uma única timeline normalizada de 3000 ms | source inspection |
| HOME-22 | materialização territorial é espacialmente estruturada/determinística e não fade global | browser + source |
| HOME-23 | Genesis revela materiais finais persistentes da Foundation | source inspection |
| HOME-24 | anel dourado permanente **já nasce invisível no first paint** da abertura | cold-load snapshot + source |
| HOME-25 | anel dourado usa o mesmo `genesisProgress` da materialização | source + temporal snapshots |
| HOME-26 | sweep assimétrico completa 360° durante Genesis e desaparece até o fim | source + browser |
| HOME-27 | bordas terminam exatamente no estado da Foundation | visual regression |
| HOME-28 | Profile Orb é percebido principalmente como esfera translúcida, não como aros opacos | browser + snapshot |
| HOME-29 | esfera do Profile Orb mantém volume/reflexo/transmissão e glyph central legível | browser |
| HOME-30 | Profile Orb possui múltiplas órbitas em planos distintos e subordinadas à esfera | browser + source |
| HOME-31 | `profileActivation` usa o mesmo relógio global e ocorre no final da Genesis, junto do assentamento do comando | source + temporal snapshot |
| HOME-32 | durante a intro as órbitas convergem deterministicamente; após settle passam ao giro ambiente | source + browser |
| HOME-33 | órbitas ambiente usam `delta` e não velocidade fixa por frame | source inspection |
| HOME-34 | reduced-motion desativa rotação ornamental contínua do Profile Orb | source + reduced snapshot |
| HOME-35 | `settling` é apenas fase semântica; não inicia novo easing ou segundo impulso | source + motion capture |
| HOME-36 | identidade/chrome/CTA/footer não possuem “move → para → move” na mesma propriedade | browser + CSS inspection |
| HOME-37 | aos 3000 ms o frame está estável sem salto perceptível | visual regression |
| HOME-38 | `post-cleanup` coincide com `intro-100`; cleanup não altera mapa, anel ou Profile Orb | visual regression + source |
| HOME-39 | nenhum `setState` React ocorre dentro de `useFrame`; progresso usa refs/uniforms/propriedades Three | source inspection |
| HOME-40 | shaders/materials são primed/prewarm quando aplicável | source + browser/profile |
| HOME-41 | recursos exclusivos da Genesis são liberados sem destruir recursos compartilhados | source + profiler |
| HOME-42 | seek determinístico cobre checkpoints intermediários e `1/post-cleanup` | source + harness |
| HOME-43 | resize/orientation não reinicia timeline, ordem radial ou seeds | browser/mobile |
| HOME-44 | navegação não espera os 3000 ms; interrupção faz cleanup seguro | e2e/manual |
| HOME-45 | fallback 2D não participa da intro WebGL normal | source + browser |
| HOME-46 | implementação não adiciona Canvas/renderer nem biblioteca de animação adicional | source/dependency inspection |

## Score / 100

- 22 — convergência radial e montagem do Brasil;
- 18 — Genesis material + anel dourado;
- 15 — Profile Orb, translucidez e qualidade orbital;
- 15 — fidelidade final/cleanup;
- 12 — fluidez temporal e assentamento;
- 10 — determinismo, priming e ausência de flash/stutter;
- 8 — mobile, reduced-motion, fallback e performance.

Aprovação: **>= 85 + todos os BLOCKERs**.

## Testes de percepção

### HOME-V1 — Center-out inequívoco

Nos primeiros ~44%, a montagem deve nascer do centro para a periferia. A periferia não pode dominar primeiro.

### HOME-V2 — Onda, não lotes

A entrada deve parecer onda contínua com overlap. Grupos separados em etapas reprovam.

### HOME-V3 — Mesmo território, mesmo movimento

Múltiplas shapes do mesmo território devem mover juntas.

### HOME-V4 — Movimento único

Um território central, intermediário e periférico devem executar uma trajetória contínua. Stop/restart reprova.

### HOME-V5 — Genesis começa no Brasil montado

Em `intro-44`, o Brasil deve estar montado e a Genesis começando, sem intervalo morto.

### HOME-V6 — Material + anel são um acontecimento

Entre `intro-44` e `intro-82`, mapa e anel devem parecer acoplados pelo mesmo evento. Dessincronização reprova.

### HOME-V7 — Zero flash do anel

Em reload com cache frio e gravação frame a frame, não pode existir frame em que o anel dourado esteja visível antes de seu reveal. “Aparece e some” reprova mesmo que dure apenas um frame.

### HOME-V8 — Giro perceptível

O sweep deve possuir assimetria suficiente para evidenciar a rotação completa.

### HOME-V9 — Profile Orb como esfera

Na fase final, a primeira leitura deve ser uma esfera verde translúcida com volume e marca central. Se o objeto for percebido primeiro como coleção de torus/aros, reprovar.

### HOME-V10 — Órbitas planetárias

Após a abertura, os anéis devem girar continuamente em planos e velocidades distintas, como órbitas ao redor da esfera. Jitter, giro sincronizado idêntico ou velocidade agressiva reprovam.

### HOME-V11 — Ativação após Genesis

O Profile Orb não deve competir com a montagem ou com o clímax inicial da Genesis. Sua entrada principal deve ocorrer na fase final, aproximadamente `0.80–0.99`, junto do dock e das últimas animações.

### HOME-V12 — Assentamento contínuo

Nos últimos ~20%, não pode existir padrão “rápido → pausa → rápido”. Profile Orb, dock e interface devem convergir em movimento contínuo.

### HOME-V13 — Estado final estável

Em `intro-100`, câmera, Mesa, Brasil, Coroa, globo, Profile Orb, anel, bordas, identidade, CTA, footer e chrome devem estar no estado final esperado.

### HOME-V14 — Cleanup invisível

Comparar `intro-100` e `post-cleanup`. Remover Genesis não pode provocar salto em escala/orientação do Profile Orb nem material/opacidade do anel.

### HOME-V15 — Repetibilidade

Três execuções no mesmo viewport devem coincidir nos checkpoints: entrada, dissolve, sweep e orientação do Profile Orb durante ativação.

### HOME-V16 — Reduced motion

Com reduced motion, a Home entra funcionalmente estável sem convergência longa, sweep ou giro ambiente contínuo do Profile Orb.

## Estados para snapshot

Desktop `1440x900` e mobile `390x844`:

- `loading/priming`;
- `intro-0` — anel dourado invisível; Profile Orb sem presença visual; territórios nas origens;
- `intro-12` — centro convergindo;
- `intro-25` — onda em curso;
- `intro-44` — Brasil montado; Genesis/anel iniciam;
- `intro-60` — materialização e sweep evidentes;
- `intro-82` — Genesis concluindo e Profile Orb começando a assumir leitura;
- `intro-90` — Profile Orb/dock assentando; lifecycle `settling` sem nova curva;
- `intro-100` — último frame em hold pré-cleanup;
- `post-cleanup` — Foundation estável;
- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `reduced-motion`;
- `fallback`.

## Inspeção técnica obrigatória

```text
[ ] BrazilTerritoryAssembly pai não é animado
[ ] descriptor é indexado por territoryId
[ ] radialRank vem de distância geométrica
[ ] não existe Math.random() no ingresso/Genesis/Profile Orb avaliado
[ ] cada território possui uma única curva espacial
[ ] Genesis material e golden ring usam o mesmo genesisProgress
[ ] golden ring é criado com opacity 0 durante intro, antes de effects
[ ] sweep executa 2π e é transitório
[ ] Profile Orb usa esfera translúcida como corpo principal
[ ] existem órbitas independentes em planos diferentes
[ ] profileActivation usa o relógio global da abertura
[ ] movimento ambiente orbital usa delta e é desativado em reduced-motion
[ ] settling não inicia nova interpolação
[ ] opening progress não é React state por frame
[ ] não existe segundo Canvas ou segundo mapa lógico
[ ] materiais transitórios possuem cleanup
[ ] shared resources não são disposed pela Genesis
[ ] seek=1 permanece em hold antes do cleanup
```

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Home em `../traceability.md` MUST estar presentes. Omissão reprova mesmo com score >= 85.