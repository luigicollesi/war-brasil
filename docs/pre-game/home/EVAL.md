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
| HOME-08 | timeline só inicia depois de existir um frame `primed` correto | source + temporal snapshot |
| HOME-09 | Brasil continua sendo os 42 territórios canônicos em todos os estados | visual + FND gates |
| HOME-10 | `ENTRAR NO COMANDO` permanece ação dominante no estado final | visual/semantic inspection |
| HOME-11 | destinos continuam controles DOM acessíveis e não dependem do Canvas | accessibility inspection |
| HOME-12 | primeiro frame visível do Brasil em motion normal mostra o mapa canônico colorido; o mapa militar final não pisca antes | temporal snapshot |
| HOME-13 | posição, rotação, escala global do Brasil e câmera permanecem equivalentes ao baseline final durante toda a Genesis | source + temporal snapshots |
| HOME-14 | a abertura usa o mesmo assembly/geometria do mapa estável; não existe segundo Brasil visível nem troca perceptível de asset | source + browser |
| HOME-15 | Genesis usa uma única timeline monotônica normalizada de 3000 ms; não depende de cadeia de `setTimeout` | source inspection |
| HOME-16 | materialização territorial é espacialmente estruturada e determinística; não é apenas fade global | browser + source |
| HOME-17 | seeds/offsets procedurais são estáveis; mesmo progresso produz a mesma imagem no mesmo viewport | repeat snapshots |
| HOME-18 | fronteiras permanecem espacialmente fixas/legíveis e não existe explode/`position.z` territorial durante Genesis | visual + source |
| HOME-19 | transformação revela os materiais finais pertencentes à Foundation; a Home não mantém uma segunda definição do material/pose final | source inspection |
| HOME-20 | identidade, chrome, atmosfera, CTA, telemetria e footer materializam em cue windows distintas sem pop-in | temporal snapshots |
| HOME-21 | aos 3000 ms o frame coincide com o estado final baseline de `dev` sem salto perceptível | visual regression |
| HOME-22 | `post-cleanup` coincide com `intro-100`; remover Genesis não altera posição, cor, material, câmera ou opacidade final | visual regression + source |
| HOME-23 | nenhum `setState` React ocorre dentro de `useFrame`; progresso por frame usa refs/uniforms/propriedades Three | source inspection |
| HOME-24 | shader/material temporário é primed/prewarm quando aplicável e o primeiro frame não apresenta stutter de compilação perceptível | source + browser/profile |
| HOME-25 | recursos exclusivos da Genesis são liberados após settle/unmount sem destruir recursos compartilhados da Foundation | source + profiler/inspection |
| HOME-26 | existe mecanismo interno de seek determinístico para `0/.15/.35/.60/.85/1/post-cleanup` | source + automated/manual harness |
| HOME-27 | resize/orientation durante a Genesis não reinicia timeline, seeds nem causa flash do estado final | browser/mobile |
| HOME-28 | navegação/ação não espera o fim dos 3000 ms; interrupção faz cleanup seguro | e2e/manual |
| HOME-29 | fallback 2D não participa da intro WebGL normal e não há crossfade 2D→3D usado para fingir transformação | source + browser |
| HOME-30 | implementação não adiciona Canvas/renderer ou biblioteca de animação adicional sem justificativa explícita | source/dependency inspection |

## Score / 100

- 30 — continuidade do Brasil e qualidade da materialização territorial;
- 25 — fidelidade exata ao estado final de `dev`;
- 15 — coreografia/timeline e leitura cinematográfica;
- 10 — determinismo, priming e ausência de stutter/pop-in;
- 10 — mobile, reduced-motion, skip e fallback;
- 10 — performance, cleanup e arquitetura.

Aprovação: **>= 85 + todos os BLOCKERs**.

## Testes de percepção

### HOME-V1 — Primeiro Brasil inequívoco

Em uma montagem nova com motion normal, observar a primeira aparição do mapa. O primeiro Brasil visível deve ser completo, canônico e colorido, já ocupando a mesma pose espacial do resultado final. Se o usuário vê primeiro o mapa militar pronto, um mapa deslocado ou uma troca entre mapas, reprovar.

### HOME-V2 — Mesmo objeto

Acompanhar fronteiras e silhueta durante toda a intro. O Brasil deve parecer o mesmo objeto sendo materializado internamente. Não pode haver leitura de “asset A saiu / asset B entrou”.

### HOME-V3 — Gênese de superfície

Entre ~15% e ~80%, a transformação deve ser claramente espacial/territorial: regiões de cor canônica cedem progressivamente ao material militar. Um simples fade uniforme ou desaturação global reprova.

### HOME-V4 — Autoridade sem scanner genérico

A materialização pode usar bordas, latão, iluminação local e ruído, mas não deve parecer scanner holográfico ciano, loading bar, glitch genérico ou efeito de template sci-fi.

### HOME-V5 — Geografia imóvel

Comparar `intro-0`, `intro-35`, `intro-60`, `intro-85` e `intro-100` com overlay de diferença geométrica. Fronteiras, pose global e enquadramento do mapa não devem viajar durante a Genesis.

### HOME-V6 — Interface pertence à mesma cerimônia

Identidade, chrome, atmosfera, CTA e footer surgem em janelas diferentes e progressivas. Não podem aparecer todos de uma vez nem competir com a leitura inicial do Brasil.

### HOME-V7 — Estado final baseline

Comparar `intro-100` com a Home de `dev` no mesmo viewport e estado funcional. Câmera, Mesa, Brasil, Coroa, globo, insígnia, identidade, CTA, footer e chrome devem coincidir. Diferença estrutural reprova.

### HOME-V8 — Cleanup invisível

Capturar `intro-100`, executar cleanup da Genesis e capturar `post-cleanup`. A diferença visual deve ser nula ou limitada a ruído de rasterização não estrutural. Qualquer salto de cor, posição, material ou opacidade reprova.

### HOME-V9 — Repetibilidade

Executar três vezes os snapshots intermediários com o mesmo viewport/seed. A distribuição do dissolve, ordem territorial e acentos devem coincidir. Variação aleatória entre execuções reprova.

### HOME-V10 — Priming

Com cache frio e CPU/GPU throttling razoável, a timeline não deve começar antes do pass necessário estar pronto. Não aceitar um primeiro frame travado seguido de salto perceptível no progresso.

## Estados para snapshot

Desktop `1440x900` e mobile `390x844`:

- `loading/priming` — nenhuma Home final piscando antes da Genesis;
- `intro-0` — Brasil canônico colorido na pose final;
- `intro-15` — ativação territorial iniciada;
- `intro-35` — materialização claramente espacial;
- `intro-60` — material militar dominante e interface periférica em formação;
- `intro-85` — assentamento, resíduos canônicos mínimos;
- `intro-100` — último frame da timeline;
- `post-cleanup` — somente estado estável da Foundation;
- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `reduced-motion`;
- `fallback`.

Snapshots seguem as regras de determinismo de `../quality-standard.md`.

## Inspeção técnica obrigatória

A revisão MUST verificar explicitamente:

```text
[ ] opening progress não é React state por frame
[ ] não existe setTimeout choreography
[ ] não existe segundo Canvas
[ ] não existe segundo mapa lógico/asset visível
[ ] não existe Math.random() afetando snapshots
[ ] final pose/material não está duplicado na Home
[ ] transient materials/textures possuem cleanup
[ ] shared Foundation resources não são disposed pela Genesis
[ ] seek determinístico consegue posicionar todos os checkpoints
[ ] reduced-motion não instancia movimento ornamental desnecessário
```

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Home em `../traceability.md` MUST estar presentes. Omissão reprova mesmo com score >= 85.
